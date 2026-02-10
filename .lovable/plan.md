
# Correção: "Forbidden: Can only invite employees for your own company"

## Causa Raiz

O fluxo de convite de funcionários está quebrado por **incompatibilidade de IDs entre ambientes**:

1. A empresa loga no Cloud e o `useCompanyAuth` carrega `company.id` do **Cloud** (ex: `abc-111`)
2. O `BulkInviteModal` envia `company_id: "abc-111"` para `company-operations` na **Produção**
3. A Produção busca `company_credentials` pelo `user_id` de Produção e encontra `company_id: "xyz-999"` (ID de Produção)
4. Compara: `"xyz-999" !== "abc-111"` --> **Forbidden!**

O mesmo problema afeta tanto convites individuais quanto importação em massa.

## Solução

Alterar a validação de ownership em `company-operations` (Produção) para buscar a empresa pelo **CNPJ** ao invés de comparar UUIDs diretamente. Como o CNPJ é unico e identico em ambos os ambientes, isso resolve a incompatibilidade.

## Alteracao

**Arquivo:** `supabase/functions/company-operations/index.ts` (linhas 309-324)

**Logica atual (quebrada):**
```text
if (isCompany) {
  busca company_credentials.company_id pelo user.id
  compara company_credentials.company_id === bodyData.company_id
  --> FALHA (IDs de ambientes diferentes)
}
```

**Logica nova (corrigida):**
```text
if (isCompany) {
  busca company_credentials.company_id pelo user.id (Producao)
  busca companies.cnpj pela company_id de Producao
  busca companies.cnpj pela company_id do body (Cloud)
    --> Se a company do body nao existir na Producao, busca pelo CNPJ no Cloud
        via REST API e resolve o company_id de Producao
  compara os CNPJs
  --> Se match, substitui bodyData.company_id pelo ID de Producao
}
```

Isso garante que:
- A validacao de ownership funciona independente do ambiente de origem do ID
- O `company_id` usado nas operacoes subsequentes (inserir convite, etc.) e sempre o ID de Producao
- Nenhum outro fluxo e afetado

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/company-operations/index.ts` | Alterar validacao de ownership (linhas 309-324) para resolver IDs por CNPJ |

## Arquivos NAO alterados

- `src/components/empresa/BulkInviteModal.tsx` (intocavel)
- `src/pages/empresa/Funcionarios.tsx` (intocavel)
- `src/hooks/useCompanyAuth.ts` (intocavel)
- Nenhum componente frontend
- Nenhuma outra Edge Function

## Detalhes tecnicos da alteracao

No bloco de validacao de ownership (linhas 309-324 de `company-operations/index.ts`):

1. Manter a busca de `company_credentials` pelo `user.id` para obter o `company_id` de Producao
2. Buscar o `cnpj` da empresa de Producao pela `company_id` de Producao
3. Buscar o `cnpj` da empresa pelo `bodyData.company_id` na Producao
4. Se nao encontrar na Producao (porque o ID veio do Cloud), buscar no Cloud via REST API (`CLOUD_SUPABASE_URL` + `CLOUD_SUPABASE_SERVICE_ROLE_KEY`) para obter o CNPJ
5. Comparar os CNPJs: se iguais, a empresa e a mesma -- substituir `bodyData.company_id` pelo ID de Producao
6. Se CNPJs diferentes, manter o erro "Forbidden"

Esse mesmo padrao de resolucao de `company_id` tambem sera aplicado ao bloco de `create-employee` (se existir validacao similar).

## Nota importante

Como `company-operations` roda na **Producao**, apos a alteracao voce precisara copiar o codigo atualizado e fazer deploy manualmente no dashboard do Supabase de Producao.
