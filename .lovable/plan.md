

# Correcao: 2 erros na patient-operations em Producao

## Erro 1: Foreign key violation no `ensure_patient`

**Causa**: O frontend envia o `user_id` do Cloud (`19d8998f...`) para a operacao `ensure_patient`. Mas na Producao, a tabela `patients` tem uma foreign key `patients_user_id_fkey` que referencia `auth.users`. Como o usuario `19d8998f` so existe no Cloud (nao na Producao), o INSERT falha com erro `23503`.

O usuario na Producao tem ID `131d55f8-b7b3-409d-8ead-2ae5b67e5ffe` (confirmado nos logs do `check-user-exists`).

**Solucao**: Modificar a operacao `ensure_patient` no arquivo `supabase/functions/patient-operations/index.ts` para, antes de inserir, buscar o `user_id` correto na Producao pelo email:

```typescript
case "ensure_patient": {
  let { user_id, email } = body;

  // Se o user_id veio do Cloud, buscar o user_id correto na Producao pelo email
  if (email) {
    const { data: prodUser } = await supabase
      .from("patients")
      .select("user_id")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    
    if (prodUser?.user_id) {
      user_id = prodUser.user_id;
    } else {
      // Buscar no auth da Producao
      const { data: authUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 50 });
      const found = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (found) {
        user_id = found.id;
      }
    }
  }
  // ... resto do codigo continua igual
```

## Erro 2: Coluna `complement` nao encontrada no schema cache

**Causa**: O PostgREST da Producao tem um cache de schema desatualizado. A coluna `complement` existe na tabela `patients` (confirmado no schema), mas o PostgREST nao a reconhece.

**Solucao**: Executar o seguinte comando SQL no dashboard do Supabase de Producao (`ploqujuhpwutpcibedbr`):

```sql
NOTIFY pgrst, 'reload schema';
```

Isso forca o PostgREST a recarregar o cache e reconhecer todas as colunas atuais.

## Resumo das acoes

| Acao | Onde | O que fazer |
|------|------|-------------|
| 1 | `supabase/functions/patient-operations/index.ts` (operacao `ensure_patient`, ~linha 2164) | Adicionar busca do user_id correto da Producao pelo email antes de inserir |
| 2 | Dashboard Supabase Producao > SQL Editor | Executar `NOTIFY pgrst, 'reload schema';` |

Ambas as acoes precisam ser feitas diretamente no Supabase de Producao. A alteracao no arquivo aqui no Lovable serve como referencia para voce copiar e deployar manualmente.

