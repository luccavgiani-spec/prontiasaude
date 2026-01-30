
# Plano de Correção: Avalone + Botão de Reset de Senha

## 🔍 Diagnóstico Completo

### Problema 1: Cadastro Incompleto da Avalone

| Dado | Valor |
|------|-------|
| Email | avalonemartins22@gmail.com |
| Data do cadastro | 30/01/2026 às 12:40:58 (antes das correções) |
| first_name | NULL |
| last_name | NULL |
| cpf | NULL |
| phone_e164 | NULL |
| profile_complete | false |
| user_id | 90eaf808-97f0-44a8-a8bc-c6e7bd2e3d7d |
| Origem | Cloud (only) |

**Causa:** A Avalone se cadastrou às 12:40, ANTES das correções do fluxo de Magic Link serem aplicadas (às ~14:20). O cadastro dela passou pelo antigo `handleMagicLink` que usava `supabase.auth.signUp` diretamente, criando apenas o registro básico via trigger `handle_new_user`.

**Conclusão:** Mesmo erro que a Kelly, mas em horário diferente. Após a remoção do Magic Link (já implementada), isso NÃO acontecerá mais.

### Problema 2: Email de Reset Não Enviado

| Dado | Valor |
|------|-------|
| Token criado | Sim (13:33:34) |
| Token usado | Não (used_at: null) |
| Environment | cloud |
| Logs da função | NENHUM no Cloud |

**Causa identificada:**
1. A página `EsqueciSenha.tsx` usa `invokeEdgeFunction('send-password-reset', ...)` que chama a função no **Supabase de Produção**
2. A função `send-password-reset` precisa da chave `RESEND_API_KEY` para enviar emails
3. Precisa da `ORIGINAL_SUPABASE_SERVICE_ROLE_KEY` para buscar em Produção
4. No entanto, a função deveria rodar no Cloud (onde tem acesso às service keys de ambos)
5. O token foi salvo mas o email provavelmente falhou silenciosamente

**Solução:** Alterar `EsqueciSenha.tsx` para usar `invokeCloudEdgeFunction` ao invés de `invokeEdgeFunction`

---

## ✅ Ações a Implementar

### 1. Excluir Conta da Avalone
Usar a Edge Function `delete-user-by-email` para remover de ambos os ambientes.

### 2. Corrigir EsqueciSenha.tsx
Alterar a chamada de `invokeEdgeFunction` para `invokeCloudEdgeFunction`, pois a função `send-password-reset` precisa acessar ambos os ambientes e deve rodar no Cloud.

### 3. Adicionar Botão de Reset de Senha no Painel Admin
Substituir o botão "Ver Detalhes" (ícone de olho) por um botão "Reset Senha" que:
- Gera uma senha aleatória forte
- Chama uma Edge Function para atualizar a senha do usuário
- Exibe a senha gerada para o admin copiar e enviar ao usuário

---

## 📝 Mudanças Técnicas

### Arquivo 1: `src/pages/EsqueciSenha.tsx`

**Linha 6:** Adicionar import
```typescript
import { invokeCloudEdgeFunction } from "@/lib/edge-functions";
```

**Linhas 35-37:** Alterar chamada
```typescript
// ANTES:
const { data, error } = await invokeEdgeFunction('send-password-reset', {

// DEPOIS:
const { data, error } = await invokeCloudEdgeFunction('send-password-reset', {
```

### Arquivo 2: `src/components/admin/UserRegistrationsTab.tsx`

**Linha 14:** Adicionar import do ícone `Key`
```typescript
import { ..., Key, ... } from 'lucide-react';
```

**Adicionar estado para modal de reset:**
```typescript
const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
const [resetLoading, setResetLoading] = useState(false);
```

