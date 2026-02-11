
# Correcao: Dashboard e Funcionarios nao mostram dados

## Causa Raiz

O problema e uma **divergencia de ambiente**: os convites e funcionarios sao criados pela Edge Function `company-operations` no banco de **Producao**, mas o frontend consulta o banco do **Cloud**.

### Evidencia direta do banco Cloud:

```
pending_employee_invites WHERE company_id = '505c987b...' → 0 resultados
company_employees → tabela completamente vazia
```

Os dados existem apenas na Producao (acessivel via Edge Function `company-operations`).

### Detalhamento por pagina:

**`/empresa` (Dashboard.tsx):**
- Renderiza `ConvitesManagement` passando `company.id` do Cloud (`505c987b...`)
- `ConvitesManagement` faz query direta: `supabase.from('pending_employee_invites').eq('company_id', companyId)`
- `supabase` aqui e o cliente Cloud -- tabela vazia para este company_id
- Resultado: 0 convites, contadores zerados

**`/empresa/funcionarios` (Funcionarios.tsx):**
- Corretamente usa `invokeEdgeFunction('company-operations')` para listar funcionarios e convites
- Porem a versao deployada em Producao pode nao ter as operacoes `list-employees` e `list-pending-invites`
- Mesmo que tenha, a resposta vem corretamente da Producao (usando CNPJ, nao UUID)

---

## Correcoes Necessarias

### Arquivo 1: `src/components/empresa/ConvitesManagement.tsx`

**Problema:** Faz query direta ao Cloud via `supabase.from(...)`. Precisa usar `invokeEdgeFunction` para buscar dados da Producao.

**Alteracoes:**
- Substituir `supabase.from('pending_employee_invites')` por `invokeEdgeFunction('company-operations', { body: { operation: 'list-pending-invites', company_cnpj: companyCnpj } })`
- Adicionar prop `companyCnpj` ao componente (alem de `companyId` e `companyName`)
- Atualizar `handleCancelInvite` para usar Edge Function ao inves de query direta
- Atualizar `handleResendInvite` (ja usa Edge Function - OK)

### Arquivo 2: `src/pages/empresa/Dashboard.tsx`

**Alteracao minima:**
- Passar `companyCnpj={company.cnpj}` para o componente `ConvitesManagement`

---

## Detalhes Tecnicos

### ConvitesManagement - Nova logica de fetch:

```typescript
// ANTES (query Cloud - vazio):
let query = supabase
  .from('pending_employee_invites')
  .select('*')
  .eq('company_id', companyId)
  .neq('status', 'cancelled')
  .order('invited_at', { ascending: false });

// DEPOIS (via Edge Function - dados da Producao):
const { data, error } = await invokeEdgeFunction('company-operations', {
  body: {
    operation: 'list-pending-invites',
    company_cnpj: companyCnpj
  }
});
setInvites(data?.invites || []);
```

### ConvitesManagement - Cancel invite:

```typescript
// ANTES (deleta no Cloud - nao afeta Producao):
const { error } = await supabase
  .from('pending_employee_invites')
  .delete()
  .eq('id', inviteId);

// DEPOIS (via Edge Function na Producao):
const { error } = await invokeEdgeFunction('company-operations', {
  body: {
    operation: 'cancel-invite',
    invite_id: inviteId,
    company_cnpj: companyCnpj
  }
});
```

### ConvitesManagement - Props atualizadas:

```typescript
interface ConvitesManagementProps {
  companyId: string;
  companyName: string;
  companyCnpj: string;  // NOVO
}
```

### Dashboard.tsx - Passar CNPJ:

```typescript
<ConvitesManagement 
  companyId={company.id} 
  companyName={company.razao_social}
  companyCnpj={company.cnpj}  // NOVO
/>
```

### Convites.tsx (se existir como rota separada) - mesma alteracao:

```typescript
<ConvitesManagement 
  companyId={company.id} 
  companyName={company.razao_social}
  companyCnpj={company.cnpj}
/>
```

---

## Nota sobre company-operations na Producao

A Edge Function `company-operations` na Producao precisa ter as operacoes `list-pending-invites` e `cancel-invite` implementadas. Se voce ja fez o deploy manual conforme discutido anteriormente, essas operacoes ja estao disponiveis. Caso contrario, sera necessario o deploy antes de testar.

A operacao `list-employees` ja e usada pelo `Funcionarios.tsx` e ja funciona via `invokeEdgeFunction`.

---

## Resumo de arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/empresa/ConvitesManagement.tsx` | Substituir queries diretas ao Cloud por `invokeEdgeFunction` apontando para Producao |
| `src/pages/empresa/Dashboard.tsx` | Passar `companyCnpj` para `ConvitesManagement` |
| `src/pages/empresa/Convites.tsx` | Passar `companyCnpj` para `ConvitesManagement` |
