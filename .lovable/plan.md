# ═══════════════════════════════════════════════════════════════
# 🔒 REGRAS MASTER - ARQUIVOS BLOQUEADOS
# ═══════════════════════════════════════════════════════════════

## ⛔ ARQUIVO BLOQUEADO: src/lib/meta-tracking.ts

**Data do bloqueio:** 2026-01-28
**Motivo:** Tracking Google Ads/GTM/Meta funcionando corretamente após correção.

### PROIBIDO:
- Qualquer alteração neste arquivo
- Refatorações "para melhorar"
- Atualizações de dependências
- Mudanças de formato/estilo

### SE PRECISAR MEXER:
1. PARAR imediatamente
2. Lembrar o usuário: "Em 28/01/2026 você PROIBIU alterações em meta-tracking.ts"
3. Aguardar confirmação EXPLÍCITA antes de qualquer mudança

---

# Plano: Corrigir Disparo do Evento Purchase para Google Ads

## ✅ IMPLEMENTADO E VALIDADO (28/01/2026)

O tracking de purchase para Google Ads/GTM está funcionando. As correções incluíram:

1. **Array `items` nunca vazio** - Fallback para SKU/nome padrão
2. **Schema GA4 Enhanced Ecommerce** - `dataLayer.push` antes de `gtag()`
3. **Enhanced Conversions** - `user_data` com email hashado
4. **Deduplicação** - `transaction_id` para evitar duplicatas

## Configuração da TAG "Purchase Prontia"

| Parâmetro | Valor Configurado |
|-----------|-------------------|
| Código de conversão | `17744564489` |
| Rótulo de conversão | `-L0OCPGgnMMbElmioo1C` |
| Valor da conversão | `{{ecommerce.value}}` |
| ID da transação | `{{ecommerce.transaction_id}}` |
| Código da moeda | `BRL` |
| Acionador | Evento personalizado `purchase` |

## Fluxo de Disparo

```text
Pagamento Aprovado
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  trackPurchase() executado no browser                         │
├──────────────────────────────────────────────────────────────┤
│  1. gtag("set", "user_data", { email })                      │
│  2. dataLayer.push({ event: 'purchase', ecommerce: {...} })  │
│  3. gtag("event", "purchase", {...})                         │
│  4. gtag("event", "conversion", { send_to: 'AW-...' })       │
└──────────────────────────────────────────────────────────────┘
```
