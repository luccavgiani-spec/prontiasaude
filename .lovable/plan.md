

# Alteracoes no Painel Administrativo

## 1. Pesquisa por email na aba Pacientes — Diagnostico

Analisei o codigo da funcao `applyFilters()` (linha 377 de `UserRegistrationsTab.tsx`) e a logica **esta correta no codigo**:

```typescript
if (u.email?.toLowerCase().includes(searchLower)) return true;
```

No entanto, identifiquei o provavel problema: a funcao `list-all-users` busca usuarios a partir de `auth.users`, que retorna `user.email`. Porem, para usuarios que existem em AMBOS os ambientes, o campo `email` pode estar vazio ou `undefined` em um dos ambientes. Alem disso, pacientes importados manualmente que existem apenas na tabela `patients` (sem conta em `auth.users`) nao aparecem na busca.

**Solucao**: Adicionar console.log de diagnostico na funcao `applyFilters` e tambem buscar no campo `u.patient?.email` como fallback, ja que alguns usuarios podem ter email apenas nos dados do paciente.

### Arquivo: `src/components/admin/UserRegistrationsTab.tsx`

Na funcao `applyFilters`, apos a linha que verifica `u.email`, adicionar mais um fallback:

```typescript
// ADICIONAR: busca tambem no email do patient (fallback)
const patientEmail = (u as any).patientEmail || '';
if (patientEmail.toLowerCase().includes(searchLower)) return true;
```

E na construcao do User no `fetchAllUsers`, extrair o email do patient como fallback:

```typescript
return {
  ...existingFields,
  email: u.email || u.patient?.email || '',  // ← fallback para patient.email
};
```

Isso garante que, mesmo se o email vier apenas do registro `patients` (e nao de `auth.users`), a busca funcione.

---

## 2. Coluna de Telefone na aba de Vendas

### Arquivo: `src/components/admin/SalesTab.tsx`

**Alteracao 1 — Interface `Appointment`**: Adicionar campo `phone?: string` (linha ~89).

**Alteracao 2 — `loadAppointments()`**: Apos filtrar e deduplicar os appointments, buscar telefones em batch da tabela `patients` na Producao:

```typescript
// Buscar telefones dos pacientes por email (batch)
const emails = uniqueData.map(a => (a.email || '').toLowerCase()).filter(Boolean);
const { data: patientsData } = await supabaseProduction
  .from('patients')
  .select('email, phone_e164')
  .in('email', emails);

const phoneMap = new Map<string, string>();
for (const p of patientsData || []) {
  if (p.email && p.phone_e164) phoneMap.set(p.email.toLowerCase(), p.phone_e164);
}
```

E incluir `phone` no mapeamento de sales:

```typescript
const sales = uniqueData.map(apt => ({
  ...existingFields,
  phone: phoneMap.get((apt.email || '').toLowerCase()) || '',
}));
```

**Alteracao 3 — Tabela (linha ~958)**: Adicionar `<TableHead>Telefone</TableHead>` apos Email. Atualizar `colSpan` de 7 para 8. Adicionar celula na row:

```typescript
<TableCell className="text-xs">{apt.phone || '-'}</TableCell>
```

**Alteracao 4 — CSV Export (linha ~436)**: Adicionar "Telefone" no header apos "Email" e `apt.phone || '-'` na row apos `apt.email`.

---

## Escopo Final

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/admin/UserRegistrationsTab.tsx` | Fallback para `patient.email` na busca e na construcao do User |
| `src/components/admin/SalesTab.tsx` | Campo phone na interface, batch lookup, coluna na tabela, CSV |

Nenhum outro arquivo sera alterado.

