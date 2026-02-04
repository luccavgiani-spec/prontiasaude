

# Plano: Corrigir Testes no Preview (Edge Functions)

## Diagnóstico do Problema

O erro "Failed to fetch" ocorre porque:

1. **Você está no preview do Lovable** (`9bc3ce56...lovableproject.com`)
2. **O código tenta chamar Edge Functions no Supabase de Produção** (`ploqujuhpwutpcibedbr.supabase.co`)
3. **O CORS do Supabase de Produção não permite requisições do domínio do preview**

### Fluxo Atual (Problema)

```text
┌───────────────────────┐
│ Preview Lovable       │
│ *.lovableproject.com  │
└───────────┬───────────┘
            │
            ▼ (invokeEdgeFunction)
┌───────────────────────┐
│ Supabase Produção     │
│ ploqujuhpwutpcibedbr  │
│ CORS: ❌ Bloqueado    │
└───────────────────────┘
```

### Funções Afetadas

| Função | Chamada via | Status no Preview |
|--------|-------------|-------------------|
| patient-operations | invokeEdgeFunction (Produção) | ❌ Bloqueado |
| check-user-exists | invokeCloudEdgeFunction (Cloud) | ✅ Funciona |
| create-user-both-envs | invokeCloudEdgeFunction (Cloud) | ✅ Funciona |

---

## Solução Proposta

### Modificar `ensurePatientRow` para usar ambiente correto

Atualizar `src/lib/patients.ts` para detectar o ambiente e usar a função Cloud quando apropriado:

```typescript
// src/lib/patients.ts - linha 32

// ✅ CORREÇÃO: Usar invokeCloudEdgeFunction quando ambiente = cloud
const invokeFunction = environment === 'cloud' ? invokeCloudEdgeFunction : invokeEdgeFunction;

const { data, error } = await invokeFunction('patient-operations', {
  body: {
    operation: 'ensure_patient',
    user_id: userId,
    email: userEmail
  },
  headers
});
```

### Problema: A função precisa saber o ambiente

A função `ensurePatientRow` recebe um `dbClient` mas não sabe qual ambiente está sendo usado. Precisamos adicionar essa informação.

---

## Alterações Necessárias

### Arquivo 1: `src/lib/patients.ts`

Modificar `ensurePatientRow` para receber o ambiente como parâmetro:

```typescript
export async function ensurePatientRow(
  userId: string, 
  dbClient: SupabaseClient = supabase,
  environment: 'cloud' | 'production' = 'cloud' // novo parâmetro
) {
  console.log('[ensurePatientRow] Chamando edge function para user_id:', userId, 'ambiente:', environment);
  
  const { data: sessionData } = await dbClient.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const userEmail = sessionData?.session?.user?.email;
  
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  // ✅ CORREÇÃO: Usar função correta baseado no ambiente
  const invokeFunction = environment === 'production' ? invokeEdgeFunction : invokeCloudEdgeFunction;
  
  const { data, error } = await invokeFunction('patient-operations', {
    body: {
      operation: 'ensure_patient',
      user_id: userId,
      email: userEmail
    },
    headers
  });
  
  if (error) {
    console.error('[ensurePatientRow] Edge function error:', error);
    throw new Error(error.message || 'Falha ao garantir registro do paciente');
  }
  
  return true;
}
```

### Arquivo 2: `src/pages/auth/Callback.tsx`

Passar o ambiente para `ensurePatientRow`:

```typescript
// Linha 76-77
const patientDbClient = authEnvironment === 'production' ? supabaseProductionAuth : supabase;
await ensurePatientRow(session.user.id, patientDbClient, authEnvironment || 'cloud');
```

### Arquivo 3: `src/pages/CompletarPerfil.tsx`

Atualizar todas as chamadas de `ensurePatientRow` para passar o ambiente.

---

## Alternativa: Testar no Site Publicado

Se você não quiser modificar o código, pode simplesmente **publicar as alterações** e testar diretamente no site de produção (`prontiasaude.lovable.app` ou `prontiasaude.com.br`).

As Edge Functions de Produção já estão configuradas com CORS correto para esses domínios.

---

## Detalhes Técnicos

### Por que funciona em Produção mas não no Preview?

O arquivo `supabase/functions/common/cors.ts` no Supabase de Produção permite apenas:
- `https://prontiasaude.com.br`
- `https://www.prontiasaude.com.br`
- `https://prontiasaude.lovable.app`
- `http://localhost:5173`

Os domínios de preview (`*.lovableproject.com`) **não estão na lista**.

### Solução CORS (se preferir manter tudo em Produção)

Alternativamente, você poderia atualizar o CORS no Supabase de Produção para incluir previews:

```typescript
// Em supabase/functions/common/cors.ts (Produção)
function isLovablePreviewOrigin(origin: string): boolean {
  return /^https:\/\/[a-f0-9-]+\.lovableproject\.com$/.test(origin);
}
```

Mas isso exigiria deploy manual no Supabase de Produção.

---

## Recomendação

A solução mais rápida é **publicar as alterações** e testar no site publicado. As funções de Produção já funcionam corretamente.

Se você precisar testar no preview com frequência, eu implemento a Solução 1 (detectar ambiente e usar Cloud Functions quando apropriado).

