

# Plano Completo: Ativação de Planos — Manual, Por Compra e Visualização

## ✅ IMPLEMENTADO (29/01/2026)

### Correções Aplicadas

1. **`src/lib/patient-plan.ts`**: Refatorado para sempre consultar banco de PRODUÇÃO via `supabaseProduction`, busca direta por `email`
2. **`src/components/admin/UserRegistrationsTab.tsx`**: Corrigida comparação de data (DATE e TIMESTAMP) e remover plano usa `patient_email`
3. **`src/components/admin/ManualPlanActivationModal.tsx`**: Melhorado tratamento de erros

### Arquitetura Final
- A tabela `patient_plans` usa `email` como chave de referência (NOT NULL)
- Todas as buscas e operações são feitas por `email`, não por `id`
- O `id` da tabela é um UUID autônomo (não relacionado ao `patients.id`)

---

## Arquivos Autorizados

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/patient-plan.ts` | Refatorar para sempre consultar banco de **Produção** via `supabaseProduction`, tratar `plan_expires_at` como TIMESTAMP |
| `src/pages/AreaDoPaciente.tsx` | Usar `getPatientPlanByEmail` do arquivo corrigido |
| `src/components/admin/UserRegistrationsTab.tsx` | Corrigir comparação de data e envio de `patient_email` no remover plano |
| `src/components/admin/ManualPlanActivationModal.tsx` | Garantir payload correto e tratamento de erros detalhado |

---

## Detalhes Técnicos

### 1. `src/lib/patient-plan.ts` — Refatoração Completa

**Problema atual:**
- `getPatientPlan()` consulta Lovable Cloud via `supabase` (linhas 107-133)
- `getPatientPlanByEmail()` consulta Produção, mas não é usada em todos os lugares
- Comparação de data não considera timezone

**Correção:**

```typescript
// ÚNICA FUNÇÃO PÚBLICA - sempre consulta banco de PRODUÇÃO
export const getPatientPlan = async (email: string): Promise<PatientPlan | null> => {
  try {
    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!normalizedEmail) return null;
    
    // Data de hoje (início do dia UTC)
    const now = new Date();
    
    // Buscar plano DIRETO por email no banco de PRODUÇÃO
    const { data: plan, error } = await supabaseProduction
      .from('patient_plans')
      .select('id, plan_code, plan_expires_at, status, created_at, updated_at')
      .eq('email', normalizedEmail)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      console.error('[patient-plan] Erro:', error);
      return null;
    }

    if (!plan) {
      console.log('[patient-plan] Nenhum plano para:', email);
      return null;
    }

    // plan_expires_at vem como "2026-02-28 00:00:00+00"
    // Comparar considerando que expira no FIM do dia
    const expiresAt = new Date(plan.plan_expires_at);
    expiresAt.setUTCHours(23, 59, 59, 999); // Fim do dia
    
    if (expiresAt < now) {
      console.log('[patient-plan] Plano expirado:', email, plan.plan_expires_at);
      return null; // Expirado
    }

    console.log('[patient-plan] ✅ Plano ativo:', plan);
    return plan;
  } catch (error) {
    console.error('[patient-plan] Exception:', error);
    return null;
  }
};

// Alias para compatibilidade
export const getPatientPlanByEmail = getPatientPlan;

