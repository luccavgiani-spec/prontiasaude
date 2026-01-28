
Contexto do erro (o que os logs provam)
- O erro recorrente é: `SyntaxError: Unexpected token '<' ... is not valid JSON` dentro de `registerClickLifePatient`.
- Isso acontece quando a API da ClickLife retorna HTML (geralmente uma página de erro) e o código tenta fazer `response.json()` (ou um parse sem “safe parsing”), causando crash e resultando em HTTP 500 genérico.
- O stack trace indica que a versão atualmente em execução do `schedule-redirect` (no backend de produção) ainda tem um ponto que faz parse direto como JSON nesse trecho do fluxo de cadastro.

Objetivo do ajuste (requisitos que você reforçou)
1) “Criar consulta” no Admin precisa conseguir gerar consulta mesmo se o paciente já estiver cadastrado/ativo na ClickLife. Ou seja: cadastro/ativação não podem bloquear a etapa de criação do atendimento.
2) “Criar consulta” deve sobrepor qualquer override global (sem mexer no botão de override). Ou seja: escolha manual do provedor no modal precisa ter prioridade máxima.

Arquivos que serão modificados
1) `supabase/functions/schedule-redirect/index.ts`
   - Motivo: corrigir crash de parse JSON (HTML vindo da ClickLife) e tornar cadastro/ativação “best-effort”, nunca bloqueando a criação do atendimento.
2) `src/components/admin/UserRegistrationsTab.tsx`
   - Motivo: garantir que o payload do “Criar consulta” sempre envie `force_provider` + `skip_registration` (e opcionalmente exibir melhor o erro retornado estruturado, caso ainda haja falha na criação do atendimento).
Confirmação: Estas alterações estão explicitamente solicitadas? SIM (você pediu tolerância a paciente já ativo + prioridade do “Criar consulta” sobre overrides).

Plano de implementação (passo a passo)

Fase A — Corrigir o 500 (crash) e tornar ClickLife tolerante a HTML
A1) Implementar um helper interno de “safe parsing” para qualquer resposta HTTP externa (ClickLife/Communicare) dentro de `schedule-redirect/index.ts`:
- Sempre ler `await res.text()`
- Tentar `JSON.parse(text)` dentro de try/catch
- Se falhar, retornar `{ ok: false, nonJson: true, preview: text.slice(0, N), contentType, status }`
Resultado: nunca mais teremos crash por “Unexpected token '<'…”.

A2) Aplicar esse helper especificamente no fluxo do `registerClickLifePatient`:
- No endpoint de cadastro (`/usuarios/usuarios`), parar de usar `res.json()` (se existir) e substituir por `res.text()` + safe parse.
- No endpoint de ativação (`/usuarios/ativacao`), idem.
- Se vier HTML, registrar log estruturado:
  - status code
  - content-type
  - preview do body (primeiros 200–500 chars)
  - request_id do schedule-redirect
E retornar um objeto de erro “não fatal” (ver A3).

A3) Tornar “cadastro/ativação” best-effort quando o objetivo final é criar atendimento:
- Ajustar a lógica para:
  - Se o cadastro falhar por “já cadastrado / duplicate key / já existe”, tratar como “ok” (soft success).
  - Se a ativação falhar por “já ativo” ou vier HTML/erro, não retornar 500: apenas logar warning e seguir.
- Importante: o bloqueio real deve acontecer somente se a criação do atendimento (`/atendimentos/atendimentos`) falhar.

Fase B — Garantir que “Criar consulta” sobreponha overrides e plano ativo
B1) Garantir prioridade máxima do `force_provider` no handler principal
- Confirmar (e, se necessário, mover) o bloco:
  - `if (payload.force_provider) { ... redirectClickLife/redirectCommunicare ... }`
- Esse bloco deve ocorrer antes de:
  - regra “plano ativo => ClickLife”
  - overrides em admin_settings
  - regras de horário/especialidade
Resultado: seleção manual do modal sempre vence.