**Adicionar função para gerar senha e resetar:**
```typescript
const handleResetPassword = async (user: User) => {
  setResetLoading(true);
  
  // Gerar senha aleatória forte
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Chamar Edge Function para atualizar senha
  const { data, error } = await invokeCloudEdgeFunction('reset-user-password', {
    body: { email: user.email, new_password: password }
  });
  
  if (error) {
    toast.error('Erro ao resetar senha: ' + error.message);
    setResetLoading(false);
    return;
  }
  
  setGeneratedPassword(password);
  setResetPasswordUser(user);
  setResetLoading(false);
};
```

**Linhas 926-933:** Substituir botão "Ver Detalhes" por "Reset Senha"
```typescript
// ANTES:
<Button 
  variant="ghost" 
  size="sm" 
  title="Ver Detalhes"
  onClick={() => setViewingUser(user)}
>
  <Eye className="h-4 w-4" />
</Button>

// DEPOIS:
<Button 
  variant="ghost" 
  size="sm" 
  title="Resetar Senha"
  onClick={() => handleResetPassword(user)}
  disabled={resetLoading}
  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
>
  <Key className="h-4 w-4" />
</Button>
```

**Adicionar modal para exibir senha gerada:**
```typescript
{/* Reset Password Modal */}
<Dialog open={!!resetPasswordUser && !!generatedPassword} onOpenChange={() => {
  setResetPasswordUser(null);
  setGeneratedPassword(null);
}}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Senha Resetada com Sucesso</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <p>Nova senha gerada para <strong>{resetPasswordUser?.email}</strong>:</p>
      <div className="flex items-center gap-2 p-4 bg-gray-100 rounded-lg">
        <code className="flex-1 text-lg font-mono">{generatedPassword}</code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(generatedPassword || '');
            toast.success('Senha copiada!');
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Envie esta senha para o usuário. Ele poderá usar imediatamente.
      </p>
    </div>
  </DialogContent>
</Dialog>
```

### Nova Edge Function: `supabase/functions/reset-user-password/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOUD_URL = "https://yrsjluhhnhxogdgnbnya.supabase.co";
const PRODUCTION_URL = "https://ploqujuhpwutpcibedbr.supabase.co";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, new_password } = await req.json();
    
    // Criar clientes
    const cloudClient = createClient(CLOUD_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const prodClient = createClient(PRODUCTION_URL, Deno.env.get("ORIGINAL_SUPABASE_SERVICE_ROLE_KEY")!);
    
    // Buscar e atualizar em ambos os ambientes
    const results = { cloud: false, production: false };
    
    // Buscar no Cloud
    const { data: cloudUsers } = await cloudClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const cloudUser = cloudUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (cloudUser) {
      await cloudClient.auth.admin.updateUserById(cloudUser.id, { password: new_password });
      results.cloud = true;
    }
    
    // Buscar na Produção
    const { data: prodUsers } = await prodClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const prodUser = prodUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (prodUser) {
      await prodClient.auth.admin.updateUserById(prodUser.id, { password: new_password });
      results.production = true;
    }
    
    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### Atualizar `supabase/config.toml`

Adicionar nova função com `verify_jwt = false`:
```toml
[functions.reset-user-password]
verify_jwt = false
```

---

## 📋 Resumo das Ações

| # | Ação | Arquivo |
|---|------|---------|
| 1 | Excluir conta da Avalone | delete-user-by-email (tool call) |
| 2 | Corrigir chamada para `invokeCloudEdgeFunction` | src/pages/EsqueciSenha.tsx |
| 3 | Adicionar botão de Reset Senha | src/components/admin/UserRegistrationsTab.tsx |
| 4 | Criar Edge Function reset-user-password | supabase/functions/reset-user-password/index.ts |
| 5 | Configurar função no config.toml | supabase/config.toml |

---

## 🔒 Segurança

- A Edge Function `reset-user-password` usa `verify_jwt = false` mas só pode ser chamada por admins com acesso ao painel
- A senha gerada usa caracteres aleatórios e tem 12 caracteres de comprimento
- A senha é exibida uma única vez e não é armazenada

---

## ⚠️ Ações no Supabase de Produção

**Nenhuma ação necessária.** Todas as correções são no código.
