

# Plano Definitivo: Correção da Ativação e Visualização de Planos

## ✅ STATUS: IMPLEMENTADO

---

## Resumo do problema (RESOLVIDO)

O código antigo tentava:
1. **Gravar:** com `upsert(..., { onConflict: 'email' })` — **mas não existe coluna `email` na tabela**
2. **Buscar:** com `.eq('id', patientId)` — **mas o plano foi gravado com outro `id`**

---

## Correções aplicadas

### 1. `supabase/functions/patient-operations/index.ts` — `activate_plan_manual`

**Correção aplicada:**
```typescript
const planPayload = {
  id: patient.id,  // ✅ patient_plans.id = patients.id
  plan_code: plan_code,
  status: 'active',
  plan_expires_at: expiresAtDate,
  updated_at: new Date().toISOString()
};

const { error: upsertError } = await supabase
  .from('patient_plans')
  .upsert(planPayload, { onConflict: 'id' });  // ✅ id é a PK
```

### 2. `src/lib/patient-plan.ts` — Nova função `getPatientPlanByEmail()`

**Estratégia:**
1. Receber `email` como parâmetro
2. Buscar `patients.id` pelo email no banco de **Produção**
3. Buscar `patient_plans` por `id = patients.id`
4. Retornar plano ativo (se existir)

### 3. `src/components/admin/UserRegistrationsTab.tsx`

**Correção aplicada:**
```typescript
const plan = await getPatientPlanByEmail(patient.email || '');
```

---

## Próximos passos

1. ✅ Alterações aplicadas no código
2. ⏳ **VOCÊ** copia a edge function `patient-operations` para o Supabase de produção
3. ⏳ Ativar plano do Tulio via painel admin OU via SQL:

```sql
-- Primeiro, pegar o patients.id do Tulio
SELECT id FROM patients WHERE email = 't.giani@gmail.com';

-- Depois, gravar plano (substitua pelo ID correto)
INSERT INTO patient_plans (id, plan_code, status, plan_expires_at, updated_at)
VALUES (
  '4dc4bc72-6cc4-430b-9276-74228be8ed9c',  -- patients.id
  'BASIC',
  'active',
  CURRENT_DATE + INTERVAL '30 days',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  plan_code = 'BASIC',
  status = 'active',
  plan_expires_at = CURRENT_DATE + INTERVAL '30 days',
  updated_at = NOW();
```

4. ⏳ Testar fluxo completo

---

## Critérios de aceite

1. Ativar plano para `t.giani@gmail.com` pelo painel admin → sucesso
2. Listar pacientes → `t.giani@gmail.com` mostra badge verde com código do plano
3. Área do Paciente (logado como Tulio) → mostra plano ativo
4. Remover plano pelo botão X → status muda para `cancelled`, badge desaparece
