

# Correcao Completa: Loop de Cadastro, Login e Listagem de Funcionarios

## Diagnostico dos 4 problemas raiz

### Problema 1: Loop infinito de "Completar Cadastro"

**Causa raiz**: Apos salvar o perfil com sucesso, `CompletarPerfil.tsx` (linha 660) faz `await supabase.auth.signOut()` para "limpar sessao Cloud". Porem, o usuario esta autenticado apenas via **Producao** (`supabaseProductionAuth`). O signOut do Cloud e inofensivo mas nao limpa a sessao de Producao. Em seguida, redireciona para `/area-do-paciente`.

Na pagina `/area-do-paciente`, o `requireAuth()` (em `auth.ts` linha 31) chama `getHybridSession()`. Como o `sessionStorage.auth_environment` foi setado como `production`, ele verifica `supabaseProductionAuth.auth.getSession()`. A sessao de Producao **ainda existe** (nunca foi limpa), entao o usuario e autenticado.

Porem, o `AuthCallback.tsx` (linha 105) usa `supabaseProduction` (o cliente SEM sessao, com `persistSession: false`) para consultar `patients.profile_complete`. Este cliente NAO tem sessao autenticada, entao a query com RLS retorna **nenhum dado** (RLS bloqueia leitura anonima). `patientData` fica `null`, e o redirect vai para `/completar-perfil` novamente -- criando o loop.

**Nota**: O mesmo problema ocorre no `getPatient()` em `auth.ts` linha 47 -- usa `supabaseProduction` (sem sessao) quando `auth_environment === 'production'`.

**Solucao**: No `AuthCallback.tsx`, quando `authEnvironment === 'production'`, usar `supabaseProductionAuth` (que TEM sessao persistente) em vez de `supabaseProduction` (que NAO tem sessao). Mesma correcao em `getPatient()`.

### Problema 2: Senha incorreta apos cadastro via convite

**Causa raiz**: O fluxo de convite empresarial faz:
1. `hybridSignUp` -> chama `create-user-both-envs` -> cria usuario em Cloud + Producao com a senha correta
2. Login automatico na Producao -> sessao ativa
3. `upsertPatientBasic` -> chama `patient-operations` com `upsert_patient` -> dentro da Edge Function, `createUser` tenta criar novamente com senha ALEATORIA

Quando `createUser` retorna "already exists", a senha original NAO e sobrescrita. Porem, o usuario so existe em **Producao** (logs confirmam: `existsInCloud: false, existsInProduction: true`).

O `hybridSignIn` detecta `loginEnvironment: 'production'` e tenta `supabaseProductionAuth.auth.signInWithPassword`. Se a senha correta foi usada, deveria funcionar.

**Possivel causa**: Apos o `CompletarPerfil.tsx` fazer signOut do Cloud (linha 660), o `sessionStorage.auth_environment` NAO e limpo. Quando o usuario tenta login novamente via `/entrar`, o `handleSuccessfulLogin` navega para `/auth/callback`, que verifica `patients.profile_complete` com `supabaseProduction` (sem sessao), recebe `null`, e redireciona para `/completar-perfil` -- reiniciando o ciclo.

**Solucao**: Corrigir o cliente usado nas queries de paciente (mesmo fix do Problema 1).

### Problema 3: Completar cadastro 2 vezes

**Causa raiz**: E consequencia direta do Problema 1. O perfil E salvo corretamente na primeira vez (via Edge Function `upsert_patient`), mas como o `AuthCallback` nao consegue LER o `profile_complete = true` (por usar cliente sem sessao), redireciona de volta para `/completar-perfil`.

**Solucao**: Mesmo fix do Problema 1.

### Problema 4: Funcionarios e convites nao aparecem + "Erro para carregar funcionarios"

**Causa raiz dupla**:

