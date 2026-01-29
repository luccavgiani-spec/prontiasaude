
Contexto (o que está acontecendo agora)
- O “401 Token inválido” foi superado quando você copiou a função para o seu Supabase e ela passou a entrar no fluxo do `activate_plan_manual`.
- Agora o erro está no passo `plan_upsert`:
  - `details: "Could not find the 'activated_at' column of 'patient_plans' in the schema cache"`
- Isso é um erro do PostgREST (API do banco) indicando que, para o projeto Supabase onde a função está rodando, a API não enxerga a coluna `activated_at` (por cache desatualizado OU porque a coluna realmente não existe nesse banco).

Objetivo (prioridade máxima)
- Fazer a ativação manual funcionar em Produção sem depender de “reload de schema” dar certo na primeira tentativa.
- Manter segurança (admin role continua sendo verificada no backend do login).

1) ARQUIVOS QUE SERÃO MODIFICADOS
- `supabase/functions/patient-operations/index.ts`

2) MOTIVO (baseado no seu pedido)
- A ativação manual está falhando no `upsert` por incompatibilidade de schema cache/coluna (`activated_at`). Precisamos tornar o upsert resiliente para não travar a operação e destravar imediatamente o fluxo em produção.

3) ESCOPO (exatamente o que vai mudar)
A) Upsert resiliente (fallback automático) dentro do case `activate_plan_manual`
- Manter o upsert “completo” como primeira tentativa (incluindo `activated_at` e `activated_by`).
- Se o erro retornar com a assinatura típica de cache/coluna ausente (contendo `activated_at` + `schema cache`), fazer uma segunda tentativa automaticamente removendo campos “problemáticos”:
  - Remover `activated_at`
  - (se necessário) remover também `activated_by`
- Retornar sucesso quando a segunda tentativa funcionar, e incluir um campo informativo na resposta (ex.: `warning: 'activated_at_column_unavailable_fallback_used'`) para rastreabilidade.

B) Diagnóstico melhor (sem depender de logs)
- No retorno de erro do `plan_upsert`, incluir:
  - `details` com a mensagem original
  - `hint` com instruções curtas (“Verifique se a coluna activated_at existe no banco e se o schema cache foi recarregado no projeto correto.”)
- Logar no console da função (server-side) um marcador claro quando o fallback for acionado.

C) (Opcional, mas recomendado) Garantia de consistência do payload
- Centralizar o objeto do payload do plano em uma variável (ex.: `planPayload`) para evitar divergência entre tentativa 1 e tentativa 2.

4) O que você deve checar no seu Supabase (para corrigir “de verdade” e não só contornar)
Mesmo com o fallback, o ideal é alinhar schema em produção. Como você relatou que rodou o SQL de reload e “deu o mesmo erro”, há duas hipóteses:

Hipótese 1 — a coluna NÃO existe no banco onde você está rodando a função
- Você vai confirmar no SQL editor do seu projeto de produção com uma query de inspeção (ex.: consultando `information_schema.columns` para `patient_plans`).
- Se não existir, você precisa adicionar a coluna (e opcionalmente `activated_by`) com ALTER TABLE.
  - Colunas esperadas pelo código:
    - `activated_at` (timestamp with time zone / timestamptz)
    - `activated_by` (text)

Hipótese 2 — você recarregou o schema em um lugar, mas a função está chamando outro projeto/instância
- Se a função estiver em um projeto e o banco/REST (PostgREST) que está sendo usado for outro (ou cache não recarregou de fato), o erro persiste.
- O fallback elimina a urgência e a ativação passa a funcionar enquanto você confirma o alinhamento.

5) Resposta direta: “Por que você não edita/atualiza as edge functions direto no Supabase?”
- Porque o fluxo padrão de Edge Functions é: o código-fonte vive no repositório (aqui no Lovable) e depois é publicado/deployado para o projeto Supabase.
- O “Supabase UI” não é a fonte de verdade do código nesse tipo de setup; ela recebe o bundle publicado.
- No seu caso, como você quer operar com o projeto Supabase externo (produção), faz sentido você ter feito o “copiar/colar” lá para acelerar. Só que isso cria risco de divergência: o código no Lovable e o código no Supabase podem ficar diferentes.
- A correção mais segura é: manter o arquivo como fonte de verdade aqui, e sempre que mudar, replicar/deployar no seu Supabase de produção (do jeito que você já está fazendo).

Sequência de implementação (passo-a-passo)
1. Ajustar somente o bloco de upsert no `case 'activate_plan_manual'`:
   - Criar `planPayloadFull` (com `activated_at` / `activated_by`)
   - Tentar `.upsert(planPayloadFull, { onConflict: 'email' })`
2. Se falhar e `upsertError.message` contiver “activated_at” + “schema cache”:
   - Criar `planPayloadFallback = { ...planPayloadFull }` removendo `activated_at` (e `activated_by` se necessário)
   - Rodar um segundo `.upsert(planPayloadFallback, { onConflict: 'email' })`
3. Se a tentativa 2 funcionar:
   - Responder `success: true` + `warning` informando que foi usado fallback
4. Se a tentativa 2 também falhar:
   - Manter `success: false`, `step: 'plan_upsert'` e devolver `details` + `hint`
5. Você copia/atualiza essa mesma mudança no seu Supabase de produção (como já fez) e testa novamente.

Critérios de aceite
- Em Produção, logado no Admin:
  - “Ativação Manual de Plano” não retorna mais erro bloqueando o fluxo
  - Se a coluna estiver realmente ausente/cache quebrado, o fallback deve permitir ativar mesmo assim
- Segurança mantida:
  - Sem admin role no backend do login → 403
  - Token inválido → 401
- Observabilidade:
  - Quando fallback acontecer, resposta traz `warning` e logs mostram que foi “fallback activated_at”.

Riscos/Trade-offs (explícitos)
- O fallback é um “destravador” para produção. O ideal é alinhar o schema do banco de produção para que `activated_at` exista e o cache esteja correto, pois esse campo é útil para auditoria.
