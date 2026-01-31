

# Correção: Erro 42703 - `is_active` no Frontend (PaymentModal.tsx)

## Diagnóstico

O erro agora vem do **frontend**, não da Edge Function:

```
Request URL: https://ploqujuhpwutpcibedbr.supabase.co/rest/v1/services?...&is_active=eq.true
```

Isso significa que o `PaymentModal.tsx` está consultando diretamente o banco de Produção via `supabaseProduction.from("services")`, e o filtro `.eq("is_active", true)` falha porque a coluna em Produção se chama `active`.

### Locais Afetados

| Arquivo | Linha | Código Problemático |
|---------|-------|---------------------|
| `src/components/payment/PaymentModal.tsx` | 1479 | `.eq("is_active", true)` |
| `src/components/payment/PaymentModal.tsx` | 2024 | `.eq("is_active", true)` |

---

## Correção Aprovada

**Estratégia:** Remover o filtro de `is_active`/`active` completamente.

Isso simplifica a consulta e evita problemas de divergência de schema entre ambientes.

**Risco:** Um serviço inativo poderia ser comprado. Para mitigar, a Edge Function `mp-create-payment` já valida se o serviço está ativo antes de processar o pagamento.

---

## Alterações Técnicas

### Arquivo: `src/components/payment/PaymentModal.tsx`

**Linha 1477-1480 (antes):**
```typescript
const { data: service, error: serviceError } = await (supabaseProduction
  .from("services") as any)
  .select("price_cents, name")
  .eq("sku", sku)
  .eq("is_active", true)
  .maybeSingle();
```

**Depois:**
```typescript
const { data: service, error: serviceError } = await (supabaseProduction
  .from("services") as any)
  .select("price_cents, name")
  .eq("sku", sku)
  .maybeSingle();
```

**Linha 2020-2025 (antes):**
```typescript
const { data: service, error: serviceError } = await (supabaseProduction
  .from("services") as any)
  .select("price_cents, name")
  .eq("sku", sku)
  .eq("is_active", true)
  .maybeSingle();
```

**Depois:**
```typescript
const { data: service, error: serviceError } = await (supabaseProduction
  .from("services") as any)
  .select("price_cents, name")
  .eq("sku", sku)
  .maybeSingle();
```

---

## Resumo

| # | Arquivo | Linha | Alteração |
|---|---------|-------|-----------|
| 1 | `src/components/payment/PaymentModal.tsx` | 1479 | Remover `.eq("is_active", true)` |
| 2 | `src/components/payment/PaymentModal.tsx` | 2024 | Remover `.eq("is_active", true)` |

---

## Pós-Correção

1. O build será atualizado automaticamente
2. Faça um hard refresh (Ctrl+Shift+R)
3. Teste novamente "Gerar código PIX"
4. Não será necessário colar nada no Supabase de Produção (é código frontend)

