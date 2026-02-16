

# Correção: Erro 403 em change_plan e disable_plan

## Causa Raiz

As operações `change_plan` (linha 1145-1166) e `disable_plan` (linha 1074-1095) validam o admin usando `supabase.auth.getUser(token)` -- que consulta o Supabase de **Produção**. Como o admin está logado no **Lovable Cloud**, o token JWT foi assinado com uma chave diferente, então `getUser()` falha e retorna 403.

A operação `activate_plan_manual` (que funciona corretamente) resolve isso criando um client do **Lovable Cloud** (`authClient`) para validar o token, e depois verifica a role admin nesse mesmo client (linhas 1282-1344).

## Correção (1 arquivo)

### `supabase/functions/patient-operations/index.ts`

Substituir a lógica de autenticação admin nos cases `disable_plan` e `change_plan` pelo mesmo padrão usado em `activate_plan_manual`:

**Em `disable_plan` (linhas 1074-1095):**

Substituir:
```typescript
const token = authHeader!.replace("Bearer ", "");
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError || !user) { return 403 }
const { data: roles } = await supabase.from("user_roles")...
if (!roles || roles.role !== "admin") { return 403 }
```

Por:
```typescript
const token = authHeader?.replace("Bearer ", "") || "";
const LOVABLE_CLOUD_URL = "https://yrsjluhhnhxogdgnbnya.supabase.co";
const LOVABLE_CLOUD_ANON_KEY = "eyJ..."; // mesma chave já usada em activate_plan_manual
const authClient = createClient(LOVABLE_CLOUD_URL, LOVABLE_CLOUD_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${token}` } },
});
const { data: authData, error: authError } = await authClient.auth.getUser(token);
if (authError || !authData?.user) { return 403 "Não autorizado" }
const { data: roles } = await authClient.from("user_roles")
  .select("role").eq("user_id", authData.user.id);
const isAdmin = roles?.some((r: any) => r.role === "admin");
if (!isAdmin) { return 403 "Apenas administradores..." }
```

**Em `change_plan` (linhas 1145-1166):** mesma substituição.

## Resumo

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/patient-operations/index.ts` | `disable_plan`: trocar `supabase.auth.getUser` por `authClient` (Cloud) -- linhas 1074-1095 |
| `supabase/functions/patient-operations/index.ts` | `change_plan`: trocar `supabase.auth.getUser` por `authClient` (Cloud) -- linhas 1145-1166 |

Após a alteração, copiar o conteúdo atualizado da Edge Function e redeployar no Supabase de Produção.
