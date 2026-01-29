
# Plano de Correção: Redirecionamento Incorreto para /completar-perfil

## Problema
Usuários novos e existentes são sempre redirecionados para `/completar-perfil` ao invés de `/area-do-paciente`, mesmo após completar o cadastro com sucesso.

## Causa Raiz
O sistema híbrido (Cloud + Produção) tem inconsistências nos clientes de banco de dados:

| Local | Operação | Cliente Usado | Cliente Correto |
|-------|----------|---------------|-----------------|
| `AuthCallback.tsx:75` | `ensurePatientRow()` | `supabase` (Cloud) | `dbClient` (baseado no ambiente) |
| `CompletarPerfil.tsx:568` | Verificação pós-save | `supabase` (Cloud) | `supabaseProductionAuth` |
| `CompletarPerfil.tsx:523` | Verificação CPF duplicado | `supabase` (Cloud) | Cliente híbrido |

### O que acontece:
1. Usuário cria conta via `hybridSignUp` → sessão fica na **Produção**
2. `upsertPatientBasic` salva dados na **Produção** (corrigido anteriormente)
3. `CompletarPerfil.tsx` verifica se dados foram salvos usando **Cloud** → não encontra!
4. Erro é lançado OU dados aparecem como "faltando"
5. `AuthCallback.tsx` também verifica usando cliente inconsistente → `profile_complete = false`
6. Usuário é redirecionado para `/completar-perfil` em loop

---

## Arquivos que serão modificados

1. `src/pages/auth/Callback.tsx` - Passar cliente correto para `ensurePatientRow`
2. `src/pages/CompletarPerfil.tsx` - Usar cliente híbrido para verificações pós-save e CPF duplicado

---

## Correção 1: AuthCallback.tsx

### Linha 6 (imports) - ADICIONAR:
```typescript
import { supabaseProductionAuth } from '@/lib/auth-hybrid';
```

### Linha 74-78 - ANTES:
```typescript
try {
  await ensurePatientRow(session.user.id);
} catch (e) {
  console.error('ensurePatientRow error:', e);
}
```

### DEPOIS:
```typescript
try {
  // ✅ HÍBRIDO: Usar cliente correto baseado no ambiente
  const patientDbClient = authEnvironment === 'production' ? supabaseProductionAuth : supabase;
  await ensurePatientRow(session.user.id, patientDbClient);
} catch (e) {
  console.error('ensurePatientRow error:', e);
}
```

---

## Correção 2: CompletarPerfil.tsx

### Linha 2 (imports) - ADICIONAR:
```typescript
import { getHybridSession, supabaseProductionAuth } from "@/lib/auth-hybrid";
```

### Linha 521-572 - ANTES:
```typescript
try {
  // ✅ VERIFICAR CPF DUPLICADO
  const { data: existingCPF } = await supabase
    .from('patients')
    ...
    
  // ✅ Verificar se dados foram salvos corretamente
  const { data: savedPatient, error: checkError } = await supabase
    .from('patients')
    ...
```

### DEPOIS:
```typescript
try {
  // ✅ HÍBRIDO: Detectar ambiente para usar cliente correto
  const { environment } = await getHybridSession();
  const dbClient = environment === 'production' ? supabaseProductionAuth : supabase;
  
  // ✅ VERIFICAR CPF DUPLICADO (usando cliente híbrido)
  const { data: existingCPF } = await dbClient
    .from('patients')
    ...
    
  // ✅ Verificar se dados foram salvos corretamente (usando mesmo cliente)
  const { data: savedPatient, error: checkError } = await dbClient
    .from('patients')
    ...
```

---

## Por que isso resolve

1. **AuthCallback**: Agora cria o registro `patients` no ambiente correto (Produção se for production)
2. **CompletarPerfil (CPF)**: Verifica duplicidade no banco correto
3. **CompletarPerfil (verificação)**: Confirma que os dados foram salvos usando o MESMO cliente que salvou
4. **Fluxo completo**: Todos os pontos usam o mesmo ambiente → `profile_complete = true` é encontrado → redirecionamento para `/area-do-paciente`

---

## Validação pós-implementação

1. Criar nova conta de teste
2. Verificar que o cadastro é salvo sem erros
3. Confirmar redirecionamento para `/area-do-paciente` (não `/completar-perfil`)
4. Fazer logout e login novamente
5. Confirmar que vai direto para `/area-do-paciente`

---

## Resumo

| Arquivo | Motivo | Escopo |
|---------|--------|--------|
| `src/pages/auth/Callback.tsx` | Passar cliente correto para `ensurePatientRow` | Linhas 6, 74-78 |
| `src/pages/CompletarPerfil.tsx` | Usar cliente híbrido para verificações | Linhas 2, 521-572 |

**CONFIRMAÇÃO: Estas alterações estão explicitamente solicitadas? SIM**
