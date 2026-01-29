

# Plano Definitivo Corrigido: Ativação e Visualização de Planos

## Diagnóstico Final

### Schema REAL da tabela `patient_plans` no banco de PRODUÇÃO (confirmado via API):
```
id              UUID (PK autônomo - NÃO é igual ao patients.id!)
user_id         UUID (nullable)
email           TEXT (NOT NULL!) ← CHAVE DE REFERÊNCIA
plan_code       TEXT (NOT NULL)
plan_expires_at TIMESTAMP
status          TEXT (default 'active')
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### Erro que você viu:
```
ERROR: 23502: null value in column "email" violates not-null constraint
```

Isso confirma que:
1. A coluna `email` EXISTE e é NOT NULL
2. O código da edge function estava enviando payload SEM email
3. A estratégia de usar `patient_plans.id = patients.id` estava ERRADA

### Por que o plano do Tulio não aparece:
- O código busca: `.eq('id', patient.id)` → NÃO encontra
- Deveria buscar: `.eq('email', patient.email)` → ENCONTRA

---

## Arquivos que precisam ser modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/patient-operations/index.ts` | Corrigir `activate_plan_manual` para incluir `email` no payload |
| `src/lib/patient-plan.ts` | Simplificar `getPatientPlanByEmail` para buscar DIRETO por email na tabela patient_plans |

---

## Alterações Detalhadas

### 1. Corrigir `patient-operations/index.ts` - `activate_plan_manual`

**Problema atual (linhas ~1275-1286):**
```typescript
const planPayload = {
  id: patient.id,  // ❌ Força id = patient.id (não funciona com dados existentes)
  plan_code: plan_code,
  status: 'active',
  plan_expires_at: expiresAtDate,
  updated_at: new Date().toISOString()
  // ❌ FALTA: email (NOT NULL)
};

const { error: upsertError } = await supabase
  .from('patient_plans')
  .upsert(planPayload, { onConflict: 'id' });  // ❌ Conflito errado
```

**Correção:**
```typescript
// Payload com email (obrigatório) - deixa id ser gerado automaticamente
// Upsert por email, que é a chave de referência no banco de produção
const planPayload = {
  email: patient_email.toLowerCase().trim(),  // ✅ OBRIGATÓRIO
  user_id: patient.user_id || null,           // ✅ Opcional mas útil
  plan_code: plan_code,
  status: 'active',
  plan_expires_at: expiresAtDate,
  updated_at: new Date().toISOString()
};

// Precisa verificar se já existe plano para esse email
const { data: existingPlan } = await supabase
  .from('patient_plans')
  .select('id')
  .eq('email', patient_email.toLowerCase().trim())
  .maybeSingle();

if (existingPlan) {
  // UPDATE do plano existente
  const { error: updateError } = await supabase
    .from('patient_plans')
    .update({
      plan_code: plan_code,
      status: 'active',
      plan_expires_at: expiresAtDate,
      user_id: patient.user_id || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', existingPlan.id);
  
  if (updateError) throw updateError;
} else {
  // INSERT de novo plano
  const { error: insertError } = await supabase
    .from('patient_plans')
    .insert({
      email: patient_email.toLowerCase().trim(),
      user_id: patient.user_id || null,
      plan_code: plan_code,
      status: 'active',
      plan_expires_at: expiresAtDate
    });
  
  if (insertError) throw insertError;
}
```

### 2. Simplificar `src/lib/patient-plan.ts` - `getPatientPlanByEmail`

**Problema atual:**
```typescript
// Busca patient.id primeiro, depois busca patient_plans.id = patient.id
// NÃO FUNCIONA porque os IDs são diferentes!
const { data: patient } = await supabaseProduction.from('patients').select('id')...
const { data: plan } = await supabaseProduction.from('patient_plans')
  .eq('id', patient.id)  // ❌ ERRADO
```

