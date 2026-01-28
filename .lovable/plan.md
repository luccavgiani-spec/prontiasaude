
## 1) Diagnóstico (por que “volta a bugar”)

### A. O backend está recebendo chamadas “incompletas” no `schedule-redirect` (body vazio)
Você relatou que no site publicado a tentativa de emitir consulta manual volta com:

- **HTTP 500**
- payload: `{"ok":false,"error":"Unexpected end of JSON input"}`

No arquivo `supabase/functions/schedule-redirect/index.ts`, esse erro é exatamente o que acontece quando o código tenta executar `await req.json()` e o body vem **vazio ou inválido**. Ou seja: o backend está recebendo requisições para `schedule-redirect` onde, em algum momento, o **payload JSON não está chegando** (ou está chegando vazio).

Isso explica o “de novo”: não é um bug “do ClickLife”; é um bug **na fronteira UI → função** (requisição malformada/interrompida) e hoje o backend reage com 500.

### B. Compras aprovadas não processam → não gera consulta → não contabiliza em “Vendas”
Eu consultei o banco (ambiente de teste) e existe um padrão bem claro:

- Há vários registros em `pending_payments` com **SKU ITC6534** (Clínico Geral) com **status `approved` e `processed=false`** (ou seja: aprovou, mas não processou o fluxo).
- Exemplo encontrado:
  - `patient_email = karolinesoaresteixeira98@gmail.com`
  - `status = approved`
  - `processed = false`
  - `sku = ITC6534`

Se `processed` não vira `true`, normalmente:
1) o pós-pagamento (webhook ou polling) não executou direito, ou  
2) executou e falhou ao chamar/registrar `schedule-redirect`, ou  
3) executou e falhou antes de gravar métricas/appointment.

Como a aba de Vendas está baseada em dados de backend (appointments/metrics conforme o modelo atual), **se não cria appointment/métrica, não aparece em Vendas**.

### C. Falta de “blindagem” e observabilidade faz o problema reaparecer
Hoje existem dois problemas estruturais:
- **Falha frágil**: se `req.json()` falha, vira 500 genérico.
- **Sem “repair button” no painel**: quando um pagamento fica `approved` e `processed=false`, não há um caminho simples, rastreável e idempotente (1 clique) no painel para reprocessar.

Você pediu “concreto”: a resolução precisa atacar **(1) causa do payload vazio** e **(2) reprocessamento/garantia de processamento**.

---

## 2) Arquivos que serão modificados (conforme sua autorização)

1. `supabase/config.toml`  
2. `supabase/functions/schedule-redirect/index.ts`  
3. `supabase/functions/check-payment-status/index.ts`  
4. `supabase/functions/common/cors.ts`  
5. `src/components/admin/UserRegistrationsTab.tsx`  
6. `src/components/admin/SalesTab.tsx`

**Motivo (baseado no seu pedido):**
- corrigir emissão manual de consultas pelo painel
- corrigir compras aprovadas que não viram consulta nem entram em Vendas
- tornar o sistema “à prova de recaída” com fluxo de reprocessamento e erros mais explicativos

**Escopo exato:**
- robustez de parsing/validação (evitar 500 por body vazio)
- logs e respostas de erro mais informativas
- botão de reprocessar pagamentos no painel (idempotente)
- ajuste de configuração das funções necessárias (para estabilidade em produção)
- ajuste de CORS apenas para manter consistência (mesmo que o problema atual seja no site publicado, isso evita regressões em outros ambientes)

**Confirmação: Estas alterações estão explicitamente solicitadas?**  
SIM (você autorizou esses pontos e pediu a correção definitiva).

---

## 3) Correção concreta (passo a passo)

### Passo 1 — Tornar o `schedule-redirect` “não quebrável” por body vazio (elimina o 500 atual)
No `supabase/functions/schedule-redirect/index.ts`:

1) Trocar a leitura direta `await req.json()` por uma rotina segura:
- ler `await req.text()`
- se vier vazio → responder **400** com mensagem clara (ex.: “Payload ausente”)
- se JSON inválido → responder **400** com mensagem clara
- logar `origin`, `content-type`, `content-length` e um “request-id” gerado (para rastreio)

2) Adicionar validação explícita de campos mínimos:
- cpf, email, nome, telefone, sku, plano_ativo
- se faltar, responder **400** (não 500)

Resultado prático: você deixa de ver “500 Unexpected end of JSON input” e passa a ver **exatamente** o que está faltando — e o painel pode exibir isso.

