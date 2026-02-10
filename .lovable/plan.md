
# Correção: Login de Empresas - Sincronização Cloud + Produção

## Problema

A Edge Function `company-operations` (deployada na Produção) cria empresa, Auth user, user_roles e company_credentials **somente na Produção**. Porém, a tela `/empresa/login` usa o cliente Cloud (`supabase` do Lovable Cloud) para autenticar. Como o Auth user não existe no Cloud, o login falha com "Invalid login credentials".

## Solução em 2 Partes

### Parte 1: Correção imediata - Criar dados do CNPJ 01610972000160 no Cloud

Criar manualmente no Cloud:

1. **Auth user** via `supabase.auth.admin.createUser` (precisa ser via Edge Function no Cloud)
2. **Registro na tabela `companies`** com os mesmos dados da Produção
3. **Registro na tabela `user_roles`** com role = 'company'
4. **Registro na tabela `company_credentials`** vinculando ao user_id do Cloud

Para isso, criaremos uma Edge Function temporária no Cloud chamada `sync-company-to-cloud` que recebe os dados da empresa e cria tudo de uma vez.

### Parte 2: Correção permanente - Atualizar `company-operations`

Modificar a operação `create` dentro de `supabase/functions/company-operations/index.ts` para, após criar tudo na Produção, fazer uma chamada HTTP ao Cloud para replicar:

1. Criar Auth user no Cloud (via REST API direta ao GoTrue do Cloud)
2. Inserir `companies`, `user_roles` e `company_credentials` no Cloud (via REST API direta ao PostgREST do Cloud)

Isso usa as secrets `CLOUD_SUPABASE_URL` e `CLOUD_SUPABASE_SERVICE_ROLE_KEY` que já existem configuradas.

---

## Detalhes Técnicos

### Edge Function temporária: `sync-company-to-cloud`

Arquivo: `supabase/functions/sync-company-to-cloud/index.ts`

Esta função recebe por POST:
- `email`: o email da empresa (ex: `01610972000160@empresa.prontia.com`)
- `password`: a senha temporária
- `company_data`: dados da empresa (razao_social, cnpj, cep, etc.)
- `cnpj`: CNPJ limpo

Fluxo:
1. Cria Auth user no Cloud com `supabase.auth.admin.createUser`
2. Insere na tabela `companies`
3. Insere na tabela `user_roles` com role = 'company'
4. Insere na tabela `company_credentials` com `must_change_password: true`

### Alteração em `company-operations/index.ts` (operação `create`, linhas 828-987)

Após a criação bem-sucedida na Produção (linha 947, após criar o plano), adicionar um bloco que:

1. Obtém as credenciais do Cloud via `Deno.env.get('CLOUD_SUPABASE_URL')` e `Deno.env.get('CLOUD_SUPABASE_SERVICE_ROLE_KEY')`
2. Cria um `cloudClient` com `createClient(CLOUD_URL, cloudServiceKey)`
3. Executa `cloudClient.auth.admin.createUser(...)` com os mesmos dados
4. Insere `companies`, `user_roles` e `company_credentials` no Cloud
5. Todo o bloco é envolvido em try/catch para que uma falha no Cloud NAO afete a criação na Produção (Cloud é secundário)

### Arquivos modificados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/sync-company-to-cloud/index.ts` | NOVO - Funcao temporaria para sincronizar empresa existente |
| `supabase/functions/company-operations/index.ts` | Adicionar replicação ao Cloud na operação `create` |

### Arquivos NAO alterados

- `src/pages/empresa/Login.tsx` (intocável - funciona corretamente se os dados existirem no Cloud)
- `src/hooks/useCompanyAuth.ts` (intocável)
- Qualquer outro componente frontend
- Edge Functions de pagamento, redirecionamento, ClubeBen

### Secrets necessárias

A function `company-operations` roda na **Produção** e precisa das seguintes secrets configuradas no dashboard do Supabase de Produção:

- `CLOUD_SUPABASE_URL` = `https://yrsjluhhnhxogdgnbnya.supabase.co`
- `CLOUD_SUPABASE_SERVICE_ROLE_KEY` = (service role key do projeto Cloud)

Essas secrets já devem estar configuradas (usadas por `list-all-users` e `patient-operations`). Se não estiverem, será necessário adicioná-las.

### Fluxo após correção

```text
Admin cria empresa no painel
       |
       v
company-operations (Producao)
       |
       +---> Cria Auth user na Producao
       +---> Cria companies, user_roles, credentials na Producao
       +---> Cria Auth user no Cloud (NOVO)
       +---> Cria companies, user_roles, credentials no Cloud (NOVO)
       |
       v
Empresa faz login em /empresa/login
       |
       v
supabase.auth.signInWithPassword (Cloud) --> OK!
```
