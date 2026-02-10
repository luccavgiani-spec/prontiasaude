

# Ajuste pontual: Chamar validate-invite separada + corrigir campo invite_token

## Resumo

Alterar `src/pages/CompletarPerfil.tsx` em 3 pontos:

## Alteracao 1 - Chamar Edge Function correta (linhas 139-154)

**Antes:**
```typescript
const { data, error } = await invokeEdgeFunction('company-operations', {
  body: { operation: 'validate-invite', token: inviteToken }
});
```

**Depois:**
```typescript
const { data, error } = await invokeEdgeFunction('validate-invite', {
  body: { token: inviteToken }
});
```

A logica de verificacao de `data.valid`, `data.invite` e `data.reason` permanece identica.

## Alteracao 2 - Corrigir campo do token empresarial (linhas 452-454)

**Antes:**
```typescript
// Convite empresarial - usar inviteData.token
sessionStorage.setItem('pending_invite_token', inviteData.token);
localStorage.setItem('pending_invite_token', inviteData.token);
```

**Depois:**
```typescript
// Convite empresarial - usar inviteData.invite_token
sessionStorage.setItem('pending_invite_token', inviteData.invite_token);
localStorage.setItem('pending_invite_token', inviteData.invite_token);
```

## Alteracao 3 - Corrigir campo na ativacao do plano (linha 613)

**Antes:**
```typescript
invite_token: inviteData.token,
```

**Depois:**
```typescript
invite_token: inviteData.invite_token,
```

## Arquivo modificado

| Arquivo | Linhas |
|---------|--------|
| `src/pages/CompletarPerfil.tsx` | 140-141, 452-454, 613 |

## Nenhum outro arquivo alterado