// Atualizar checkPatientPlanActive para usar a função corrigida
export const checkPatientPlanActive = async (email: string): Promise<PatientPlanStatus> => {
  const plan = await getPatientPlan(email);
  
  if (!plan?.plan_code || !plan?.plan_expires_at) {
    return { hasActivePlan: false, canBypassPayment: false };
  }

  return {
    hasActivePlan: true,
    planCode: plan.plan_code,
    planExpiresAt: plan.plan_expires_at,
    canBypassPayment: true,
  };
};
```

---

### 2. `src/pages/AreaDoPaciente.tsx` — Sem alterações necessárias

O arquivo já usa:
```typescript
const planData = await getPatientPlan(session.user.email);
```

Após corrigir `getPatientPlan()`, vai funcionar automaticamente.

---

### 3. `src/components/admin/UserRegistrationsTab.tsx` — Correções

**Problema 1:** Comparação de data (linha ~186-188)
```typescript
const expiresAt = plan?.plan_expires_at ? new Date(plan.plan_expires_at + 'T23:59:59') : null;
```
Isso falha se `plan_expires_at` já vier como TIMESTAMP ("2026-02-28 00:00:00+00").

**Correção:**
```typescript
// Tratar tanto DATE quanto TIMESTAMP
let expiresAt = null;
if (plan?.plan_expires_at) {
  expiresAt = new Date(plan.plan_expires_at);
  // Se for só DATE (YYYY-MM-DD), o JavaScript cria às 00:00 UTC
  // Ajustar para fim do dia para garantir validade no dia de expiração
  if (!plan.plan_expires_at.includes('T') && !plan.plan_expires_at.includes(' ')) {
    expiresAt.setUTCHours(23, 59, 59, 999);
  }
}
const isActive = expiresAt && expiresAt >= new Date() && plan?.status === 'active';
```

**Problema 2:** Remover plano envia `patient_id` (linha ~328-329)
```typescript
body: {
  operation: 'deactivate_plan_manual',
  patient_id: user.patientId  // ❌ Edge function espera patient_email
}
```

**Correção:**
```typescript
body: {
  operation: 'deactivate_plan_manual',
  patient_email: user.email  // ✅ Correto
}
```

---

### 4. `src/components/admin/ManualPlanActivationModal.tsx` — Melhorias

Verificar se o payload está correto:
```typescript
body: {
  operation: 'activate_plan_manual',
  patient_email: user.email,  // ✅
  patient_id: user.id,        // Opcional
  plan_code: planCode,
  duration_days: parseInt(durationDays),
  send_email: sendEmail
}
```

Adicionar log detalhado de erro:
```typescript
if (!data?.success) {
  const errorDetails = data?.details || data?.error || 'Erro desconhecido';
  const step = data?.step || 'unknown';
  toast.error(`[${step}] ${errorDetails}`);
  return;
}
```

---

## Ativação Automática por Compra

Os arquivos de edge functions (`mp-webhook`, `check-payment-status`, `reconcile-pending-payments`) **já estão corretos** e gravam em `patient_plans` com:
- `email`: obrigatório
- `plan_code`: SKU do plano
- `plan_expires_at`: calculado automaticamente
- `status`: 'active'

O único ajuste necessário é garantir que a **edge function deployada em produção** esteja atualizada com as correções de `patient-operations`. Você já fez deploy, então deve funcionar.

---

## Fluxo Final

```
[Área do Paciente - Tulio logado]
     ↓
getPatientPlan("t.giani@gmail.com")
     ↓
supabaseProduction.from('patient_plans').select().eq('email', 't.giani@gmail.com')
     ↓
Retorna: { plan_code: "BASIC", plan_expires_at: "2026-02-28 00:00:00+00", status: "active" }
     ↓
Compara: expiresAt (28/02/2026 23:59:59) >= now (29/01/2026)
     ↓
Retorna plano ativo → UI exibe "Plano Básico (válido até 28/02/2026)"
```

---

## Critérios de Aceite

1. Área do Paciente do Tulio mostra "Plano Básico" com data de validade
2. Aba Pacientes do Admin mostra badge verde "BASIC" para Tulio
3. Ativar plano via modal admin funciona sem erros
4. Remover plano via botão X funciona e badge desaparece
5. Comprar plano (recorrente ou não) ativa automaticamente

---

## Arquivos que NÃO serão alterados

- Edge functions (já estão corretas no Supabase de produção)
- `src/lib/supabase-production.ts` (já está correto)
- FAQ, serviços, preços, ou qualquer conteúdo

---

## Próximos Passos

1. **Aprovar este plano**
2. Eu aplico as alterações nos 4 arquivos
3. Você testa:
   - Atualizar página da Área do Paciente como Tulio
   - Ver aba Pacientes no Admin
   - Ativar/remover plano de outro usuário
   - Comprar um plano (teste)