(A) `loadEmployees` e `loadPendingInvites` agora usam `supabaseProduction` corretamente. Porem, `supabaseProduction` tem `persistSession: false` e `autoRefreshToken: false` -- nao tem sessao autenticada. Se as tabelas `company_employees` e `pending_employee_invites` na Producao tem RLS que exige `auth.uid()`, a query retorna erro ou vazio.

(B) O `company.id` vem de `useCompanyAuth`, que consulta a tabela `companies` no **Cloud** via `supabase`. Se o UUID da empresa no Cloud for diferente do UUID na Producao (o que e provavel, ja que sao bancos independentes), a query `.eq('company_id', company.id)` na Producao nao encontra nada.

(C) `handleDelete` (linha 341) ainda usa `supabase` (Cloud) ao inves de `supabaseProduction`.

**Solucao**: Usar Edge Function `company-operations` com operacoes de listagem, OU ajustar `useCompanyAuth` para buscar dados da Producao. A opcao mais segura e criar operacoes `list-employees` e `list-pending-invites` na `company-operations` (que ja usa `service_role` e contorna RLS).

---

## Plano de correcoes

### Correcao 1: AuthCallback.tsx -- Usar cliente com sessao para queries

**Arquivo**: `src/pages/auth/Callback.tsx`

**Linha 105**: Trocar:
```typescript
const dbClient = authEnvironment === 'production' ? supabaseProduction : supabase;
```
Por:
```typescript
const dbClient = authEnvironment === 'production' ? supabaseProductionAuth : supabase;
```

Isso garante que a query `patients.profile_complete` use um cliente com sessao autenticada e passe pela RLS.

Tambem remover o import de `supabaseProduction` (linha 7) se nao for mais usado, e adicionar ao import de `supabaseProductionAuth` (ja importado na linha 6).

### Correcao 2: auth.ts -- getPatient usar cliente com sessao

**Arquivo**: `src/lib/auth.ts`

**Linha 4**: Adicionar import:
```typescript
import { supabaseProductionAuth } from "@/lib/auth-hybrid";
```

**Linha 47**: Trocar:
```typescript
const client = environment === 'production' ? supabaseProduction : supabase;
```
Por:
```typescript
const client = environment === 'production' ? supabaseProductionAuth : supabase;
```

**Linha 3**: Remover import de `supabaseProduction` se nao for mais usado em outro lugar do arquivo.

### Correcao 3: Funcionarios.tsx -- Usar Edge Function para listar dados

**Arquivo**: `src/pages/empresa/Funcionarios.tsx`

Trocar `loadEmployees` (linhas 79-97) para usar `invokeEdgeFunction('company-operations')` com operacao `list-employees`:

```typescript
const loadEmployees = async () => {
  if (!company) return;
  setLoading(true);
  try {
    const { data, error } = await invokeEdgeFunction('company-operations', {
      body: {
        operation: 'list-employees',
        company_cnpj: company.cnpj  // Usar CNPJ como identificador universal
      }
    });
    if (error) throw error;
    setEmployees((data?.employees || []) as Employee[]);
  } catch (error) {
    toast.error('Erro ao carregar funcionários');
  } finally {
    setLoading(false);
  }
};
```

Trocar `loadPendingInvites` (linhas 99-115) de forma similar:

```typescript
const loadPendingInvites = async () => {
  if (!company) return;
  try {
    const { data, error } = await invokeEdgeFunction('company-operations', {
      body: {
        operation: 'list-pending-invites',
        company_cnpj: company.cnpj
      }
    });
    if (error) throw error;
    setPendingInvites(data?.invites || []);
  } catch (error) {
    toast.error('Erro ao carregar convites pendentes');
  }
};
```

Trocar `handleDelete` (linhas 337-354) para usar Edge Function:

```typescript
const handleDelete = async (employeeId: string) => {
  if (!confirm('Tem certeza que deseja excluir este funcionário?')) return;
  try {
    const { data, error } = await invokeEdgeFunction('company-operations', {
      body: {
        operation: 'delete-employee',
        employee_id: employeeId,
        company_cnpj: company?.cnpj
      }
    });
    if (error) throw error;
    toast.success('Funcionário excluído');
    loadEmployees();
  } catch (error) {
    toast.error('Erro ao excluir funcionário');
  }
};
```

