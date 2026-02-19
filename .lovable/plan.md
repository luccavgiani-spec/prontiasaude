

# Correcao: EditPatientModal usando ambiente errado

## Problema
O `EditPatientModal` usa `invokeCloudEdgeFunction` que envia a requisicao para o Lovable Cloud (`yrsjluhhnhxogdgnbnya`) ao inves do Supabase de Producao (`ploqujuhpwutpcibedbr`), onde os dados reais dos pacientes estao.

## Solucao

### Arquivo: `src/components/admin/EditPatientModal.tsx`

Duas alteracoes cirurgicas:

**1. Linha 7 - Trocar o import:**

De:
```typescript
import { invokeCloudEdgeFunction } from '@/lib/edge-functions';
```
Para:
```typescript
import { invokeEdgeFunction } from '@/lib/edge-functions';
```

**2. Linha ~131 - Trocar a chamada:**

De:
```typescript
const { data, error } = await invokeCloudEdgeFunction('patient-operations', {
```
Para:
```typescript
const { data, error } = await invokeEdgeFunction('patient-operations', {
```

Nenhum outro arquivo sera alterado. O `invokeEdgeFunction` ja respeita headers customizados (nao sobrescreve o Authorization quando ele ja vem definido), entao o token do admin continuara sendo enviado corretamente.