B2) Garantir que `skip_registration: true` realmente pule cadastro/ativação para o caminho ClickLife
- Confirmar (e, se necessário, corrigir) que no `redirectClickLife` existe:
  - `if (payload.skip_registration) { ... } else { await registerClickLifePatient(...) }`
- Quando `skip_registration` estiver true:
  - nunca chamar `registerClickLifePatient`
  - ir direto para a criação do atendimento usando token do integrador (que é exatamente o que você quer: “basta chamar a parte que gera a consulta”).

B3) Communicare com `skip_registration`
- Manter a lógica: quando `skip_registration=true`, não tentar criar paciente; tentar buscar paciente existente por CPF e seguir.
- Se não encontrar patientId, retornar erro estruturado (não genérico) para o frontend.

Fase C — Garantir que o Admin está enviando os flags corretos (e melhorar diagnóstico)
C1) Verificar em `UserRegistrationsTab.tsx` que o payload do “Criar consulta” contém sempre:
- `force_provider: quickConsultProvider` (clicklife/communicare conforme seleção do modal)
- `skip_registration: true`
- `plano_ativo` pode continuar sendo enviado, mas não deve importar quando `force_provider` está presente.

C2) (Recomendado) Melhorar feedback no modal para não ficar “erro genérico”
- Quando a função retornar `{ ok: false, error, details, request_id, response_preview }`, exibir isso no modal (pelo menos `error` + `request_id`).
- Isso reduz retrabalho e acelera triagem caso a falha seja no endpoint de criação de atendimento, token expirado, etc.

Fase D — Validação (para fechar o loop das 4 tentativas falhando)
D1) Adicionar um “marcador de versão” nos logs do `schedule-redirect`
- Ex: `console.log("[schedule-redirect] VERSION: 2026-01-28T... / commit-like-tag")`
Objetivo: você confirmar no log que o backend está rodando o código novo.

D2) Testes manuais (end-to-end) no Admin (/admin/dashboard)
Executar 4 testes (e comparar logs por request_id):
1) Carolina + ClickLife + skip_registration=true
   - Esperado: pular cadastro/ativação e criar atendimento.
2) Carolina + Communicare (force_provider=communicare)
   - Esperado: ignorar override e plano ativo, gerar link/fluxo Communicare.
3) Outro paciente com plano ativo + Communicare forçado
   - Esperado: também gerar.
4) Paciente novo sem cadastro real em nenhum provedor
   - Esperado: ClickLife deve tentar criar atendimento; se falhar, retornar erro estruturado (sem crash), com preview do HTML se houver.

D3) Critério de aceite atualizado
- Não pode existir mais o crash “Unexpected token '<' … not valid JSON”.
- O botão “Criar consulta” deve conseguir:
  - gerar ClickLife mesmo com paciente já ativo
  - gerar Communicare mesmo com override ClickLife ativo e/ou plano ativo

Riscos/observações (importantes para não mascarar problemas reais)
- Mesmo com tolerância de cadastro/ativação, a criação do atendimento ClickLife pode falhar por:
  - token do integrador expirado (retorna 401/403)
  - instabilidade do backend da ClickLife (HTML 500)
Nesse caso, a correção garante que:
  - não haverá crash
  - o erro retornará estruturado e visível (sem “genérico”)
- Para Communicare, o risco é o endpoint de busca por CPF não retornar formato esperado; por isso o parsing precisa ser resiliente e com logs de preview.

O que eu preciso de você (para executar com segurança)
- Confirmação de que os logs que você colou são realmente do `schedule-redirect` do ambiente de produção (parece ser, pelo path do runtime).
- Se possível, em uma próxima rodada após aplicar as mudanças, você colar 1 log completo (com request_id) de:
  - 1 tentativa ClickLife
  - 1 tentativa Communicare
para validar que o `force_provider` e `skip_registration` estão sendo respeitados.

Implementação respeita seus requisitos
- “Mesmo já cadastrado/ativo”: cadastro/ativação vira “best-effort” e nunca impede criar atendimento.
- “Criar consulta deve subscrever override sem mexer no botão”: `force_provider` no payload será prioridade máxima no roteamento.