**Correção - busca DIRETA por email:**
```typescript
export const getPatientPlanByEmail = async (email: string): Promise<PatientPlan | null> => {
  try {
    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!normalizedEmail) {
      console.log('[patient-plan-production] Email vazio');
      return null;
    }
    
    const todayStr = getTodayDateString();
    
    // BUSCA DIRETA: email na tabela patient_plans
    // (email é a chave de referência no banco de produção)
    const { data: plan, error: planError } = await supabaseProduction
      .from('patient_plans')
      .select('id, plan_code, plan_expires_at, status, created_at, updated_at')
      .eq('email', normalizedEmail)  // ✅ CORRETO: busca por email
      .eq('status', 'active')
      .gte('plan_expires_at', todayStr)
      .maybeSingle();

    if (planError) {
      console.error('[patient-plan-production] Erro ao buscar plan:', planError);
      return null;
    }

    if (!plan) {
      console.log('[patient-plan-production] Nenhum plano ativo para email:', normalizedEmail);
      return null;
    }

    console.log('[patient-plan-production] Plano ativo encontrado:', plan);
    return plan;
  } catch (error) {
    console.error('[patient-plan-production] Exception:', error);
    return null;
  }
};
```

### 3. Atualizar `deactivate_plan_manual` na edge function

**Correção:**
```typescript
case 'deactivate_plan_manual': {
  const { patient_email } = body;
  
  // Buscar plano pelo EMAIL (não por id)
  const { error: updateError } = await supabase
    .from('patient_plans')
    .update({ 
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('email', patient_email.toLowerCase().trim());  // ✅ Por email
  
  if (updateError) {
    return new Response(JSON.stringify({ success: false, error: updateError.message }), ...);
  }
  
  return new Response(JSON.stringify({ success: true }), ...);
}
```

### 4. Atualizar memória de arquitetura

Preciso corrigir a memória `patient-plans-lookup-strategy` para refletir:
- A tabela `patient_plans` no banco de PRODUÇÃO usa `email` como chave de referência
- O `id` é um UUID autônomo (não é igual ao `patients.id`)
- Todas as operações de busca/update devem usar `.eq('email', email)`

---

## Fluxo Correto Após as Correções

```
[Admin clica "Ativar Plano para t.giani@gmail.com"]
     ↓
ManualPlanActivationModal envia: { patient_email: "t.giani@gmail.com", plan_code: "BASIC", ... }
     ↓
patient-operations (activate_plan_manual):
  1. Busca patient por email (para pegar user_id se existir)
  2. Verifica se já existe plano para esse email
     - SIM → UPDATE com plan_code, status='active', plan_expires_at
     - NÃO → INSERT com email, user_id, plan_code, status, plan_expires_at
     ↓
[Admin lista Pacientes]
     ↓
getPatientPlanByEmail("t.giani@gmail.com"):
  SELECT * FROM patient_plans WHERE email = 't.giani@gmail.com' AND status = 'active' AND plan_expires_at >= hoje
     ↓
UI exibe badge "✅ BASIC" corretamente
```

---

## Ação Imediata para Ativar Plano do Tulio

Enquanto eu implemento as correções, você pode rodar este SQL CORRETO no banco de produção:

```sql
-- UPDATE (o registro já existe com email t.giani@gmail.com)
UPDATE patient_plans 
SET 
  plan_code = 'BASIC',
  status = 'active',
  plan_expires_at = CURRENT_DATE + INTERVAL '30 days',
  updated_at = NOW()
WHERE email = 't.giani@gmail.com';

-- Se não existir, fazer INSERT:
INSERT INTO patient_plans (email, plan_code, status, plan_expires_at)
VALUES ('t.giani@gmail.com', 'BASIC', 'active', CURRENT_DATE + INTERVAL '30 days')
ON CONFLICT (email) DO UPDATE SET
  plan_code = 'BASIC',
  status = 'active',
  plan_expires_at = CURRENT_DATE + INTERVAL '30 days',
  updated_at = NOW();
```

---

## Critérios de Aceite

1. Ativar plano pelo modal admin → sucesso (sem erro NOT NULL)
2. Listar pacientes → Tulio mostra badge "BASIC" verde
3. Área do Paciente (logado como Tulio) → mostra plano ativo
4. Remover plano pelo botão X → status muda para 'cancelled'

---

## Atualização de Memória Necessária

Após implementar, devo atualizar a memória `patient-plans-lookup-strategy` para:
- Refletir que `email` é a chave de referência (NOT NULL)
- Remover a estratégia incorreta de `patient_plans.id = patients.id`

