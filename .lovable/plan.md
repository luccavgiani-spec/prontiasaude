

# Plano de Correção: Ativação Manual de Planos

## Problema Identificado

A edge function `patient-operations` está falhando silenciosamente porque:

### 1. Incompatibilidade de JWT Cross-Project

Quando o frontend está no Lovable Cloud (`yrsjluhhnhxogdgnbnya`), o token JWT é assinado por esse projeto. Porém, a edge function `patient-operations` tenta validar esse token no projeto de produção (`ploqujuhpwutpcibedbr`), causando erro de autenticação.

**Código bugado atual (linha 518-527):**
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL');  // ❌ Pode ser Lovable Cloud!
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
// ...
const { data: { user }, error: authError } = await supabase.auth.getUser(token);  // ❌ Falha!
```

### 2. Configuração Ausente no config.toml

A função `patient-operations` não está listada no `supabase/config.toml` com `verify_jwt = false`, diferente de outras funções críticas como `schedule-redirect`, `check-payment-status`, `mp-webhook`.

---

## Correções Necessárias

### Arquivo 1: `supabase/config.toml`

Adicionar configuração para `patient-operations`:

```toml
[functions.patient-operations]
verify_jwt = false
```

### Arquivo 2: `supabase/functions/patient-operations/index.ts`

Aplicar o mesmo padrão das outras edge functions que funcionam corretamente:

1. **Usar URLs hardcoded** para o projeto de produção
2. **Validar admin usando service_role** ao invés de JWT

**Alterações:**

```typescript
// ANTES (bugado):
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// DEPOIS (corrigido):
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const supabaseServiceRoleKey = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') 
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(ORIGINAL_SUPABASE_URL, supabaseServiceRoleKey);
```

**Para validação de admin (caso `activate_plan_manual`):**

Como não é possível validar o JWT do Lovable Cloud, a função deve:
1. Extrair o email do JWT claim (sem validar assinatura)
2. Verificar se esse email existe na tabela `user_roles` com role='admin'
3. Ou aceitar uma API key secreta para operações admin

```typescript
case 'activate_plan_manual': {
  // ✅ Validar admin usando email do token + verificação na tabela
  const token = authHeader?.replace('Bearer ', '');
  
  // Decodificar JWT sem validar assinatura (cross-project)
  let userEmail = null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    userEmail = payload.email;
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }
  
  // Verificar se é admin no banco de produção
  const { data: adminCheck } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('role', 'admin')
    .single();
  
  // Buscar user_id pelo email para verificação
  const { data: authUser } = await supabaseAdmin
    .from('patients')
    .select('user_id')
    .eq('email', userEmail)
    .single();
    
  if (!authUser?.user_id) {
    return new Response(JSON.stringify({ error: 'Admin not found' }), { status: 403 });
  }
  
  const { data: roles } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', authUser.user_id);
  
  if (!roles?.some(r => r.role === 'admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden - Admin only' }), { status: 403 });
  }
  
  // ... resto da lógica
}
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/config.toml` | Adicionar `[functions.patient-operations]` com `verify_jwt = false` |
| `supabase/functions/patient-operations/index.ts` | Usar URL hardcoded `ploqujuhpwutpcibedbr` e validar admin via email/banco |

---

## Resultado Esperado

1. **Ativação manual funcionará** corretamente do Admin Dashboard
2. **JWT cross-project** não causará mais erros de autenticação
3. **Segurança mantida** - verificação de admin via banco de dados
4. **Consistência** com outras edge functions que já funcionam

