
# Plano de Correção: Unificar Frontend e Backend em Produção

## Problema

O frontend está conectado ao **Lovable Cloud** (`yrsjluhhnhxogdgnbnya`), mas o backend de pagamentos e webhooks opera na **Produção** (`ploqujuhpwutpcibedbr`). Isso causa:

1. **Overrides não funcionam**: Admin salva no Cloud, schedule-redirect lê da Produção
2. **Vendas não aparecem**: SalesTab lê do Cloud, mas as vendas são registradas na Produção
3. **Polling falha**: check-payment-status é chamado no Cloud, não encontra dados de Produção

## Solução

Criar um **cliente Supabase de Produção** dedicado e usar em todos os pontos críticos.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/supabase-production.ts` | **NOVO** - Cliente Supabase apontando para Produção |
| `src/components/admin/SalesTab.tsx` | Usar cliente de Produção para buscar vendas |
| `src/components/admin/ClickLifeOverrideCard.tsx` | Usar cliente de Produção para overrides |
| `src/components/admin/CommunicareOverrideCard.tsx` | Usar cliente de Produção para overrides |
| `src/components/admin/UserRegistrationsTab.tsx` | Usar `invokeEdgeFunction` para ativações |
| `src/components/payment/PaymentModal.tsx` | Usar `invokeEdgeFunction` para check-payment-status e polling |

## Detalhes Técnicos

### 1. Criar Cliente Supabase de Produção

```text
src/lib/supabase-production.ts
```

Novo arquivo que exporta um cliente Supabase configurado com URL e chave de Produção (hardcoded para evitar dependência do .env auto-gerado).

### 2. SalesTab.tsx

Substituir:
```
import { supabase } from "@/integrations/supabase/client";
```

Por:
```
import { supabaseProduction } from "@/lib/supabase-production";
```

Usar `supabaseProduction` em todas as queries de `pending_payments` e `appointments`.

### 3. ClickLifeOverrideCard.tsx e CommunicareOverrideCard.tsx

Mesma substituição: usar cliente de Produção para ler/escrever `admin_settings`.

### 4. UserRegistrationsTab.tsx

Substituir:
```
await supabase.functions.invoke('activate-clicklife-manual', ...)
await supabase.functions.invoke('schedule-redirect', ...)
```

Por:
```
await invokeEdgeFunction('activate-clicklife-manual', { body: ... })
await invokeEdgeFunction('schedule-redirect', { body: ... })
```

### 5. PaymentModal.tsx

Substituir chamadas de polling:
```
await supabase.functions.invoke('check-payment-status', ...)
```

Por:
```
await invokeEdgeFunction('check-payment-status', { body: ... })
```

E para buscar appointments durante polling:
```
await supabaseProduction.from('appointments').select(...)
```

## Fluxo Corrigido

```text
1. Usuário compra via PIX
2. Mercado Pago envia webhook → mp-webhook (PRODUÇÃO)
3. mp-webhook atualiza pending_payments (PRODUÇÃO)
4. mp-webhook chama schedule-redirect (PRODUÇÃO)
5. schedule-redirect lê admin_settings (PRODUÇÃO) ← AGORA CORRETO!
6. schedule-redirect aplica override correto → ClickLife
7. Appointment criado (PRODUÇÃO)
8. PaymentModal faz polling via invokeEdgeFunction → check-payment-status (PRODUÇÃO)
9. Encontra appointment → Redireciona usuário
10. SalesTab busca pending_payments (PRODUÇÃO) → Mostra venda
11. Admin Cards leem/escrevem admin_settings (PRODUÇÃO) → Overrides funcionam
```

## Resumo das Mudanças

- **Novo arquivo**: `src/lib/supabase-production.ts`
- **6 arquivos modificados**: Substituição de imports e chamadas de função
- **0 alterações em Edge Functions**: Já estão corretas usando ORIGINAL_SUPABASE_URL
- **0 alterações em .env**: Não tocamos no arquivo auto-gerado

## Impacto

- Overrides do Admin passarão a funcionar para vendas reais
- Vendas aparecerão na aba de Vendas imediatamente após aprovação
- Polling de pagamento encontrará o appointment correto
- Consultas manuais do Admin continuarão funcionando
