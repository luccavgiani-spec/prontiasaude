

# Correção: Loop de Redirect Após Salvar Perfil (Versão Final)

## Problema Confirmado

Após salvar o perfil:
- Toast "Cadastro salvo" aparece ✓
- Dados são salvos no banco ✓
- `navigate('/area-do-paciente')` é chamado
- **AreaDoPaciente chama `getHybridSession()` que encontra sessão "fantasma" no Cloud**
- Busca paciente no Cloud → não existe ou `profile_complete = false`
- **Loop: redireciona de volta para `/completar-perfil`**

## Causa Raiz

A correção anterior só limpa sessão Cloud em `hybridSignUp` (novos cadastros). 

Mas o problema persiste porque:
1. O usuário pode ter sessão **residual** no Cloud (de login anterior ou de criação de user em ambos os ambientes)
2. `getHybridSession()` verifica Cloud **antes** de Produção (linha 292-294)
3. Quando o perfil é salvo na **Produção** mas há sessão no **Cloud**, o redirect falha

## Arquivo que será modificado

**`src/pages/CompletarPerfil.tsx`** (apenas este arquivo)

---

## Correção Proposta (Cirúrgica)

Antes de fazer o redirect após salvar o perfil, **limpar sessão do Cloud** para garantir que `getHybridSession()` encontre apenas a sessão de Produção.

### Localização: Linha ~714-719

**ANTES:**
```typescript
      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl) {
        window.location.href = decodeURIComponent(redirectUrl);
      } else {
        navigate('/area-do-paciente');
      }
```

**DEPOIS:**
```typescript
      // ✅ CORREÇÃO: Limpar sessão Cloud antes do redirect para evitar loop
      // (getHybridSession verifica Cloud primeiro, então precisamos garantir
      // que só a sessão de Produção existe antes de ir para /area-do-paciente)
      try {
        await supabase.auth.signOut();
        console.log('[CompletarPerfil] Cloud session cleared before redirect');
      } catch (e) {
        console.warn('[CompletarPerfil] Could not clear cloud session:', e);
      }

      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl) {
        window.location.replace(decodeURIComponent(redirectUrl));
      } else {
        // Usar window.location.replace para forçar reload e garantir detecção correta do ambiente
        window.location.replace('/area-do-paciente');
      }
```

---

## Por que isso resolve

1. Após salvar perfil, limpamos sessão do Cloud
2. `window.location.replace` força reload completo (não usa cache de estado React)
3. `AreaDoPaciente` → `getHybridSession()` → Cloud não tem sessão → verifica Produção → encontra sessão ativa
4. Busca paciente na Produção → `profile_complete = true`
5. Usuário permanece em `/area-do-paciente` ✓

---

## Validação

1. Criar nova conta de teste
2. Preencher e salvar perfil
3. Verificar que vai para `/area-do-paciente` (sem loop)
4. Verificar console:
   - `[CompletarPerfil] Cloud session cleared before redirect`
   - `[AreaDoPaciente] Usando cliente: production`
5. Recarregar página → deve permanecer

---

## Escopo

| Arquivo | Motivo | Escopo |
|---------|--------|--------|
| `src/pages/CompletarPerfil.tsx` | Limpar sessão Cloud + usar window.location.replace | Linhas ~714-719 (substituir 5 linhas por 13 linhas) |

**CONFIRMAÇÃO: Esta alteração está explicitamente solicitada? SIM** (você pediu para achar e corrigir pontualmente o erro de redirect pós-save)

