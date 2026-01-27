
# ✅ PLANO CONCLUÍDO: Unificar Frontend e Backend em Produção

## Status: IMPLEMENTADO

## Problema Resolvido

O frontend estava conectado ao **Lovable Cloud** (`yrsjluhhnhxogdgnbnya`), mas o backend de pagamentos e webhooks opera na **Produção** (`ploqujuhpwutpcibedbr`). Isso causava:

1. ✅ **Overrides não funcionavam**: Admin salvava no Cloud, schedule-redirect lia da Produção
2. ✅ **Vendas não apareciam**: SalesTab lia do Cloud, mas vendas eram registradas na Produção
3. ✅ **Polling falhava**: check-payment-status era chamado no Cloud, não encontrava dados

## Solução Implementada

Criado um **cliente Supabase de Produção** dedicado e usado em todos os pontos críticos.

## Arquivos Modificados

| Arquivo | Alteração | Status |
|---------|-----------|--------|
| `src/lib/supabase-production.ts` | **NOVO** - Cliente Supabase apontando para Produção | ✅ |
| `src/components/admin/SalesTab.tsx` | Usar `supabaseProduction` para buscar vendas | ✅ |
| `src/components/admin/ClickLifeOverrideCard.tsx` | Usar `supabaseProduction` para overrides | ✅ |
| `src/components/admin/CommunicareOverrideCard.tsx` | Usar `supabaseProduction` para overrides | ✅ |
| `src/components/admin/UserRegistrationsTab.tsx` | Usar `invokeEdgeFunction` para ativações | ✅ |
| `src/components/payment/PaymentModal.tsx` | Usar `invokeEdgeFunction` + `supabaseProduction` | ✅ |

## Fluxo Corrigido

```text
1. Usuário compra via PIX
2. Mercado Pago envia webhook → mp-webhook (PRODUÇÃO)
3. mp-webhook atualiza pending_payments (PRODUÇÃO)
4. mp-webhook chama schedule-redirect (PRODUÇÃO)
5. schedule-redirect lê admin_settings (PRODUÇÃO) ← AGORA CORRETO!
6. schedule-redirect aplica override correto → ClickLife ou Communicare
7. Appointment criado (PRODUÇÃO)
8. PaymentModal faz polling via invokeEdgeFunction → check-payment-status (PRODUÇÃO)
9. Encontra appointment → Redireciona usuário
10. SalesTab busca pending_payments (PRODUÇÃO) → Mostra venda
11. Admin Cards leem/escrevem admin_settings (PRODUÇÃO) → Overrides funcionam
```

## Impacto

- ✅ Overrides do Admin agora funcionam para vendas reais
- ✅ Vendas aparecem na aba de Vendas imediatamente após aprovação
- ✅ Polling de pagamento encontra o appointment correto
- ✅ Consultas manuais do Admin funcionam corretamente

