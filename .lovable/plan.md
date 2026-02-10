

# Correção: "Convite expirado/inválido" ao aceitar convite

## Causa Raiz

O convite foi criado na **Produção** pela Edge Function `company-operations`. Porém, quando o funcionário clica no link do email e chega em `/completar-perfil?token=XXX`, a página `CompletarPerfil.tsx` busca o convite usando o cliente **Cloud** (`supabase` do Lovable Cloud):

```
supabase.from('pending_employee_invites').select(...).eq('token', token)
```

Como o registro do convite só existe na **Produção**, a query retorna vazio e o sistema exibe "Convite inválido" ou "Convite expirado".

## Solução

Alterar a função `validateInviteToken` em `CompletarPerfil.tsx` para buscar o convite via **Edge Function** (`invokeEdgeFunction`) que roda na Produção, ao invés de consultar diretamente pelo cliente Cloud.

A Edge Function `company-operations` já roda na Produção. Basta adicionar uma operação `validate-invite` que:

1. Recebe o `token` do convite
2. Busca em `pending_employee_invites` na Produção
3. Retorna os dados do convite (incluindo dados da empresa via join)

## Alterações

### 1. `supabase/functions/company-operations/index.ts`

Adicionar nova operação `validate-invite` que:
- Recebe `{ operation: "validate-invite", token: "xxx" }`
- Faz a mesma query que o frontend fazia, mas na Produção
- Retorna os dados do convite com join na tabela `companies`
- Não requer autenticação (o token do convite é a validação)

### 2. `src/pages/CompletarPerfil.tsx` (apenas a função `validateInviteToken`)

Substituir a query direta ao Cloud:
```
supabase.from('pending_employee_invites')...
```

Por chamada à Edge Function:
```
invokeEdgeFunction('company-operations', {
  body: { operation: 'validate-invite', token: inviteToken }
})
```

O restante da lógica (verificação de expiração, verificação de sessão, preenchimento de formulário) permanece idêntico.

## Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/company-operations/index.ts` | Adicionar operação `validate-invite` |
| `src/pages/CompletarPerfil.tsx` | Alterar `validateInviteToken` para usar `invokeEdgeFunction` |

## Arquivos NAO alterados

- `src/components/empresa/BulkInviteModal.tsx`
- `src/hooks/useCompanyAuth.ts`
- Nenhuma outra Edge Function
- Nenhum outro componente

## Nota

Como `company-operations` roda na Produção, após a alteração você precisará copiar o código atualizado e fazer deploy manualmente no dashboard do Supabase de Produção.
