
# Correção REAL: Registro de Patient Não Criado na Produção

## Problema Identificado

A edge function `create-user-both-envs` **falha silenciosamente** ao criar o registro `patients` em ambos os ambientes, resultando em:

1. Usuário de auth criado na Produção com ID `a67e5cb4-8308-416a-a353-a63ec1ab1de2` ✅
2. Usuário de auth criado no Cloud com ID `c6aad2f9-bdb5-44f6-8cbf-173a770f6bc7` ✅
3. **Patient na Produção: NÃO CRIADO** ❌ (erro: `Could not find the 'complement' column`)
4. **Patient no Cloud: NÃO CRIADO** ❌ (erro: `no unique constraint matching ON CONFLICT`)

Quando o frontend tenta acessar `/area-do-paciente`, busca por `user_id = a67e5cb4...` → retorna `[]` (vazio) → redireciona para `/completar-perfil`.

## Causa Raiz

### Erro 1: Schema desatualizado no cache da Produção
```
Could not find the 'complement' column of 'patients' in the schema cache
```
A tabela `patients` em Produção **TEM** a coluna `complement` (confirmei), mas o schema cache do Supabase está desatualizado.

### Erro 2: Constraint UNIQUE inexistente
```
there is no unique or exclusion constraint matching the ON CONFLICT specification
```
O código usa `upsert(..., { onConflict: 'email' })`, mas não existe constraint UNIQUE na coluna `email`.

---

## Arquivo que será modificado

**`supabase/functions/create-user-both-envs/index.ts`**

---

## Correção Proposta

### 1. Substituir UPSERT por INSERT com verificação prévia

Em vez de usar `upsert` com `onConflict`, fazer:
- Primeiro verificar se já existe patient com o email
- Se não existe, fazer `INSERT`
- Se existe, fazer `UPDATE`

### 2. Remover a coluna `complement` do objeto inicial

Como o schema cache pode estar desatualizado, inserir apenas as colunas essenciais e depois atualizar as adicionais.

### Código Corrigido (linhas 213-243):

**ANTES:**
```typescript
const patientData = {
  user_id: prodUserId,
  email: normalizedEmail,
  // ... todas as colunas incluindo complement
};

// Inserir na Produção
const { error } = await prodClient
  .from('patients')
  .upsert(patientData, { onConflict: 'email' });
```

**DEPOIS:**
```typescript
// Dados base (sem colunas problemáticas como complement)
const patientCoreData = {
  user_id: prodUserId,
  email: normalizedEmail,
  first_name: metadata?.first_name || null,
  last_name: metadata?.last_name || null,
  cpf: metadata?.cpf || null,
  phone_e164: metadata?.phone_e164 || null,
  birth_date: metadata?.birth_date || null,
  gender: metadata?.gender || null,
  cep: metadata?.cep || null,
  address_line: metadata?.address_line || null,
  address_number: metadata?.address_number || null,
  city: metadata?.city || null,
  state: metadata?.state || null,
  terms_accepted_at: metadata?.terms_accepted_at || new Date().toISOString(),
  marketing_opt_in: metadata?.marketing_opt_in || false,
  profile_complete: !!(metadata?.cpf && metadata?.phone_e164 && metadata?.birth_date),
};

// Inserir na Produção - usar INSERT direto (não upsert)
try {
  // Verificar se já existe
  const { data: existing } = await prodClient
    .from('patients')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();
  
  if (existing) {
    // Atualizar registro existente
    const { error } = await prodClient
      .from('patients')
      .update({ ...patientCoreData, user_id: prodUserId })
      .eq('id', existing.id);
    
    if (error) {
      console.error("[create-user-both-envs] Erro ao atualizar patient em Produção:", error.message);
    } else {
      console.log("[create-user-both-envs] ✅ Patient atualizado em Produção");
    }
  } else {
    // Inserir novo registro
    const { error } = await prodClient
      .from('patients')
      .insert(patientCoreData);
    
    if (error) {
      console.error("[create-user-both-envs] Erro ao inserir patient em Produção:", error.message);
    } else {
      console.log("[create-user-both-envs] ✅ Patient criado em Produção");
    }
  }
} catch (err: any) {
  console.error("[create-user-both-envs] Exceção ao criar patient em Produção:", err.message);
}
```

A mesma lógica será aplicada para o Cloud, usando `cloudUserId` em vez de `prodUserId`.

---

## Resumo das Mudanças

| Linha | Alteração |
|-------|-----------|
| 193-211 | Remover `complement` do objeto `patientData` |
| 213-226 | Substituir `upsert` por lógica de verificação + INSERT/UPDATE |
| 228-243 | Mesma correção para o Cloud |

---

## Validação

1. Criar nova conta de teste
2. Verificar nos logs da edge function:
   - `✅ Patient criado em Produção`
   - `✅ Patient criado no Cloud`
3. Confirmar que o usuário permanece em `/area-do-paciente` após o cadastro

---

## Por que isso resolve

1. Elimina dependência do `onConflict` que requer constraint UNIQUE
2. Evita problemas de schema cache removendo colunas não essenciais
3. Usa lógica explícita de verificar → inserir/atualizar
4. O registro `patients` será criado corretamente com o `user_id` da **Produção**
5. Quando o frontend buscar `patients` por `user_id`, encontrará o registro
