

# Correcao: Usar operacao `upsert_patient` e remover dependencia de sessao

## Problema

1. `patients.ts` chama `operation: 'upsert_profile'` mas a Edge Function so tem `upsert_patient`
2. `patients.ts` depende de `getHybridSession()` para obter `userId`, mas no fluxo de convite pode nao haver sessao ativa
3. `CompletarPerfil.tsx` faz SELECT direto em `dbClient.from('patients')` apos o upsert (linhas 568-572) e verificacao de CPF (linhas 523-528), o que tambem falha sem sessao

## Alteracoes

### Arquivo 1: `src/lib/patients.ts`

**Mudanca na assinatura**: Adicionar parametros opcionais `userId` e `userEmail` ao payload de `upsertPatientBasic`, para que o caller possa fornecer esses valores quando nao houver sessao.

**Mudanca na operacao (linha 83)**: Trocar `operation: 'upsert_profile'` por `operation: 'upsert_patient'`.

**Mudanca no body**: Enviar `name: first_name + ' ' + last_name`, `email`, `phone_e164` conforme formato esperado pela Edge Function. Manter campos adicionais no body (cpf, birth_date, etc.) pois a Edge Function pode ignora-los sem erro.

**Remover dependencia de sessao para userId**: Se `payload.userId` e `payload.userEmail` forem fornecidos, usar esses valores ao inves de chamar `getHybridSession()`. Isso permite que o fluxo de convite funcione sem sessao.

**Remover chamada `ensurePatientRow`**: A operacao `upsert_patient` ja cria o registro se nao existir.

**Usar `user_id` retornado**: Apos o upsert, usar `upsertResult.user_id` para o webhook GAS ao inves de depender de sessao.

### Arquivo 2: `src/pages/CompletarPerfil.tsx`

**Linhas 520-528 (verificacao de CPF via dbClient)**: Substituir por chamada a Edge Function ou remover, ja que o `dbClient` pode nao ter sessao valida. A verificacao de CPF duplicado pode ser feita pela propria Edge Function no backend.

**Linhas 550-565 (chamada upsertPatientBasic)**: Passar `userId` e `userEmail` explicitamente a partir de `activeUser.id` e `activeUser.email` (ou `inviteData.email`).

**Linhas 567-599 (SELECT de verificacao pos-save)**: Remover verificacao direta via `dbClient.from('patients')`. Confiar no retorno da Edge Function (`success: true, user_id`) como confirmacao.

## Detalhes tecnicos

### patients.ts - Nova assinatura e logica

```typescript
export async function upsertPatientBasic(payload: {
  first_name: string;
  last_name: string;
  // ... campos existentes ...
  userId?: string;    // NOVO: fornecido pelo caller
  userEmail?: string; // NOVO: fornecido pelo caller
}) {
  // Tentar sessao, mas aceitar valores explicitoes
  let userId = payload.userId;
  let userEmail = payload.userEmail;
  let accessToken: string | undefined;
  
  if (!userId || !userEmail) {
    const { session, environment } = await getHybridSession();
    userId = userId || session?.user?.id;
    userEmail = userEmail || session?.user?.email;
    accessToken = session?.access_token;
  }

  // Validacoes...

  const fullName = `${payload.first_name} ${payload.last_name}`.trim();

  const { data: upsertResult, error: upsertError } = await invokeEdgeFunction('patient-operations', {
    body: {
      operation: 'upsert_patient',
      name: fullName,
      email: userEmail,
      phone_e164: payload.phone_e164,
      cpf: cleanCpf,
      birth_date: payload.birth_date,
      // demais campos...
    }
  });

  // Usar upsertResult.user_id para o resto do fluxo
}
```

### CompletarPerfil.tsx - Chamada atualizada

```typescript
await upsertPatientBasic({
  first_name: formData.first_name,
  last_name: formData.last_name,
  // ... demais campos ...
  userId: activeUser?.id,
  userEmail: activeUser?.email || inviteData?.email,
});
```

Remover o bloco de verificacao pos-save (linhas 567-599) e a verificacao de CPF via dbClient (linhas 522-539), substituindo por logica baseada no retorno da Edge Function.

## Resumo de arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/patients.ts` | Trocar operacao para `upsert_patient`, aceitar userId/userEmail como params, remover ensurePatientRow |
| `src/pages/CompletarPerfil.tsx` | Passar userId/userEmail, remover SELECT direto pos-save e verificacao CPF via dbClient |

## Nenhum outro arquivo alterado

