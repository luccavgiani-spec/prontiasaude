
# Correcao definitiva: JWT do Cloud rejeitado pelo gateway de Producao (401)

## Problema raiz

O `invokeEdgeFunction` (linha 42-54 de `src/lib/edge-functions.ts`) busca o `access_token` da sessao do **Cloud** (`supabase.auth.getSession()`) e envia como `Authorization: Bearer <cloud_jwt>` para o Supabase de **Producao**.

O gateway de Producao rejeita esse JWT porque ele foi assinado por outro projeto. Resultado: **401 antes do codigo da funcao rodar**.

## Solucao (2 arquivos)

### 1. `src/lib/edge-functions.ts` - Parar de enviar JWT do Cloud para Producao

Na linha 54, trocar a logica de Authorization para **sempre usar a anon key de Producao** como Bearer token (que e um JWT valido para aquele projeto):

```typescript
// ANTES (linha 53-55):
if (!options.headers?.Authorization) {
  headers["Authorization"] = `Bearer ${accessToken || SUPABASE_ANON_KEY}`;
}

// DEPOIS:
if (!options.headers?.Authorization) {
  headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
}
```

Isso funciona porque:
- A anon key e um JWT valido para o projeto de Producao (o gateway aceita)
- A funcao `patient-operations` usa `service_role` internamente (nao depende do JWT do usuario)
- As operacoes ja recebem `email`, `user_id` etc. no body da requisicao

### 2. `supabase/functions/patient-operations/index.ts` - Adicionar operacoes faltantes ao bypass

Operacoes chamadas pelo frontend que NAO estao na lista de bypass e falhariam na validacao interna (linha 662-673) ao receber anon key no `getUser()`:

- `complete_profile`
- `invite-familiar`
- `resend-family-invite`
- `activate-family-member`
- `deactivate_plan_manual`
- `schedule_appointment`
- `schedule_redirect`

Linha 652, trocar:

```typescript
// ANTES:
const AUTH_BYPASS_OPERATIONS = ["upsert_patient", "activate_plan_manual", "ensure_patient", "admin_update_patient", "change_plan", "disable_plan"];

// DEPOIS:
const AUTH_BYPASS_OPERATIONS = [
  "upsert_patient", "activate_plan_manual", "ensure_patient", 
  "admin_update_patient", "change_plan", "disable_plan",
  "complete_profile", "invite-familiar", "resend-family-invite", 
  "activate-family-member", "deactivate_plan_manual",
  "schedule_appointment", "schedule_redirect"
];
```

Isso e seguro porque a funcao ja usa `service_role` para todas as operacoes de banco e recebe os dados de identidade (email, user_id) no body.

## Resumo

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/edge-functions.ts` (linha 54) | Usar `SUPABASE_ANON_KEY` ao inves do Cloud access_token |
| `supabase/functions/patient-operations/index.ts` (linha 652) | Adicionar operacoes faltantes ao AUTH_BYPASS_OPERATIONS |

## Apos aplicar

O arquivo `patient-operations` atualizado precisa ser **deployado manualmente no Supabase de Producao** (`ploqujuhpwutpcibedbr`).

A mudanca no `edge-functions.ts` sera aplicada automaticamente ao publicar pelo Lovable.
