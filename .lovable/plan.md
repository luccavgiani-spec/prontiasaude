
# Diagnostico e Correcao: Login, Reset de Senha e Listagem de Funcionarios

## 3 Problemas Identificados

### Problema 1: Senha incorreta ao fazer login

**Causa raiz**: O `upsert_patient` (Producao) cria o usuario via `supabase.auth.admin.createUser` **apenas no ambiente de Producao**. Porem, o `hybridSignUp` ja havia sido chamado antes (em `CompletarPerfil.tsx` linha 436) via `create-user-both-envs`, que cria em AMBOS os ambientes. O fluxo esta assim:

1. `hybridSignUp` chama `create-user-both-envs` -- cria usuario em Cloud + Producao com a senha correta
2. Login automatico na Producao funciona -- sessao ativa
3. `upsertPatientBasic` chama `patient-operations` com `upsert_patient` -- que tenta `createUser` novamente na Producao com uma senha ALEATORIA gerada internamente

O `upsert_patient` da Edge Function, ao detectar "already exists", nao sobrescreve a senha. Entao a senha original continua valida. **Porem**, os logs do `check-user-exists` mostram que o usuario NAO e encontrado em nenhum ambiente, o que indica que a busca paginada esta falhando.

O `check-user-exists` usa REST API com `perPage: 50` e ate 50 paginas (2500 usuarios). Se o Supabase de Producao tem mais de 2500 usuarios, o email nao sera encontrado. Com 570+ usuarios (conforme memoria), deveria funcionar, mas os logs sao claros: `existsInCloud: false, existsInProduction: false`.

**Possivel causa adicional**: O usuario foi criado DEPOIS da ultima verificacao, e o login fallback (linhas 97-183 de `auth-hybrid.ts`) tenta Cloud e depois Producao diretamente. Se a senha for diferente entre os ambientes (por exemplo, se `create-user-both-envs` falhou em um deles), o login falha.

**Acao**: Verificar nos logs de Producao se o usuario realmente foi criado. Se nao, o problema esta na `create-user-both-envs`.

### Problema 2: Email de redefinicao de senha nao chega

**Causa raiz CONFIRMADA pelos logs**: A funcao `send-password-reset` usa `client.auth.admin.listUsers({ perPage: 1000 })` (linha 29). O GoTrue ignora valores acima de 50 e retorna apenas 50 usuarios por pagina. Se o usuario `luccavgiani@gmail.com` esta apos a posicao 50, ele nunca e encontrado.

Log: `[send-password-reset] Email nao encontrado em nenhum ambiente: luccavgiani@gmail.com`

O mesmo bug existe na funcao `complete-password-reset` (que tambem usa `perPage: 1000`).

**Correcao**: Atualizar `send-password-reset` e `complete-password-reset` para usar REST API direta com `perPage: 50` e paginacao, identico ao padrao ja usado em `check-user-exists` e `create-user-both-envs`.

### Problema 3: Funcionario nao aparece na listagem da empresa

**Causa raiz CONFIRMADA**: `Funcionarios.tsx` linha 83 faz `await supabase.from('company_employees')` -- isso consulta o banco do **Lovable Cloud**. Porem, o registro do funcionario foi inserido pela `company-operations` no banco de **Producao**. A tabela `company_employees` no Cloud esta vazia.

**Correcao**: Trocar a query para usar `invokeEdgeFunction('company-operations')` com uma operacao de listagem, OU usar o cliente de Producao (`supabaseProduction`).

---

## Alteracoes Necessarias

### Arquivo 1: `supabase/functions/send-password-reset/index.ts`

Substituir a funcao `findUserByEmail` (linhas 21-59) pela versao que usa REST API direta com `perPage: 50`:

```typescript
async function findUserByEmail(supabaseUrl: string, serviceKey: string, email: string, label: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  console.log(`[send-password-reset] Buscando ${email} em ${label}...`);
  
  let page = 1;
  const perPage = 50;
  const maxPages = 50;
  
  while (page <= maxPages) {
    const url = `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[send-password-reset] ${label}: REST API error ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    const users = data.users || data || [];
    
    if (!Array.isArray(users) || users.length === 0) return false;
    
    const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
    if (found) {
      console.log(`[send-password-reset] Usuario encontrado em ${label}: ${found.id}`);
      return true;
    }
    
    if (users.length < perPage) return false;
    page++;
  }
  
  return false;
}
```

A funcao passa a receber `(supabaseUrl, serviceKey, email, label)` ao inves de `(client, email, label)`.

Atualizar as chamadas (linhas 92-96):

```typescript
const [existsInCloud, existsInProd] = await Promise.all([
  findUserByEmail(CLOUD_URL, cloudServiceKey, email, 'Cloud'),
  findUserByEmail(PRODUCTION_URL, prodServiceKey, email, 'Producao'),
]);
```

### Arquivo 2: `supabase/functions/complete-password-reset/index.ts`

Mesma correcao: substituir a funcao `findUserByEmail` (linhas 24-48) pela versao com REST API direta. Atualizar a assinatura e as chamadas (linhas 115-118):

```typescript
async function findUserByEmail(supabaseUrl: string, serviceKey: string, email: string): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();
  let page = 1;
  const perPage = 50;
  const maxPages = 50;
  
  while (page <= maxPages) {
    const url = `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const users = data.users || data || [];
    
    if (!Array.isArray(users) || users.length === 0) return null;
    
    const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
    if (found) return found.id;
    
    if (users.length < perPage) return null;
    page++;
  }
  
  return null;
}
```

Atualizar chamadas (linhas 115-118):

```typescript
const [cloudUserId, prodUserId] = await Promise.all([
  findUserByEmail(CLOUD_URL, cloudServiceKey, tokenData.email),
  findUserByEmail(PRODUCTION_URL, prodServiceKey, tokenData.email)
]);
```

### Arquivo 3: `src/pages/empresa/Funcionarios.tsx`

Trocar `loadEmployees` (linhas 78-96) e `loadPendingInvites` (linhas 98-114) para usar `invokeEdgeFunction` apontando para Producao, ou usar o cliente de Producao direto.

Opcao mais simples: importar e usar `supabaseProduction` de `src/lib/supabase-production.ts`:

```typescript
import { supabaseProduction } from '@/lib/supabase-production';
```

Linha 83: trocar `supabase.from('company_employees')` por `supabaseProduction.from('company_employees')`

Linha 102: trocar `supabase.from('pending_employee_invites')` por `supabaseProduction.from('pending_employee_invites')`

**Nota**: Isso requer que as tabelas tenham RLS que permita leitura por usuarios autenticados (ou `anon`). Se nao tiverem, sera necessario usar uma Edge Function intermediaria. Preciso verificar a RLS dessas tabelas.

**Alternativa**: Usar `invokeEdgeFunction('company-operations', { body: { operation: 'list-employees' } })` se essa operacao existir.

---

## Resumo de arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/send-password-reset/index.ts` | Trocar `listUsers` por REST API direta com `perPage: 50` |
| `supabase/functions/complete-password-reset/index.ts` | Mesma correcao de paginacao |
| `src/pages/empresa/Funcionarios.tsx` | Trocar `supabase` por `supabaseProduction` nas queries de `company_employees` e `pending_employee_invites` |

## Nenhum outro arquivo alterado
