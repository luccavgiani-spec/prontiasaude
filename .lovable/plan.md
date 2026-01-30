
# Plano: Correção do Fluxo Google OAuth para Sincronização com Produção

## Objetivo
Garantir que usuários que fazem login via Google OAuth sejam criados em **AMBOS** os ambientes (Cloud + Produção), evitando que fiquem apenas com "Origem: Cloud".

---

## Arquivos a Modificar

### 1. Nova Edge Function: `supabase/functions/sync-google-user/index.ts`
**Localização:** Lovable Cloud (deploy automático)

**Propósito:** Criar/sincronizar usuário na Produção quando já existe no Cloud (login Google)

**Diferença do `create-user-both-envs`:**
- Aceita usuários que já existem no Cloud (não falha)
- Cria apenas na Produção se não existir lá
- Usa senha aleatória gerada (usuário nunca vai usar - login é via Google)

### 2. Modificação: `src/pages/Entrar.tsx`
**Alteração no callback do Google Login:**
- Após `signInWithIdToken` bem-sucedido, chamar `sync-google-user` em background
- Não bloquear o fluxo se a sincronização falhar (é secundário)

### 3. Modificação: `src/pages/auth/Callback.tsx`
**Alteração adicional de segurança:**
- Verificar se usuário existe na Produção
- Se não existir, chamar `sync-google-user` (fallback)

---

## Detalhamento Técnico

### Edge Function: sync-google-user

```typescript
// Fluxo:
// 1. Recebe: email, cloudUserId, metadata (nome do Google)
// 2. Verifica se já existe na Produção auth.users
// 3. Se NÃO existe: criar com senha aleatória + email_confirm: true
// 4. Sincroniza tabela patients em ambos os ambientes
// 5. Retorna: prodUserId (ou null se já existia)
```

**Campos do metadata aproveitados do Google:**
- `given_name` → `first_name`
- `family_name` → `last_name`
- `email` → `email`

### Alteração em Entrar.tsx

```typescript
// Dentro do callback do Google (linha ~202-233):
// APÓS: console.log('[Google Login] ✅ Sessão estabelecida para:', session.user.email);
// ADICIONAR:

// ✅ SINCRONIZAR COM PRODUÇÃO (em background, não bloqueia)
try {
  await invokeCloudEdgeFunction('sync-google-user', {
    body: {
      email: session.user.email,
      cloudUserId: session.user.id,
      metadata: {
        first_name: session.user.user_metadata?.given_name || session.user.user_metadata?.first_name,
        last_name: session.user.user_metadata?.family_name || session.user.user_metadata?.last_name,
      }
    }
  });
  console.log('[Google Login] ✅ Usuário sincronizado com Produção');
} catch (e) {
  console.warn('[Google Login] Sincronização com Produção falhou (não crítico):', e);
}
```

### Alteração em AuthCallback.tsx

Adicionar verificação de fallback após linha 80:

```typescript
// ✅ FALLBACK: Se login foi via Cloud (Google), garantir que existe na Produção
if (authEnvironment === 'cloud' && session?.user?.email) {
  try {
    await invokeCloudEdgeFunction('sync-google-user', {
      body: {
        email: session.user.email,
        cloudUserId: session.user.id,
        metadata: {
          first_name: session.user.user_metadata?.given_name,
          last_name: session.user.user_metadata?.family_name,
        }
      }
    });
  } catch (e) {
    console.warn('[AuthCallback] Sync to production failed:', e);
  }
}
```

---

## Configuração Necessária

### supabase/config.toml
Adicionar a nova função:

```toml
[functions.sync-google-user]
verify_jwt = false
```

---

## Fluxo Após Correção

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO GOOGLE LOGIN CORRIGIDO                 │
├─────────────────────────────────────────────────────────────────┤
│  1. Usuário clica "Entrar com Google"                          │
│  2. Google Identity Services → signInWithIdToken (Cloud)       │
│  3. Sessão criada no Cloud auth.users                          │
│  4. ✨ NOVO: sync-google-user chamado em background             │
│     → Verifica se existe na Produção                           │
│     → Se NÃO: cria com senha aleatória                         │
│     → Sincroniza patients em ambos                             │
│  5. Usuário redirecionado para /auth/callback                  │
│  6. ✨ FALLBACK: AuthCallback verifica e sincroniza novamente   │
│  7. Fluxo normal continua (completar-perfil ou area-paciente)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## O que NÃO precisa fazer manualmente

- Nenhuma alteração no Supabase de Produção
- A edge function `sync-google-user` será deployada automaticamente no Lovable Cloud
- As secrets já existem (`ORIGINAL_SUPABASE_SERVICE_ROLE_KEY` está configurada)

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Login Google → Origem: Cloud | Login Google → Origem: Ambos |
| auth.users apenas no Cloud | auth.users em Cloud + Produção |
| patients com user_id do Cloud | patients com user_id correto em cada ambiente |

---

## Arquivos que serão criados/modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/sync-google-user/index.ts` | Criar |
| `supabase/config.toml` | Adicionar entrada |
| `src/pages/Entrar.tsx` | Modificar callback Google |
| `src/pages/auth/Callback.tsx` | Adicionar fallback sync |

---

## Sobre Sincronização Retroativa (355 usuários)

**Recomendação: NÃO FAZER**

O benefício é apenas cosmético (mudar "Origem: Cloud" para "Origem: Ambos" no admin). Na prática:
- Esses usuários já conseguem fazer login
- Esses usuários já conseguem completar perfil
- Esses usuários já conseguem comprar consultas/planos
- A tabela `patients` já está sincronizada (é onde os dados reais ficam)

A única diferença seria visual no painel admin. Se quiser fazer no futuro, posso criar o script, mas não é necessário para o funcionamento do sistema.
