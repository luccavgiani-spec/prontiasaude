

# Correção: Adicionar change_plan e disable_plan ao AUTH_BYPASS_OPERATIONS

## Causa do 401

O erro 401 vem da **validação genérica** na linha 632-643, que roda **antes** de chegar nos cases `disable_plan` e `change_plan`. Essa validação usa `supabase.auth.getUser(token)` no Supabase de Produção, e como o token é do Cloud, falha com "Token inválido".

A correção dos cases individuais (que fizemos na última edição) está correta, mas nunca é alcançada porque o código é barrado antes.

```text
Linha 622: AUTH_BYPASS_OPERATIONS = ["upsert_patient", "activate_plan_manual", "ensure_patient", "admin_update_patient"]
                                     ❌ change_plan e disable_plan NÃO estão aqui

Linha 624-643: if (!AUTH_BYPASS_OPERATIONS.includes(body.operation)) {
                 // valida token via Produção --> FALHA 401 (nunca chega no case)
               }
```

## Correção (1 linha)

### `supabase/functions/patient-operations/index.ts` - Linha 622

```typescript
// ANTES:
const AUTH_BYPASS_OPERATIONS = ["upsert_patient", "activate_plan_manual", "ensure_patient", "admin_update_patient"];

// DEPOIS:
const AUTH_BYPASS_OPERATIONS = ["upsert_patient", "activate_plan_manual", "ensure_patient", "admin_update_patient", "change_plan", "disable_plan"];
```

Isso permite que essas operações passem pela validação genérica e cheguem nos seus respectivos `case`, onde a validação admin via Cloud (que já foi implementada na edição anterior) será executada corretamente.

## Apos a alteracao

Copiar novamente o conteudo atualizado de `patient-operations/index.ts` e redeployar no Supabase de Producao.

| Arquivo | Linha | Alteracao |
|---------|-------|-----------|
| `patient-operations/index.ts` | 622 | Adicionar `change_plan` e `disable_plan` ao array `AUTH_BYPASS_OPERATIONS` |

