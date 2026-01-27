

# Plano de Correção: PIX e Cartão - Usar invokeEdgeFunction (Produção)

## Problema Identificado

O código atual usa `supabase.functions.invoke()` que aponta para o Lovable Cloud, onde as edge functions de pagamento **não existem**. As funções `mp-create-payment` estão deployadas apenas no projeto Supabase de produção (`ploqujuhpwutpcibedbr`).

## Correções Necessárias

### Arquivo: `src/components/payment/PaymentModal.tsx`

O import do `invokeEdgeFunction` já existe na linha 12, então só precisamos trocar as chamadas.

---

### Correção 1: Pagamento com Cartão (Linha 1609)

**Antes:**
```typescript
const { data, error } = await supabase.functions.invoke("mp-create-payment", {
  body: paymentRequest,
});
```

**Depois:**
```typescript
// ✅ Usar invokeEdgeFunction para chamar o projeto Supabase de produção (não Lovable Cloud)
const { data, error } = await invokeEdgeFunction("mp-create-payment", {
  body: paymentRequest,
});
```

---

### Correção 2: Pagamento com PIX (Linha 2020)

**Antes:**
```typescript
const { data, error } = await supabase.functions.invoke("mp-create-payment", {
  body: paymentRequest,
});
```

**Depois:**
```typescript
// ✅ Usar invokeEdgeFunction para chamar o projeto Supabase de produção (não Lovable Cloud)
const { data, error } = await invokeEdgeFunction("mp-create-payment", {
  body: paymentRequest,
});
```

---

## Impacto da Correção

| Antes | Depois |
|-------|--------|
| Chamadas para Lovable Cloud (sem edge functions) | Chamadas para Supabase Produção (com edge functions) |
| PIX não gera código | PIX funciona normalmente |
| Cartão falha silenciosamente | Cartão processa no Mercado Pago |
| Logs não aparecem no dashboard | Logs visíveis em `mp-create-payment` |

---

## Verificação Pós-Correção

1. Testar geração de PIX com a paciente Valentina
2. Testar pagamento com cartão
3. Confirmar logs no projeto Supabase de produção

