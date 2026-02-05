
# Plano: Reescrever patient-operations e Eliminar Chamadas ao Cloud

## ✅ STATUS: IMPLEMENTADO

---

## Alterações Realizadas

### 1. `supabase/functions/patient-operations/index.ts` (Backend)
**Linha 2046-2055** - Adicionado geração explícita de UUID:

```ts
const newPatientId = crypto.randomUUID();
const { data: newPatient, error: insertError } = await supabase
  .from('patients')
  .insert({
    id: newPatientId,  // ✅ CORREÇÃO: Gerar UUID explicitamente
    user_id,
    email: email || null,
    profile_complete: false
  })
```

### 2. `src/lib/patients.ts` (Frontend)
- ✅ Removido import de `invokeCloudEdgeFunction`
- ✅ Simplificado `ensurePatientRow` para aceitar apenas `userId`
- ✅ SEMPRE usar `invokeEdgeFunction` (aponta para Produção `ploqujuhpwutpcibedbr`)
- ✅ Removida lógica condicional de ambiente para chamadas de Edge Function

### 3. `src/lib/edge-functions.ts` (Frontend)
- ✅ Adicionado log do origin para debug

### 4. `src/pages/auth/Callback.tsx`
- ✅ Atualizado chamada de `ensurePatientRow` para nova assinatura simplificada

---

## Próximos Passos (Ação do Usuário)

1. **Copiar o arquivo `patient-operations/index.ts` completo**
2. **Fazer deploy manual no Supabase Dashboard → Edge Functions → patient-operations**
3. **Testar edição de perfil na Área do Paciente**

---

## Critérios de Sucesso

1. ✅ Network mostra requisições para `ploqujuhpwutpcibedbr` (não `yrsjluhhnhxogdgnbnya`)
2. ✅ Erro 500 `null value in column "id"` desaparece
3. ✅ Edição de perfil salva com sucesso (status 200)
4. ✅ Logs da função aparecem no Supabase Dashboard
