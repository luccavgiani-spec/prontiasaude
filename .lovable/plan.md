

# Correcao: Modal de Ativacao Manual + Tabela de Planos ClickLife

## Problema

1. O modal `ManualPlanActivationModal` usa 3 planos fictícios (BASIC, PREMIUM, FAMILY) que nao existem no sistema
2. A ativacao manual nao aciona a ClickLife
3. Os mapeamentos de plano para ClickLife em **4 edge functions** nao diferenciam planos FAMILIARES (que usam IDs 1237/1238) de INDIVIDUAIS (863/864)

## Tabela de Mapeamento Correta

| Tipo de Plano | ClickLife plan_id |
|---|---|
| Individual SEM especialista | 863 |
| Individual COM especialista | 864 |
| Familiar SEM especialista | **1237** |
| Familiar COM especialista | **1238** |
| Empresarial | 864 |
| Servico avulso (sem plano) | 864 |

---

## Arquivos a Alterar

### 1. `src/components/admin/ManualPlanActivationModal.tsx`

- Substituir array mock `planSkus` pelos planos reais do `PLANOS` (constants.ts), filtrando o Empresarial (preco 0)
- Adicionar funcao de mapeamento ClickLife com a regra FAMILIAR vs INDIVIDUAL
- Apos sucesso da ativacao local, chamar `invokeEdgeFunction('activate-clicklife-manual')` com o `plan_id` correto
- Expandir interface `user` para incluir `phone`, `gender`, `birth_date`

### 2. `src/components/admin/UserRegistrationsTab.tsx`

- Passar `phone`, `gender` e `birth_date` do paciente ao modal

### 3. `supabase/functions/mp-webhook/index.ts`

- Linha ~1074: alterar mapeamento para diferenciar FAMILIAR
- De: `COM_ESP ? 864 : SEM_ESP ? 863 : 864`
- Para: `FAM_COM_ESP ? 1238 : FAM_SEM_ESP ? 1237 : COM_ESP ? 864 : SEM_ESP ? 863 : 864`
- Aplicar mesma logica nas outras ocorrencias hardcoded (linhas ~1410, ~1477, ~1742)

### 4. `supabase/functions/reconcile-pending-payments/index.ts`

- Linha ~271: mesma correcao de mapeamento FAMILIAR

### 5. `supabase/functions/schedule-redirect/index.ts`

- Linha ~128-138: o array `PLANOS_COM_ESPECIALISTAS` mistura Individual e Familiar no mesmo grupo (todos apontam 864). Precisa separar e usar funcao que retorne 864 para IND e 1238 para FAM
- Ajustar a logica de `getClickLifePlanId()` (se existir) ou criar uma

### 6. `supabase/functions/activate-clicklife-manual/index.ts`

- Nao precisa de alteracao estrutural (ja recebe `plan_id` como parametro), mas o fallback default `plan_id || 864` deve considerar que o caller agora envia o ID correto

---

## Detalhes Tecnicos

### Funcao centralizada de mapeamento (usada no modal e nas edge functions):

```typescript
function getClickLifePlanId(planCode: string): number {
  if (planCode.includes('FAM') || planCode.includes('FAMILIAR')) {
    return planCode.includes('COM_ESP') || planCode.includes('COM_ESPECIALISTA') ? 1238 : 1237;
  }
  if (planCode.includes('COM_ESP') || planCode.includes('COM_ESPECIALISTA')) return 864;
  if (planCode.includes('SEM_ESP') || planCode.includes('SEM_ESPECIALISTA')) return 863;
  if (planCode.startsWith('EMPRESA')) return 864;
  return 864; // fallback para servicos avulsos
}
```

### Modal - planos reais:

```typescript
const planSkus = PLANOS
  .filter(p => p.precoMensal["1"] > 0) // Exclui Empresarial
  .map(p => ({
    sku: p.code,
    nome: p.nome,
    preco: Math.round(p.precoMensal["1"] * 100),
    clicklifePlanId: getClickLifePlanId(p.code)
  }));
```

### Modal - ativacao ClickLife apos sucesso:

```typescript
if (data?.success && user.cpf) {
  const clicklifePlanId = getClickLifePlanId(planCode);
  await invokeEdgeFunction('activate-clicklife-manual', {
    body: {
      email: user.email,
      cpf: user.cpf,
      plan_id: clicklifePlanId,
      nome: user.name,
      telefone: user.phone,
      sexo: user.gender,
      dataNascimento: user.birth_date,
      skip_db_lookup: false
    }
  });
}
```

### UserRegistrationsTab - props extras:

```typescript
user={{
  id: selectedUser.patientId || selectedUser.id,
  email: selectedUser.email,
  name: `${selectedUser.patient?.first_name || ''} ${selectedUser.patient?.last_name || ''}`.trim(),
  cpf: selectedUser.patient?.cpf,
  phone: selectedUser.patient?.phone_e164,      // NOVO
  gender: selectedUser.patient?.gender,          // NOVO
  birth_date: selectedUser.patient?.birth_date,  // NOVO
  currentPlan: ...
}}
```

---

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `ManualPlanActivationModal.tsx` | Planos reais + ClickLife + mapeamento FAMILIAR |
| `UserRegistrationsTab.tsx` | Passar phone/gender/birth_date ao modal |
| `mp-webhook/index.ts` | Mapeamento FAM 1237/1238 (4 ocorrencias) |
| `reconcile-pending-payments/index.ts` | Mapeamento FAM 1237/1238 |
| `schedule-redirect/index.ts` | Separar FAMILIAR de INDIVIDUAL no mapeamento |
| `patient-operations/index.ts` | Ja correto (1237/1238) - sem alteracao |