### Passo 2 — Identificar por que o body está vindo vazio (instrumentação + retorno ao painel)
Ainda no `schedule-redirect`:
- incluir logs em início de request: método, headers relevantes e tamanho do body
- incluir no JSON de erro (apenas em modo seguro) um campo `debug_hint` com algo como:
  - “body vazio”
  - “content-type não é application/json”
  - “JSON inválido”
Assim, na próxima tentativa pelo painel, a gente confirma se é:
- bug no frontend enviando body,
- ou algo interceptando/removendo body,
- ou chamada sendo feita com método errado.

### Passo 3 — Estabilizar o pós-pagamento (para “approved + processed=false” não virar buraco)
No `supabase/functions/check-payment-status/index.ts`:

1) Mesmo padrão do Passo 1:
- parsing seguro do body
- validação de `payment_id` e/ou `order_id`

2) Garantia idempotente:
- se já existir `appointments(order_id)` → retornar `existing=true` e **marcar pending_payments.processed=true**
- se não existir, tentar processar e ao final:
  - marcar `pending_payments.status='approved'` quando MP confirmar
  - marcar `processed=true` apenas quando appointment/métrica estiver consistente (como a função já tenta fazer em alguns fluxos)

3) Melhorar retorno de erro para o painel:
- retornar `error_code` (ex.: `SCHEDULE_REDIRECT_FAILED`, `MP_FETCH_FAILED`, `MISSING_METADATA`)
- retornar `details` com mensagem curta para debug operacional

### Passo 4 — Ajuste de configuração das funções (para reduzir instabilidade operacional)
No `supabase/config.toml`:

- incluir explicitamente as funções críticas usadas nesses fluxos para não ficarem dependentes de default/ambiente.
- Em especial:
  - `schedule-redirect`
  - `check-payment-status`
(Se identificarmos que webhook também está falhando por configuração, adicionamos as entradas correspondentes numa segunda rodada, sem tocar no fluxo de pagamento em si.)

### Passo 5 — Corrigir “Carolina Bombardelli não encaminhou e não contou em Vendas” (resolução prática)
Você disse que tem o e-mail. Na implementação:

1) No `SalesTab.tsx`, adicionar uma ação “Reprocessar” que:
- busca em `pending_payments` pelo **email**
- lista as últimas N compras (order_id/payment_id/status/processed)
- para cada compra `approved` e `processed=false`, chama `check-payment-status` com `payment_id` e `order_id`

2) Ao finalizar:
- se gerar `redirect_url`, o painel exibe e permite copiar
- se “existing=true”, marca como corrigido e evita duplicação
- se falhar, mostra erro detalhado (error_code + mensagem)

Isso resolve o caso da Carolina de forma concreta e repetível, sem “gambiarra manual” no banco.

### Passo 6 — Recuperar emissão manual de consulta no painel (fluxo rápido)
No `src/components/admin/UserRegistrationsTab.tsx`:
- melhorar mensagens de erro quando `schedule-redirect` responder 400/500:
  - mostrar no toast o `error` e (se existir) `debug_hint`
- opcional: antes de chamar, validar localmente que cpf/email/nome/telefone não estão vazios (para não mandar payload inválido)

### Passo 7 — CORS (preventivo para regressão)
No `supabase/functions/common/cors.ts`:
- manter a lista atual e garantir que o matcher cubra os domínios efetivamente usados nos diferentes ambientes
- garantir que `schedule-redirect` e `check-payment-status` sempre passem `req.headers.get('origin')` para `getCorsHeaders`

Mesmo você relatando o problema no site publicado, isso evita o “funciona hoje e quebra amanhã” quando alguém testa em outro ambiente.

---

## 4) Critérios de aceite (como vamos validar que ficou resolvido)

1) Painel admin → “Consulta Rápida”:
- não pode mais retornar 500 “Unexpected end of JSON input”
- se houver payload faltando, deve retornar 400 com mensagem objetiva
- se sucesso, deve abrir/copiar URL normalmente

2) Compra aprovada de Clínico Geral:
- ao aprovar (webhook ou reprocessamento), deve:
  - criar appointment (ou detectar existente)
  - marcar `pending_payments.processed=true`
  - aparecer em “Vendas”

3) Caso Carolina:
- com o e-mail, o painel deve:
  - localizar a compra
  - reprocessar
  - exibir URL de encaminhamento (ou indicar “já existia”)

---

## 5) Informação que vou precisar de você (para executar o Passo 5 exatamente)
- O **e-mail** usado na compra da Carolina Bombardelli (você já disse que tem; só me envie).

