
# Correção: Loop de Redirecionamento Após Salvar Perfil

## Problema Identificado
Após salvar o perfil com sucesso, o usuário é redirecionado para `/area-do-paciente`, mas essa página o manda de volta para `/completar-perfil` em loop.

## Causa Raiz (com base no código)

O `hybridSignUp` (cadastro) executa:
1. Cria usuário em **ambos** os ambientes (Cloud + Produção)
2. Faz login automático apenas na **Produção** (linha 215-218)

Porém, o usuário que já existia ou tem sessão residual no **Cloud** causa problema:

### O conflito está no `getHybridSession()`:
```typescript
// Linha 282-284: Verifica Cloud PRIMEIRO
const { data: cloudData } = await supabase.auth.getSession();
if (cloudData.session) {
  return { session: cloudData.session, environment: 'cloud' };  // ← PRIORIZA CLOUD
}
```

### Fluxo problemático:
1. Cadastro: `hybridSignUp` cria user em Produção + Cloud, mas faz login apenas na **Produção**
2. Perfil salvo: `upsertPatientBasic` salva `profile_complete = true` na **Produção**
3. Redirect: `navigate('/area-do-paciente')`
4. `AreaDoPaciente` chama `getHybridSession()` → verifica **Cloud primeiro**
5. Se houver sessão "fantasma" no Cloud (usuário antigo ou criado junto), retorna `environment: 'cloud'`
6. Busca paciente no **Cloud** → não existe ou `profile_complete = false`
7. Loop: redireciona para `/completar-perfil`

---

## Arquivo que será modificado

**`src/lib/auth-hybrid.ts`** (apenas este arquivo)

---

## Correção Proposta

Após o cadastro bem-sucedido em `hybridSignUp`, fazer `signOut` do Cloud antes de fazer login na Produção. Isso garante que não haverá sessão "fantasma" no Cloud conflitando.

### Linha ~212-215 - ADICIONAR signOut do Cloud ANTES do login na Produção:

**ANTES:**
```typescript
    // Fazer login automaticamente na Produção após criar
    console.log('[hybridSignUp] Fazendo login automático na Produção...');
    const { data: loginData, error: loginError } = await supabaseProductionAuth.auth.signInWithPassword({
```

**DEPOIS:**
```typescript
    // ✅ CORREÇÃO: Limpar qualquer sessão no Cloud antes de fazer login na Produção
    // Isso evita que getHybridSession() encontre sessão "fantasma" no Cloud
    // e cause conflito com o ambiente de Produção onde os dados foram salvos
    try {
      await supabase.auth.signOut();
      console.log('[hybridSignUp] Cloud session cleared');
    } catch (e) {
      console.warn('[hybridSignUp] Could not clear cloud session:', e);
    }

    // Fazer login automaticamente na Produção após criar
    console.log('[hybridSignUp] Fazendo login automático na Produção...');
    const { data: loginData, error: loginError } = await supabaseProductionAuth.auth.signInWithPassword({
```

---

## Por que isso resolve

1. **Antes do login na Produção**, limpamos qualquer sessão residual no Cloud
2. Quando `getHybridSession()` verificar Cloud, não encontrará sessão
3. `getHybridSession()` verificará Produção → encontrará a sessão ativa
4. `AreaDoPaciente` usará cliente de **Produção** → encontrará `profile_complete = true`
5. Usuário permanece em `/area-do-paciente` ✓

---

## Validação

1. Criar nova conta de teste
2. Preencher e salvar perfil
3. Verificar que vai para `/area-do-paciente` (sem loop)
4. Recarregar a página
5. Confirmar que permanece em `/area-do-paciente`
6. Logout e login novamente → deve ir para área do paciente

---

## Escopo (alinhado às suas regras)

| Arquivo | Motivo | Escopo |
|---------|--------|--------|
| `src/lib/auth-hybrid.ts` | Limpar sessão Cloud antes do login Produção | Linhas ~212-215 (adicionar 7 linhas) |

**CONFIRMAÇÃO: Esta alteração está explicitamente solicitada? SIM** (você pediu para achar e corrigir pontualmente o erro de redirect pós-save)
