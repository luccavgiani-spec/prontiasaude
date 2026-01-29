

# Plano Definitivo: Correção da Ativação e Visualização de Planos

## Resumo do problema

O código atual tenta:
1. **Gravar:** com `upsert(..., { onConflict: 'email' })` — **mas não existe coluna `email` na tabela**
2. **Buscar:** com `.eq('id', patientId)` — **mas o plano foi gravado com outro `id`**

Resultado: erro de schema cache e planos "invisíveis".

---

## Arquivos que serão modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/patient-operations/index.ts` | Corrigir `activate_plan_manual` para gravar `id = patient.id` (INSERT) |
| `supabase/functions/patient-operations/index.ts` | Corrigir `deactivate_plan_manual` para usar `id = patient_id` |
| `src/lib/patient-plan.ts` | Criar `getPatientPlanByEmail()` que busca `patients.id` primeiro, depois `patient_plans.id` |

---

## Detalhes técnicos das alterações

### 1. `patient-operations/index.ts` — `activate_plan_manual`

**Antes (linhas ~1272-1282):**
```typescript
const planPayload = {
  email: patient_email.toLowerCase().trim(),  // ❌ coluna não existe
  plan_code: plan_code,
  status: 'active',
  plan_expires_at: expiresAtDate,
  updated_at: new Date().toISOString()
};

const { error: upsertError } = await supabase
  .from('patient_plans')
  .upsert(planPayload, { onConflict: 'email' });  // ❌ coluna não existe
```

**Depois:**
```typescript
// Payload com APENAS as 6 colunas que existem
// Usando patient.id como chave primária do plano
const planPayload = {
  id: patient.id,  // ✅ patient_plans.id = patients.id
  plan_code: plan_code,
  status: 'active',
  plan_expires_at: expiresAtDate,
  updated_at: new Date().toISOString()
};

// Upsert usando 'id' como chave de conflito
const { error: upsertError } = await supabase
  .from('patient_plans')
  .upsert(planPayload, { onConflict: 'id' });  // ✅ id é a PK
```

### 2. `patient-operations/index.ts` — `deactivate_plan_manual`

**Antes (linhas ~1078-1084):**
```typescript
const { error: updateError } = await supabase
  .from('patient_plans')
  .update({ 
    status: 'cancelled',
    updated_at: new Date().toISOString()
  })
  .eq('id', patient_id);  // ⚠️ Isso está correto SE patient_id = patients.id
```

**Depois:** Manter como está, mas garantir que `patient_id` passado seja realmente `patients.id` (já está correto no frontend).

### 3. `src/lib/patient-plan.ts` — Nova função `getPatientPlanByEmail()`

**Estratégia:**
1. Receber `email` como parâmetro
2. Buscar `patients.id` pelo email no banco de **Produção**
3. Buscar `patient_plans` por `id = patients.id`
4. Retornar plano ativo (se existir)

**Código:**
```typescript
export const getPatientPlanByEmail = async (email: string): Promise<PatientPlan | null> => {
  try {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const todayStr = getTodayDateString();
    
    // Passo 1: Buscar patient.id pelo email
    const { data: patient, error: patientError } = await supabaseProduction
      .from('patients')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    
    if (patientError || !patient) {
      console.log('[patient-plan] Patient not found for email:', email);
      return null;
    }
    
    // Passo 2: Buscar plano ativo onde patient_plans.id = patients.id
    const { data: plan, error: planError } = await supabaseProduction
      .from('patient_plans')
      .select('id, plan_code, plan_expires_at, status, created_at, updated_at')
      .eq('id', patient.id)
      .eq('status', 'active')
      .gte('plan_expires_at', todayStr)
      .maybeSingle();
    
    if (planError) {
      console.error('[patient-plan] Error fetching plan:', planError);
      return null;
    }
    
    if (!plan) {
      console.log('[patient-plan] No active plan for patient:', patient.id);
      return null;
    }
    
    console.log('[patient-plan] Active plan found:', plan);
    return plan;
  } catch (error) {
    console.error('[patient-plan] Exception:', error);
    return null;
  }
};
```

### 4. Ajustar `getPatientPlanFromProduction()` 

Renomear/simplificar para usar a mesma lógica (busca por `patient.id` no banco de produção).

### 5. Ajustar `UserRegistrationsTab.tsx` (linha ~182)

Trocar:
```typescript
const plan = await getPatientPlanFromProduction(patient.id);
```
Para:
```typescript
const plan = await getPatientPlanByEmail(patient.email);
```

Isso garante que a busca funcione mesmo que `patients.id` seja diferente entre Lovable Cloud e Produção.

---

## Fluxo após correção

```
[Admin clica "Ativar Plano"]
     ↓
ManualPlanActivationModal envia: { patient_email, plan_code, duration_days }
     ↓
patient-operations:
  1. Busca patient.id pelo email no banco de produção
  2. Grava em patient_plans com id = patient.id
     ↓
[Admin lista Pacientes]
     ↓
getPatientPlanByEmail(patient.email):
  1. Busca patient.id pelo email
  2. Busca patient_plans.id = patient.id
  3. Retorna plano ativo
     ↓
UI exibe badge "✓ BASIC" corretamente
```

---

## Critérios de aceite

1. Ativar plano para `t.giani@gmail.com` pelo painel admin → sucesso
2. Listar pacientes → `t.giani@gmail.com` mostra badge verde com código do plano
3. Área do Paciente (logado como Tulio) → mostra plano ativo
4. Remover plano pelo botão X → status muda para `cancelled`, badge desaparece

---

## Próximos passos após aprovação

1. Aplicar alterações nos arquivos
2. Você copia a edge function para o Supabase de produção
3. Ativar plano do Tulio via SQL (imediato) ou pelo painel (após deploy)
4. Testar fluxo completo

