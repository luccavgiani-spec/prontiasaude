
# Plano de Correção: Erro de FK no Cadastro + Erro 500 na Ativação Manual

## Problemas Identificados

### Problema 1: Cadastro de Pacientes (Monique - Screenshot)
**Erro:** `insert or update on table "patients" violates foreign key constraint "patients_user_id_fkey"`

**Causa:**
- Usuário foi criado na **Produção** via `hybridSignUp`
- Sessão está no cliente de Produção (`supabaseProductionAuth`)
- O arquivo `src/lib/patients.ts` usa `supabase` (Cloud) para salvar na tabela `patients`
- O `user_id` da Produção não existe em `auth.users` do Cloud → **FK violation**

### Problema 2: Ativação Manual de Planos (Admin)
**Erro:** `null value in column "id" of relation "patients" violates not-null constraint`

**Causa:**
- A edge function roda no Lovable Cloud
- Quando tenta criar registro em `patients` com `user_id` da Produção, viola FK
- O erro de FK é capturado mas sem fallback adequado

---

## Arquivos que serão modificados

1. `src/lib/patients.ts` - Tornar híbrido para usar cliente correto
2. `supabase/functions/patient-operations/index.ts` - Remover criação automática de paciente, usar apenas email

---

## Correção 1: `src/lib/patients.ts` (Frontend - Cadastro)

### Problema atual:
```typescript
const { data: sess } = await supabase.auth.getSession();  // ❌ Só verifica Cloud
// ...
await supabase.from('patients').insert(updateData);  // ❌ Sempre usa Cloud
```

### Solução:
Usar `getHybridSession()` para detectar o ambiente e usar o cliente correto:

```typescript
import { getHybridSession, supabaseProductionAuth } from "@/lib/auth-hybrid";
import { supabaseProduction } from "@/lib/supabase-production";

export async function upsertPatientBasic(payload: { ... }) {
  // ✅ HÍBRIDO: Detectar ambiente correto
  const { session, environment } = await getHybridSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;
  if (!userId) throw new Error('Sessão expirada. Faça login novamente.');

  // ✅ Usar cliente correto baseado no ambiente
  const dbClient = environment === 'production' ? supabaseProduction : supabase;
  
  // ... resto da lógica usando dbClient em vez de supabase
}
```

A função `ensurePatientRow` também precisa ser atualizada para aceitar o cliente correto como parâmetro.

---

## Correção 2: `supabase/functions/patient-operations/index.ts` (Backend - Ativação Manual)

### Problema atual (linhas 1291-1361):
```typescript
// TENTATIVA 3: Criar paciente automaticamente
const { data: newPatient, error: insertPatientErr } = await supabase
  .from('patients')
  .insert({
    email: normalizedPatientEmail,
    user_id: userIdToLink,  // ❌ user_id da Produção viola FK no Cloud
    // ...
  })
```

### Solução:
NÃO tentar criar paciente. Apenas prosseguir com ativação usando email:

```typescript
// TENTATIVA 3: Se não encontrou paciente, NÃO criar - apenas prosseguir
if (!patient) {
  console.log('[activate_plan_manual] 3️⃣ Paciente não existe em patients');
  console.log('[activate_plan_manual] ⚠️ Plano será ativado apenas pelo email');
  
  // Criar objeto "virtual" para compatibilidade
  patient = { id: null, user_id: null };
  patientLookupMethod = 'email_only_no_patient_record';
}

// Remover verificação que exige patient.id
// Ajustar upsert para usar patient.user_id apenas se existir
```

---

## Por que isso resolve

### Cadastro (Monique):
1. `upsertPatientBasic` detecta que a sessão está na Produção
2. Usa `supabaseProduction` para inserir/atualizar em `patients`
3. O `user_id` existe em `auth.users` da Produção → **Sem FK violation**

### Ativação Manual:
1. Se paciente não existe, não tenta criar (evita FK violation)
2. Ativa o plano usando apenas o `email` (que é a chave real em `patient_plans`)
3. O plano fica ativo e quando o usuário completar o cadastro, os dados serão vinculados

---

## Validação pós-implementação

### Teste Cadastro:
1. Criar novo usuário (cadastro)
2. Verificar que o perfil é salvo sem erro de FK
3. Verificar que dados aparecem na tabela `patients` da Produção

### Teste Ativação Manual:
1. No Admin → Pacientes → selecionar usuário
2. Ativar plano manualmente
3. Confirmar: retorna `success: true`, plano fica ativo

---

## Confirmação (conforme política interna)

1. **ARQUIVOS QUE SERÃO MODIFICADOS:**
   - `src/lib/patients.ts`
   - `supabase/functions/patient-operations/index.ts`

2. **MOTIVO:** 
   - Corrigir erro de FK no cadastro (Monique)
   - Corrigir erro 500 na ativação manual

3. **ESCOPO:** 
   - `patients.ts`: Usar cliente híbrido (Cloud/Produção) baseado na sessão
   - `patient-operations`: Remover criação automática de paciente, usar apenas email

4. **CONFIRMAÇÃO: "Estas alterações estão explicitamente solicitadas?"** SIM
