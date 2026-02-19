

# Correcao: Paciente nunca encontrado por user_id (causa logout/redirect loop)

## Diagnostico

O problema **nao e na patient-operations**. O problema e no **frontend** ao carregar dados do paciente.

### Fluxo atual (quebrado)

1. Usuario loga via Cloud → sessao tem `user_id = 19d8998f...` (ID do Cloud)
2. Na Producao, o registro `patients` tem `user_id = 131d55f8...` (ID da Producao)
3. `AreaDoPaciente` (linha 60-64) busca: `patients WHERE user_id = 19d8998f` → nao encontra
4. Fallback (linha 69-74) tenta outro cliente mas com o **mesmo user_id Cloud** → tambem nao encontra
5. Resultado: perfil nao encontrado → redireciona para `/completar-perfil` (parece "logout")
6. Mesmo problema no `AuthCallback` (linhas 124-141): busca por user_id Cloud, nao encontra, redireciona para `/completar-perfil`

**Os IDs de usuario sao DIFERENTES entre Cloud e Producao. Buscar por user_id nunca vai funcionar cross-environment.**

### Solucao: Buscar por email como fallback

O email do usuario e o mesmo em ambos os ambientes. Quando a busca por `user_id` falhar, buscar por `email`.

## Arquivos a alterar (2 arquivos frontend)

### 1. `src/pages/AreaDoPaciente.tsx` (linhas 60-115)

Adicionar fallback por email quando nenhum dos dois clientes encontrar o paciente por user_id:

```typescript
// Apos tentar user_id em ambos os clientes sem resultado:
if (!patientFound && session.user.email) {
  // Buscar por email na Producao (onde os dados reais estao)
  const { data: byEmail } = await supabaseProductionAuth
    .from('patients')
    .select('*')
    .eq('email', session.user.email.toLowerCase())
    .maybeSingle();
  
  if (byEmail?.profile_complete) {
    setPatient(byEmail as Patient);
  } else {
    window.location.replace('/completar-perfil');
    return;
  }
}
```

### 2. `src/pages/auth/Callback.tsx` (linhas 119-141)

Mesmo padrao - fallback por email:

```typescript
// Se nao encontrou por user_id em nenhum ambiente
if (!patientData && session.user.email) {
  const { data: byEmail } = await supabaseProductionAuth
    .from('patients')
    .select('profile_complete')
    .eq('email', session.user.email.toLowerCase())
    .maybeSingle();
  patientData = byEmail;
}
```

## Erro PGRST204 (complement)

Este erro e separado e persiste porque o cache do PostgREST na Producao esta desatualizado.

**Acao obrigatoria no dashboard do Supabase de Producao** (`ploqujuhpwutpcibedbr`):

1. Abrir **SQL Editor**
2. Executar: `NOTIFY pgrst, 'reload schema';`
3. Opcionalmente, ir em **Settings > API** e clicar **"Reload Schema"**

Sem isso, qualquer update que inclua a coluna `complement` vai falhar com PGRST204.

## Resumo

| Problema | Causa | Correcao | Onde |
|----------|-------|----------|------|
| CPF edit causa "logout" | `AreaDoPaciente` e `Callback` buscam por `user_id` do Cloud, mas paciente na Producao tem outro `user_id` | Adicionar fallback por email | `src/pages/AreaDoPaciente.tsx`, `src/pages/auth/Callback.tsx` |
| PGRST204 complement | Cache do PostgREST desatualizado | `NOTIFY pgrst, 'reload schema';` | SQL Editor do Supabase de Producao |

