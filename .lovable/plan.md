

# Alterar Valor da Consulta de Psicólogo: R$ 39,99 → R$ 49,90

## Arquivos que serão modificados

| Arquivo | Linha | De | Para |
|---------|-------|----|------|
| `src/lib/constants.ts` | 20 | `precoBase: 39.99` | `precoBase: 49.90` |
| `src/components/admin/SalesTab.tsx` | 26 | `'ZXW2165': 3999` | `'ZXW2165': 4990` |
| `src/components/admin/SalesTab.tsx` | 50 | `'HXR8516': 3999` | `'HXR8516': 4990` |
| `src/components/admin/SalesTab.tsx` | 51 | `'YME9025': 3999` | `'YME9025': 4990` |
| `src/components/admin/ReportsTab.tsx` | 108 | `'ZXW2165': 3999` | `'ZXW2165': 4990` |
| `src/components/admin/ReportsTab.tsx` | 152 | `'HXR8516': 3999` | `'HXR8516': 4990` |
| `src/components/admin/ReportsTab.tsx` | 154 | `'YME9025': 3999` | `'YME9025': 4990` |

**Nota:** Os valores `39.99` em `PlanosSection.tsx` e no plano "Familiar com especialista" em `constants.ts` (linha 156) **NAO serao alterados** — esses sao precos de planos, nao da consulta de psicologo.

## Arquivos NAO alterados (confirmacao)

- `src/components/home/PlanosSection.tsx` — o `3999` la refere-se ao plano Familiar com Especialista
- `src/lib/constants.ts` linha 156 — preco do plano Familiar, nao do psicologo
- `src/lib/sku-mapping.ts` — apenas mapeamento de nome, sem preco
- `src/components/admin/RedirectFlowMap.tsx` — apenas referencia SKUs, sem precos
- `src/components/teste/TestesRoteamento.tsx` — apenas referencia SKUs, sem precos

## SQL para Supabase de Producao

Execute este SQL no editor SQL do seu Supabase de producao (`ploqujuhpwutpcibedbr`):

```sql
-- Atualizar preço do Psicólogo de R$ 39,99 para R$ 49,90
UPDATE services 
SET price = 49.90, 
    price_cents = 4990, 
    updated_at = NOW() 
WHERE sku = 'ZXW2165';
```

Se houver registros com SKUs `HXR8516` e `YME9025` (pacotes de 4 e 8 sessoes), tambem atualize:

```sql
UPDATE services 
SET price = 49.90, 
    price_cents = 4990, 
    updated_at = NOW() 
WHERE sku IN ('HXR8516', 'YME9025');
```

