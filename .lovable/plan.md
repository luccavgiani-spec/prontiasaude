

# Plano: Corrigir Disparo do Evento Purchase para Google Ads

## Diagnóstico do Problema

### Configuração da TAG "Purchase Prontia" (imagem)

| Parâmetro | Valor Configurado |
|-----------|-------------------|
| Código de conversão | `17744564489` |
| Rótulo de conversão | `-L0OCPGgnMMbElmioo1C` |
| Valor da conversão | `{{ecommerce.value}}` |
| ID da transação | `{{ecommerce.transaction_id}}` |
| Código da moeda | `BRL` |
| Acionador | Evento personalizado `purchase` |

### Problema Identificado

A tag está configurada para usar variáveis GTM (`{{ecommerce.value}}`) que são populadas pelo `dataLayer.push()`. No entanto, o código atual:

1. **Faz `dataLayer.push` corretamente** (linhas 467-490 de meta-tracking.ts)
2. **Faz `gtag("event", "purchase")` corretamente** (linhas 494-511)
3. **Faz `gtag("event", "conversion")` corretamente** (linhas 513-524)

O problema **não está no código em si**, mas possivelmente em:
1. **Ordem de execução**: O `dataLayer.push` precisa acontecer ANTES da tag do GTM disparar
2. **Formato dos dados**: Precisa seguir exatamente o schema GA4 Enhanced Ecommerce
3. **Deduplicação por `transaction_id`**: Pode estar bloqueando eventos legítimos

### Verificação do Schema Oficial Google (documentação)

Segundo a documentação oficial, o evento `purchase` precisa:

```javascript
gtag("event", "purchase", {
    transaction_id: "T_12345",    // OBRIGATÓRIO
    value: 72.05,                 // OBRIGATÓRIO (soma de price * quantity)
    currency: "USD",              // OBRIGATÓRIO
    items: [                      // OBRIGATÓRIO
      {
        item_id: "SKU_12345",     // OBRIGATÓRIO (item_id ou item_name)
        item_name: "Nome",        // OBRIGATÓRIO
        price: 10.01,
        quantity: 3
      }
    ]
});
```

### Código Atual vs Esperado

**Atual (meta-tracking.ts linhas 494-506):**
```typescript
gtag("event", "purchase", {
  transaction_id: data.order_id,
  value: data.value,
  currency: "BRL",
  items: data.contents?.map(...) || []  // ⚠️ PODE SER ARRAY VAZIO
});
```

**Problema**: Se `data.contents` for `undefined`, o array `items` fica vazio `[]`, o que pode fazer o Google ignorar o evento.

---

## Correções Necessárias

### Correção 1: Garantir Array `items` Nunca Vazio

O Google exige pelo menos 1 item. Se não vier `contents`, criar item padrão com SKU e valor.

### Correção 2: Sincronizar dataLayer e gtag

O GTM precisa receber o evento `purchase` no `dataLayer` para a tag disparar corretamente. A ordem deve ser:
1. Limpar ecommerce anterior
2. Push do evento purchase no dataLayer
3. gtag() direto para redundância

### Correção 3: Passar SKU nos Chamadores

Atualmente, `PaymentModal.tsx` não passa o SKU para `trackPurchase()`. Precisa passar para montar o `items` corretamente.

---

## Arquivos que Serão Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/meta-tracking.ts` | Reformular `trackPurchase()` para seguir schema GA4 |
| `src/components/payment/PaymentModal.tsx` | Ajustar chamadas de `trackPurchase()` passando SKU |

---

## Implementação Detalhada

### A. Atualizar `trackPurchase()` em meta-tracking.ts

```typescript
export function trackPurchase(data: {
  value: number;
  order_id: string;
  sku?: string;            // NOVO: SKU do produto
  email?: string;
  content_name?: string;
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
}): void {
  // Deduplicação
  if (hasAlreadyTrackedPurchase(data.order_id)) return;

  // Montar items - NUNCA vazio
  const items = data.contents?.length 
    ? data.contents.map(item => ({
        item_id: item.id,
        item_name: data.content_name || item.id,
        price: item.item_price || data.value,
        quantity: item.quantity
      }))
    : [{
        item_id: data.sku || 'consulta',
        item_name: data.content_name || 'Consulta Prontia',
        price: data.value,
        quantity: 1
      }];

  // 1. Enhanced Conversions (user_data)
  if (data.email && window.gtag) {
    window.gtag("set", "user_data", {
      email: data.email.toLowerCase().trim()
    });
  }

  // 2. dataLayer para GTM (dispara tag "Purchase Prontia")
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event: 'purchase',
    ecommerce: {
      transaction_id: data.order_id,
      value: data.value,
      currency: 'BRL',
      items: items
    }
  });

  // 3. gtag direto para GA4 (redundância)
  if (window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: data.order_id,
      value: data.value,
      currency: "BRL",
      items: items
    });

    // 4. Conversão Google Ads
    window.gtag("event", "conversion", {
      send_to: 'AW-17744564489/-L0OCPGgnMMbElmioo1C',
      value: data.value,
      currency: 'BRL',
      transaction_id: data.order_id
    });
  }

  markPurchaseAsTracked(data.order_id);
}
```

### B. Atualizar Chamadas em PaymentModal.tsx

Passar `sku` em todas as chamadas de `trackPurchase`:

```typescript
trackPurchase({
  value: amount / 100,
  order_id: orderId,
  sku: sku,                    // NOVO
  email: formData.email,
  content_name: serviceName,
  contents: [{
    id: sku,
    quantity: 1,
    item_price: amount / 100
  }]
});
```

---

## Fluxo Após Correção

```text
Pagamento Aprovado
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  trackPurchase() executado no browser                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. gtag("set", "user_data", { email })                      │
│     └── Enhanced Conversions habilitado                      │
│                                                              │
│  2. dataLayer.push({ event: 'purchase', ecommerce: {...} })  │
│     └── Dispara TAG "Purchase Prontia" no GTM                │
│     └── Variables: {{ecommerce.value}}, {{ecommerce.transaction_id}} │
│                                                              │
│  3. gtag("event", "purchase", {...})                         │
│     └── Envio direto para GA4 (redundância)                  │
│                                                              │
│  4. gtag("event", "conversion", { send_to: 'AW-...' })       │
│     └── Envio direto para Google Ads                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Pontos Críticos para Validação

1. **Console do navegador**: Após pagamento, verificar logs:
   - `[GTM dataLayer] ✅ Enhanced Ecommerce purchase enviado`
   - `[Google Ads] ✅ Evento purchase enviado`
   - `[Google Ads] ✅ Conversão "Consulta Realizada" enviada`

2. **Google Tag Assistant**: Verificar se a tag "Purchase Prontia" está disparando

3. **GA4 DebugView**: Verificar se o evento `purchase` aparece com os parâmetros corretos

4. **Google Ads Conversões**: Verificar se as conversões estão sendo registradas

---

## Resultado Esperado

Após implementação:
- Tag "Purchase Prontia" dispara corretamente via GTM (lê `{{ecommerce.value}}`)
- Evento `purchase` enviado diretamente via gtag (redundância)
- Conversão Google Ads registrada com valor e transaction_id
- Enhanced Conversions ativo com email do usuário

