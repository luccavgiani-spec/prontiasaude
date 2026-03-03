

## Diagnóstico: Filtros de Status e Provider não funcionam

### Problema identificado: **FRONTEND** — incompatibilidade de case (maiúsculas/minúsculas)

O problema está exclusivamente no arquivo `src/components/admin/SalesTab.tsx`.

### Provider (linha 955-956)
Os valores no `<SelectItem>` são `"ClickLife"` e `"Communicare"` (PascalCase), mas os dados salvos no banco pela edge function `schedule-redirect` usam **lowercase**: `"clicklife"` e `"communicare"`.

- Banco: `saveAppointment(payload, "clicklife", ...)` → salva `"clicklife"`
- Filtro: `<SelectItem value="ClickLife">` → compara com `"ClickLife"`
- Resultado: **nunca dá match**

### Status (linhas 943-945)
Os valores no `<SelectItem>` são `"scheduled"`, `"completed"`, `"cancelled"`, mas o `schedule-redirect` salva `status: "confirmed"` (linha 577). Além disso, o fallback no `loadAppointments` (linha 277) define `status: apt.status || 'scheduled'`.

- Banco: maioria dos registros tem `"confirmed"` como status
- Filtro: não tem opção `"confirmed"`, tem `"scheduled"`, `"completed"`, `"cancelled"`
- Resultado: **"confirmed" nunca aparece como opção filtrável**

### Correção necessária

Alterar os `<SelectItem>` para usar os valores reais do banco:

**Provider** (linhas 955-956):
- `"ClickLife"` → `"clicklife"`
- `"Communicare"` → `"communicare"`

**Status** (linhas 943-945): Trocar os valores hardcoded por valores dinâmicos extraídos dos dados reais (similar ao que já é feito com `uniqueServices`), ou adicionar `"confirmed"` à lista. A abordagem dinâmica é mais robusta.

### Escopo da alteração
- **Único arquivo**: `src/components/admin/SalesTab.tsx`
- **Linhas afetadas**: ~941-957 (SelectItems de status e provider)
- Nenhuma alteração de backend necessária

