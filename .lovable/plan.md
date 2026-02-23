

# Correcao: Listagem Incompleta e Lenta de Pacientes

## Problema Identificado

Duas causas raiz:

### 1. N+1 Queries (Performance)
Ao receber 1117 usuarios da Edge Function, o frontend executa `getPatientPlanByEmail()` **individualmente para cada um** (1117 consultas ao banco de Producao). Isso:
- Sobrecarrega o connection pool do banco
- Causa timeouts parciais (alguns usuarios podem "sumir")
- Torna o carregamento inicial extremamente lento (30-60+ segundos)

### 2. Pacientes sem conta auth ficam invisiveis
A Edge Function `list-all-users` busca apenas `auth.users` e depois enriquece com dados de `patients`. Pacientes que foram cadastrados diretamente na tabela `patients` (sem conta em `auth.users`) nao aparecem na listagem.

## Solucao

### Etapa 1: Batch query para planos (eliminar N+1)

**Arquivo:** `src/components/admin/UserRegistrationsTab.tsx`

Substituir o `Promise.all` com 1117 chamadas individuais por UMA unica query batch:

```typescript
// ANTES (N+1): 1117 chamadas individuais
const allUsers = await Promise.all(
  response.users.map(async (u) => {
    const plan = await getPatientPlanByEmail(u.email); // 1 query por usuario
    ...
  })
);

// DEPOIS (batch): 1 unica query
const emails = response.users.map(u => u.email?.toLowerCase()).filter(Boolean);
const { data: allPlans } = await supabaseProduction
  .from('patient_plans')
  .select('email, plan_code, plan_expires_at, status')
  .in('email', emails)
  .eq('status', 'active');

// Criar mapa email -> plano
const planMap = new Map();
for (const plan of allPlans || []) {
  planMap.set(plan.email?.toLowerCase(), plan);
}

// Transformar usuarios usando o mapa (sem queries adicionais)
const allUsers = response.users.map((u) => {
  const plan = planMap.get(u.email?.toLowerCase());
  // ... montar User sincronamente
});
```

**Resultado:** De 1117 queries para 1 query. Carregamento cai de 30-60s para 2-3s.

### Etapa 2: Adicionar funcao batch no patient-plan.ts

**Arquivo:** `src/lib/patient-plan.ts`

Adicionar funcao `getPatientPlansBatch(emails: string[])` que faz uma unica query com `.in('email', emails)` e retorna um `Map<string, PatientPlan>`.

**Nota sobre limite de 1000 rows:** A query `.in()` do Supabase tem limite de 1000 itens. Como temos 1117 usuarios, a funcao vai dividir em chunks de 500 emails e fazer 2-3 queries em paralelo (ainda muito melhor que 1117).

## Escopo

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/patient-plan.ts` | Adicionar `getPatientPlansBatch()` com chunking |
| `src/components/admin/UserRegistrationsTab.tsx` | Substituir N+1 `Promise.all` por batch query |

Nenhum outro arquivo sera alterado.

## Resultado Esperado

- Carregamento inicial: de 30-60s para 2-3s
- Todos os 1117 usuarios aparecem corretamente
- Busca por nome/email/CPF funciona instantaneamente (ja implementado no cache local)
- Sem risco de timeout ou perda parcial de dados

