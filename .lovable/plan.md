

# Correção: Cadastro via Convite Empresarial - Criação Apenas na Produção

## Diagnóstico Confirmado por Logs

Os logs do `check-user-exists` comprovam:

```
luccavicchiattigiani@gmail.com -> existsInCloud: false, existsInProduction: true
```

O usuário foi criado APENAS na Produção. O Cloud nunca recebeu o registro.

## Causa Raiz

A função `create-user-both-envs` (linhas 156-167) tem um bug: quando o email já existe em **um** dos ambientes, ela retorna erro e **não cria no outro**:

```typescript
if (existsInCloud || existsInProd) {
  // RETORNA ERRO - nunca cria no ambiente que está faltando
  return new Response(JSON.stringify({ 
    success: false, 
    error: "Este email já está cadastrado..."
  }));
}
```

O fluxo que causa isso:
1. `patient-operations/upsert_patient` cria o auth user na Produção com senha aleatória
2. Depois, `hybridSignUp` chama `create-user-both-envs`
3. `create-user-both-envs` detecta `existsInProd: true` e retorna erro
4. Cloud NUNCA recebe o usuário
5. Login híbrido tenta Cloud primeiro, falha, tenta Produção -- mas a senha aleatória do `upsert_patient` pode ter sobrescrito a original

## Correção Necessária

### Arquivo: `supabase/functions/create-user-both-envs/index.ts`

**Linhas 156-167**: Substituir o bloco de "já existe" por lógica que cria no ambiente faltante:

```typescript
// ANTES (bugado):
if (existsInCloud || existsInProd) {
  return new Response(JSON.stringify({ 
    success: false, 
    error: "Este email já está cadastrado...",
    existsInCloud,
    existsInProd
  }), { status: 400, ... });
}

// DEPOIS (corrigido):
if (existsInCloud && existsInProd) {
  // Já existe em AMBOS - realmente é duplicado
  return new Response(JSON.stringify({ 
    success: false, 
    error: "Este email já está cadastrado. Faça login ou recupere sua senha.",
    existsInCloud: true,
    existsInProd: true
  }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Se existe em apenas um, pular a criação nesse ambiente e criar no outro
console.log(`[create-user-both-envs] Existe parcialmente: Cloud=${existsInCloud}, Prod=${existsInProd}`);
```

Além disso, nas seções de criação (linhas 170-210 para Produção e linhas 215-240 para Cloud), envolver cada bloco com um `if (!existsInProd)` e `if (!existsInCloud)` respectivamente:

```typescript
// =============================================
// CRIAR USUÁRIO NA PRODUÇÃO (PRINCIPAL)
// =============================================
let prodUserId: string | null = null;

if (!existsInProd) {
  console.log("[create-user-both-envs] Criando usuário na Produção...");
  // ... código existente de criação na Produção ...
} else {
  console.log("[create-user-both-envs] Usuário já existe na Produção, pulando criação");
  // Buscar o ID existente para uso posterior
  // (usar REST API para encontrar o user ID)
}

// =============================================
// CRIAR USUÁRIO NO CLOUD (SECUNDÁRIO)
// =============================================
let cloudUserId: string | null = null;

if (!existsInCloud) {
  console.log("[create-user-both-envs] Criando usuário no Cloud...");
  // ... código existente de criação no Cloud ...
} else {
  console.log("[create-user-both-envs] Usuário já existe no Cloud, pulando criação");
}
```

A resposta final deve retornar `success: true` quando pelo menos um ambiente foi criado com sucesso ou ambos já existiam.

### Sincronização da tabela `patients`

As seções de sync de patients (linhas 250-330) também precisam do mesmo tratamento condicional, o que já fazem parcialmente (checam `existingProd`/`existingCloud` via `maybeSingle`). Isso está correto e não precisa de alteração.

---

## Criação Manual do Usuário no Cloud

Como não consigo criar via `create-user-both-envs` (ela bloqueia), a outra IA deve executar o seguinte:

1. Criar uma Edge Function temporária `create-cloud-user-only` no Lovable Cloud:

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  const { email, password } = await req.json();
  const cloudUrl = Deno.env.get("SUPABASE_URL")!;
  const cloudKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const client = createClient(cloudUrl, cloudKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  const { data, error } = await client.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
  });
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  
  // Criar patient record também
  await client.from('patients').upsert({
    user_id: data.user.id,
    email: email.toLowerCase().trim(),
  }, { onConflict: 'email' });
  
  return new Response(JSON.stringify({ success: true, userId: data.user.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
```

2. Adicionar ao `config.toml`:
```toml
[functions.create-cloud-user-only]
verify_jwt = false
```

3. Fazer deploy e chamar via curl:
```
POST /create-cloud-user-only
Body: { "email": "luccavicchiattigiani@gmail.com", "password": "SenhQueUsuarioDefiniu" }
```

4. Depois de criar, deletar a Edge Function temporária.

---

## Resumo

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/create-user-both-envs/index.ts` | Mudar lógica de `existsInCloud OR existsInProd` para `existsInCloud AND existsInProd`, e criar no ambiente faltante |

Essa correção resolve o problema na raiz: qualquer cadastro futuro via convite empresarial criará o usuário em AMBOS os ambientes, mesmo que já exista em um deles.

