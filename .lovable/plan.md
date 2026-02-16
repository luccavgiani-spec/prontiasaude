

# Correção: Erro 403 em disable_plan e change_plan

## O Que Muda (e o que NAO muda)

A correção altera **apenas** a parte de "quem é esse admin?" (verificação de identidade). As operações de banco de dados (desabilitar/alterar planos) continuam rodando na **Produção** como antes.

```text
FLUXO ATUAL (quebrado):
  Admin (Cloud JWT) --> supabase.auth.getUser (Produção) --> FALHA 403

FLUXO CORRIGIDO (igual ao activate_plan_manual):
  Admin (Cloud JWT) --> authClient.auth.getUser (Cloud) --> OK
  Operação de banco --> supabase (Produção, service_role) --> OK
```

Nenhuma outra linha é afetada. As queries em `patient_plans` continuam usando o mesmo `supabase` (Produção).

## Alteração (1 arquivo)

### `supabase/functions/patient-operations/index.ts`

**Em `disable_plan` (linhas 1074-1095):** Substituir a validação admin por authClient (Cloud):

```typescript
// ANTES (linhas 1074-1095):
const token = authHeader!.replace("Bearer ", "");
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError || !user) { return 403 }
const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
if (!roles || roles.role !== "admin") { return 403 }

// DEPOIS:
const token = authHeader?.replace("Bearer ", "") || "";
const LOVABLE_CLOUD_URL = "https://yrsjluhhnhxogdgnbnya.supabase.co";
const LOVABLE_CLOUD_ANON_KEY = "eyJhbGci...fdF2KZage73BDDM0Shs7cMRLnJdFPUef866R5vZBmnY";
// (mesma chave ja usada no activate_plan_manual, linha 1284-1285)

const authClient = createClient(LOVABLE_CLOUD_URL, LOVABLE_CLOUD_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${token}` } },
});
const { data: authData, error: authError } = await authClient.auth.getUser(token);
if (authError || !authData?.user) {
  return new Response(JSON.stringify({ error: "Nao autorizado" }), { status: 403 });
}
const { data: roles } = await authClient
  .from("user_roles").select("role").eq("user_id", authData.user.id);
const isAdmin = roles?.some((r: any) => r.role === "admin");
if (!isAdmin) {
  return new Response(JSON.stringify({ error: "Apenas administradores podem desabilitar planos" }), { status: 403 });
}
```

**Em `change_plan` (linhas 1145-1166):** Mesma substituicao identica.

## O Que NAO Muda

- A query `supabase.from("patient_plans").update(...)` nas linhas 1098-1106 e 1179-1184 continua igual (Producao, service_role)
- Nenhuma outra operacao e afetada
- O `AUTH_BYPASS_OPERATIONS` permanece com `change_plan` e `disable_plan` incluidos (permite passar a validacao generica da linha 624)
- O sistema hibrido de sessao nao e alterado

## Apos a Alteracao

Copiar o conteudo completo atualizado de `patient-operations/index.ts` e redeployar no Supabase de Producao.

| Arquivo | Linhas Alteradas | O Que Muda |
|---------|-----------------|------------|
| `patient-operations/index.ts` | 1074-1095 | `disable_plan`: validacao admin via Cloud |
| `patient-operations/index.ts` | 1145-1166 | `change_plan`: validacao admin via Cloud |

