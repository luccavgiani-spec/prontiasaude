
# Plano de Correção Definitiva: Bugs de Ativação de Planos

## Diagnóstico Confirmado

Após análise detalhada das edge functions e banco de dados, identifiquei **3 bugs críticos** que causam falha na visualização de planos pelos pacientes:

---

## Bug #1: `user_id` não é propagado corretamente em `check-payment-status` e `reconcile-pending-payments`

### Problema
Quando um plano é criado via `check-payment-status` (linhas 371-383), o código busca apenas `patient_id` pelo email mas **NÃO busca o `user_id`** da tabela `patients`:

```typescript
// CÓDIGO ATUAL (BUGADO) - check-payment-status linha 371
const { error: planError } = await supabaseAdmin
  .from('patient_plans')
  .insert({
    email: patientEmail,
    patient_id: patientId,  // ✅ Busca patient_id
    plan_code: sku,
    // ❌ user_id FALTANDO!
  });
```

O mesmo problema existe em `reconcile-pending-payments` (linhas 231-243).

### Impacto Atual
- **29.17% dos planos ativos** (7 de 24) estão com `user_id = NULL`
- A política RLS `(user_id = auth.uid())` bloqueia esses planos na tela do paciente
- 3 planos podem ser corrigidos imediatamente pois o `patients.user_id` existe

### Correção
Adicionar busca do `user_id` junto com `patient_id`:

```typescript
// CÓDIGO CORRIGIDO
const { data: patientData } = await supabaseAdmin
  .from('patients')
  .select('id, user_id')  // ✅ Buscar user_id também
  .eq('email', patientEmail)
  .maybeSingle();

const patientId = patientData?.id || null;
const userId = patientData?.user_id || null;  // ✅ NOVO

const { error: planError } = await supabaseAdmin
  .from('patient_plans')
  .insert({
    email: patientEmail,
    patient_id: patientId,
    user_id: userId,  // ✅ INCLUIR user_id
    plan_code: sku,
    ...
  });
```

---

## Bug #2: `processed = false` mesmo após appointment criado com sucesso

### Problema
Temos **13 pagamentos aprovados com `processed = false`** onde 12 deles já possuem appointments criados. Isso significa que o flag não está sendo atualizado corretamente após o processamento bem-sucedido.

A causa raiz está em race conditions:
1. Frontend chama `check-payment-status` (cria appointment)
2. Webhook `mp-webhook` chega depois (tenta criar novamente)
3. Ambos verificam `processed = false` ao mesmo tempo
4. Um deles falha silenciosamente por duplicação mas não atualiza o flag

### Impacto
- Cron job `reconcile-pending-payments` reprocessa pagamentos desnecessariamente
- Dashboard de vendas pode mostrar dados inconsistentes

### Correção
Garantir que **ambos os caminhos** (webhook e polling) marquem `processed = true` mesmo em cenários de duplicação:

```typescript
// Em ambas as funções, ANTES de retornar por duplicação:
if (existingAppointment) {
  // ✅ SEMPRE atualizar flag mesmo se já existe
  await supabaseAdmin
    .from('pending_payments')
    .update({ 
      processed: true, 
      processed_at: new Date().toISOString(),
      status: 'approved'
    })
    .eq('order_id', orderId);
  
  return { existing: true, ... };
}
```

---

## Bug #3: `mp-webhook` usa `patient_id` como `user_id` (confusão de IDs)

### Problema
No `mp-webhook` linha 900-901:
```typescript
userId = existingPatient.id;  // ❌ ERRADO! Isso é patient_id, não user_id
```

O código confunde `patients.id` (UUID do registro em patients) com `patients.user_id` (UUID do auth.users).

### Correção
Buscar corretamente o `user_id`:

```typescript
const { data: existingPatient } = await supabaseAdmin
  .from('patients')
  .select('id, user_id, email')  // ✅ Incluir user_id
  .eq('email', schedulePayload.email)
  .maybeSingle();

if (existingPatient) {
  const patientId = existingPatient.id;     // UUID de patients
  const userId = existingPatient.user_id;   // UUID de auth.users ✅
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/check-payment-status/index.ts` | Buscar `user_id` e incluir no insert de `patient_plans` |
| `supabase/functions/reconcile-pending-payments/index.ts` | Mesmo fix acima |
| `supabase/functions/mp-webhook/index.ts` | Corrigir confusão `id` vs `user_id` |

---

## Correção de Dados Existentes (SQL)

Após as correções de código, executar backfill para corrigir planos existentes:

```sql
-- 1. Corrigir patient_plans com user_id NULL mas que podem ser vinculados
UPDATE patient_plans pp
SET user_id = p.user_id
FROM patients p
WHERE pp.email = p.email
  AND pp.user_id IS NULL
  AND p.user_id IS NOT NULL;

-- 2. Marcar como processed os pagamentos aprovados que já tem appointment
UPDATE pending_payments pp
SET 
  processed = true,
  processed_at = NOW()
FROM appointments a
WHERE a.order_id = pp.order_id
  AND pp.status = 'approved'
  AND pp.processed = false;
```

---

## Resultado Esperado

Após implementação:
1. **100% dos novos planos** terão `user_id` preenchido
2. **Planos existentes bugados** serão corrigidos via SQL
3. **Flag `processed`** será consistente em todos os cenários
4. **Pacientes verão seus planos** na Área do Paciente sem erros de RLS
