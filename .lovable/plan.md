
# Correcao: `listUsers()` sem paginacao impede UPDATE de pacientes existentes

## Problema Identificado

Na edge function `patient-operations`, operacao `upsert_patient`, quando o usuario ja existe no auth do Supabase:

1. `createUser` retorna erro "already registered" (correto, tratado)
2. `userId` fica `null` (correto)
3. **Linha 745**: `supabase.auth.admin.listUsers()` e chamado SEM parametros
4. O Supabase retorna apenas os **primeiros 50 usuarios** por padrao
5. Se o email do usuario nao esta nessa primeira pagina, `finalUserId` fica `null`
6. O bloco de UPDATE (linha 751) **nao e executado** porque `if (finalUserId)` e falso
7. A funcao retorna `{ success: true }` mesmo sem ter gravado nada

Esse e o motivo do "sucesso mas dado nao muda".

## Solucao

### Arquivo: `supabase/functions/patient-operations/index.ts`

Substituir o `listUsers()` generico por uma busca direta por email, que e muito mais eficiente e confiavel:

**Linhas 744-748 - Trocar listUsers por getUserByEmail:**

De:
```typescript
let finalUserId = userId;
if (!finalUserId) {
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const found = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  finalUserId = found?.id || null;
}
```

Para:
```typescript
let finalUserId = userId;
if (!finalUserId) {
  // Buscar direto na tabela patients por email (evita listUsers paginado)
  const { data: patientByEmail } = await supabase
    .from("patients")
    .select("user_id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  
  if (patientByEmail?.user_id) {
    finalUserId = patientByEmail.user_id;
    console.log("[upsert_patient] Found user_id via patients table:", finalUserId);
  } else {
    // Fallback: buscar no auth com paginacao
    let page = 1;
    const perPage = 100;
    while (!finalUserId) {
      const { data: usersPage } = await supabase.auth.admin.listUsers({ page, perPage });
      if (!usersPage?.users?.length) break;
      const found = usersPage.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (found) {
        finalUserId = found.id;
        break;
      }
      if (usersPage.users.length < perPage) break;
      page++;
    }
  }
}
```

### Por que essa abordagem

- **Primeiro tenta pela tabela `patients`**: busca direta por email, sem paginacao, instantanea
- **Fallback com paginacao**: se por algum motivo o paciente nao existir na tabela mas existir no auth, percorre todas as paginas
- **Nenhum outro arquivo sera alterado**

### Depois de aplicar

O codigo atualizado precisa ser **deployado manualmente no Supabase de Producao** (`ploqujuhpwutpcibedbr`), como nas correcoes anteriores.
