

# Correção: Coluna `is_active` não existe em Produção

## Problema Identificado

**Arquivo:** `supabase/functions/mp-create-payment/index.ts`  
**Linha:** 269

```typescript
const { data: service, error: serviceError } = await supabaseAdmin
  .from('services')
  .select('sku, name, price_cents, allows_recurring, recurring_frequency, recurring_frequency_type')
  .eq('sku', sku)
  .eq('is_active', true)  // ❌ ERRO: coluna não existe em Produção
  .maybeSingle();
```

**Erro retornado:**
```json
{
  "code": "42703",
  "hint": "Perhaps you meant to reference the column \"services.active\".",
  "message": "column services.is_active does not exist"
}
```

## Causa Raiz

| Ambiente | Coluna na tabela `services` |
|----------|----------------------------|
| Lovable Cloud | `is_active` |
| Produção (ploqujuhpwutpcibedbr) | `active` |

O código foi escrito para Lovable Cloud, mas a função em Produção consulta um banco com schema diferente.

---

## Correção Necessária

**Arquivo:** `supabase/functions/mp-create-payment/index.ts`

**Alteração na linha 269:**
```diff
- .eq('is_active', true)
+ .eq('active', true)
```

---

## Passos Após Aprovação

1. Aplicarei a correção no código
2. Você copiará o código atualizado para o Supabase de Produção
3. Testaremos a geração de PIX novamente

---

## Resumo

| # | Arquivo | Linha | Alteração |
|---|---------|-------|-----------|
| 1 | `supabase/functions/mp-create-payment/index.ts` | 269 | Trocar `is_active` por `active` |