### Correcao 4: company-operations Edge Function -- Adicionar operacoes de listagem

**Arquivo**: `supabase/functions/company-operations/index.ts` (Producao)

Adicionar 3 novos cases no switch de operacoes:

**`list-employees`**:
```typescript
case 'list-employees': {
  const { company_cnpj } = body;
  // Buscar company_id pelo CNPJ
  const { data: comp } = await supabaseClient.from('companies').select('id').eq('cnpj', company_cnpj).single();
  if (!comp) return new Response(JSON.stringify({ error: 'Empresa nao encontrada' }), { status: 404, headers: corsHeaders });
  
  const { data: employees, error } = await supabaseClient
    .from('company_employees')
    .select('id, cpf, email, first_name, last_name, created_at')
    .eq('company_id', comp.id)
    .order('created_at', { ascending: false });
  
  return new Response(JSON.stringify({ employees: employees || [] }), { headers: corsHeaders });
}
```

**`list-pending-invites`**:
```typescript
case 'list-pending-invites': {
  const { company_cnpj } = body;
  const { data: comp } = await supabaseClient.from('companies').select('id').eq('cnpj', company_cnpj).single();
  if (!comp) return new Response(JSON.stringify({ error: 'Empresa nao encontrada' }), { status: 404, headers: corsHeaders });
  
  const { data: invites, error } = await supabaseClient
    .from('pending_employee_invites')
    .select('id, email, status, invited_at, expires_at')
    .eq('company_id', comp.id)
    .eq('status', 'pending')
    .order('invited_at', { ascending: false });
  
  return new Response(JSON.stringify({ invites: invites || [] }), { headers: corsHeaders });
}
```

**`delete-employee`**:
```typescript
case 'delete-employee': {
  const { employee_id, company_cnpj } = body;
  const { data: comp } = await supabaseClient.from('companies').select('id').eq('cnpj', company_cnpj).single();
  if (!comp) return new Response(JSON.stringify({ error: 'Empresa nao encontrada' }), { status: 404, headers: corsHeaders });
  
  const { error } = await supabaseClient
    .from('company_employees')
    .delete()
    .eq('id', employee_id)
    .eq('company_id', comp.id);
  
  return new Response(JSON.stringify({ success: !error }), { headers: corsHeaders });
}
```

---

## Resumo de arquivos

| Arquivo | Alteracao | Deploy |
|---------|-----------|--------|
| `src/pages/auth/Callback.tsx` | Trocar `supabaseProduction` por `supabaseProductionAuth` (linha 105) | Automatico (Lovable) |
| `src/lib/auth.ts` | Trocar `supabaseProduction` por `supabaseProductionAuth` em `getPatient` (linha 47) | Automatico (Lovable) |
| `src/pages/empresa/Funcionarios.tsx` | Trocar queries diretas por `invokeEdgeFunction` com CNPJ | Automatico (Lovable) |
| `supabase/functions/company-operations/index.ts` | Adicionar 3 operacoes: `list-employees`, `list-pending-invites`, `delete-employee` | Manual (Supabase Producao) |

## Ordem de execucao

1. Correcoes 1 e 2 (AuthCallback + auth.ts) -- resolve o loop de completar cadastro
2. Correcao 4 (Edge Function) -- voce adiciona os 3 cases e faz deploy manual na Producao
3. Correcao 3 (Funcionarios.tsx) -- consome as novas operacoes

## Resultado esperado

- Login apos cadastro: usuario vai direto para `/area-do-paciente` (sem loop)
- Senha definida no cadastro: funciona no primeiro login
- Funcionarios: aparecem corretamente na listagem da empresa
- Convites pendentes: aparecem corretamente na listagem
