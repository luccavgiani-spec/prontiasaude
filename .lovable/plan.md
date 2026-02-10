

# Correcao: FK violation ao salvar patients no fluxo de convite

## Diagnostico

O erro `patients_user_id_fkey` ocorre porque `upsertPatientBasic` (em `src/lib/patients.ts`) faz operacoes diretas no banco via `dbClient.from('patients').insert(...)` nas linhas 88-132. Esse acesso direto falha porque:

1. `ensurePatientRow` cria o registro via Edge Function com `service_role` (funciona)
2. Logo apos, o SELECT direto via `dbClient` (linha 89) pode retornar null por restricao de RLS ou sessao invalida no ambiente
3. Quando retorna null, o codigo tenta INSERT direto com `user_id` que pode nao existir no `auth.users` do ambiente apontado pelo `dbClient`

## Solucao

Substituir as operacoes diretas no banco (SELECT + INSERT/UPDATE nas linhas 88-132) por uma unica chamada a Edge Function `patient-operations` com uma operacao de upsert completo. A Edge Function usa `service_role` e opera diretamente no banco de Producao, sem restricoes de FK/RLS.

## Alteracao no frontend

### Arquivo: `src/lib/patients.ts`

Substituir as linhas 88-132 (SELECT + INSERT/UPDATE direto) por:

```typescript
// Upsert completo via Edge Function (service_role, bypassa FK/RLS)
const { data: upsertResult, error: upsertError } = await invokeEdgeFunction('patient-operations', {
  body: {
    operation: 'upsert_profile',
    user_id: userId,
    email: userEmail,
    first_name: payload.first_name,
    last_name: payload.last_name,
    address_line: payload.address_line,
    cpf: cleanCpf,
    phone_e164: payload.phone_e164,
    birth_date: payload.birth_date,
    gender: payload.gender,
    cep: cleanCep,
    address_number: payload.address_number,
    complement: payload.address_complement || null,
    city: payload.city,
    state: payload.state,
    source: payload.source || 'site',
    terms_accepted: payload.termsAccepted,
    profile_complete: true
  }
});

if (upsertError) {
  console.error('Edge function upsert error (patients):', upsertError);
  throw new Error(upsertError.message || 'Falha ao salvar seus dados.');
}
```

Tambem remover os imports nao mais necessarios: `supabaseProductionAuth` e a logica de selecao de `dbClient` (linhas 64-66), ja que o upsert agora e feito inteiramente via Edge Function.

## Requisito no backend (Producao)

Voce precisa adicionar a operacao `upsert_profile` na sua Edge Function `patient-operations` no Supabase de Producao. Logica sugerida:

```typescript
if (operation === 'upsert_profile') {
  const { user_id, email, first_name, last_name, address_line, cpf, phone_e164,
          birth_date, gender, cep, address_number, complement, city, state,
          source, terms_accepted, profile_complete } = body;

  const { data, error } = await supabaseAdmin
    .from('patients')
    .upsert({
      user_id,
      email,
      first_name,
      last_name,
      address_line,
      cpf,
      phone_e164,
      birth_date,
      gender,
      cep,
      address_number,
      complement,
      city,
      state,
      source: source || 'site',
      terms_accepted_at: terms_accepted ? new Date().toISOString() : null,
      profile_complete: profile_complete ?? true,
    }, { onConflict: 'user_id' });

  if (error) throw error;
  return new Response(JSON.stringify({ success: true, data }), ...);
}
```

## Resumo de arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/patients.ts` | Substituir linhas 64-66 e 88-132 por invokeEdgeFunction |

## Nenhum outro arquivo alterado

## Resultado esperado

O salvamento de patients passa inteiramente pela Edge Function com `service_role`, eliminando violacoes de FK e problemas de RLS no ambiente hibrido.

