
# Correcao: Garantir sessao ativa antes de salvar patients

## Problema

O `handleSave` em `CompletarPerfil.tsx` cria o usuario usando `supabase.auth.signUp` (Cloud apenas), mas o salvamento de `patients` via `upsertPatientBasic` precisa de sessao ativa no ambiente de Producao. Como o usuario so foi criado no Cloud, `auth.uid()` e null na Producao, gerando erro 500.

## Causa raiz

Linha 435 usa `supabase.auth.signUp` (cliente Cloud) ao inves de `hybridSignUp` que cria o usuario em AMBOS os ambientes (Cloud + Producao) e faz login automatico na Producao.

## Alteracao

### Arquivo: `src/pages/CompletarPerfil.tsx`

**1. Adicionar import do `hybridSignUp` (linha 9)**

Adicionar `hybridSignUp` e `hybridSignIn` ao import existente de `@/lib/auth-hybrid`.

**2. Substituir bloco de criacao de usuario (linhas 433-501)**

Substituir `supabase.auth.signUp` + `supabase.auth.signInWithPassword` por `hybridSignUp`, que:
- Cria usuario em ambos os ambientes (Cloud + Producao)
- Faz login automatico na Producao
- Retorna sessao valida com `auth.uid()` preenchido

Para o caso de "usuario ja existe", usar `hybridSignIn` ao inves de `supabase.auth.signInWithPassword`.

Logica resultante:

```
if (inviteData && !activeUser) {
  // Tentar criar conta em ambos ambientes
  const result = await hybridSignUp(inviteData.email, password);
  
  if (!result.success) {
    if (erro == "ja cadastrado") {
      // Tentar login hibrido
      const loginResult = await hybridSignIn(inviteData.email, password);
      if (loginResult.success) {
        activeUser = loginResult.session.user;
      } else {
        // Redirecionar para /entrar com token salvo
      }
    }
  } else {
    activeUser = result.user;
  }
}
```

**3. Verificacao de sessao antes de salvar (apos linha 501)**

Adicionar verificacao explicita de sessao antes de prosseguir:

```
// Verificar sessao ativa apos autenticacao
const { session } = await getHybridSession();
if (!session) {
  // Erro: sessao nao obtida
  return;
}
activeUser = session.user; // Garantir user_id correto
```

## Arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/CompletarPerfil.tsx` | Import + bloco de autenticacao (linhas 9, 433-501) |

## Nenhum outro arquivo alterado

## Resultado esperado

Ao clicar em "Salvar cadastro", o usuario e criado em ambos os ambientes, a sessao de Producao fica ativa, e o `upsertPatientBasic` encontra `auth.uid()` preenchido.
