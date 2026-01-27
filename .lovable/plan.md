
# Plano de Correção: Vendas de Planos Não Registradas e Recorrência Inexistente

## Diagnóstico do Problema

Após análise detalhada do código, identifiquei **dois problemas críticos** que explicam por que as vendas de planos não estão funcionando:

---

### Problema 1: Webhook Configurado Incorretamente para Assinaturas

A imagem que você enviou mostra a configuração do webhook do Mercado Pago:

| Configuração | Status |
|--------------|--------|
| URL de produção | `https://ploqujuhpwutpcibedbr.supabase.co/functions/v1/mp-webhook` |
| Pagamentos | ✅ Ativo |
| Planos e assinaturas | ✅ Ativo |

**O problema:** Os eventos de "Planos e assinaturas" (tipo `subscription_preapproval`) estão sendo enviados para o webhook `mp-webhook`, mas esse webhook **não processa eventos de subscription** - ele ignora qualquer action que não seja `payment.updated`, `payment.created`, `updated` ou `created`.

O webhook correto para assinaturas é `mp-subscription-webhook`, mas:
1. Não está listado no `config.toml` com `verify_jwt = false`
2. O Mercado Pago está enviando para `mp-webhook` ao invés de `mp-subscription-webhook`

---

### Problema 2: Assinaturas Recorrentes Nunca São Criadas no Mercado Pago

O frontend (`PaymentModal.tsx`) envia o campo `auto_recurring` para o backend quando `recurring=true`:

```javascript
if (recurring && frequency && frequencyType) {
  paymentRequest.auto_recurring = {
    frequency,
    frequency_type: frequencyType,
    transaction_amount: amount,
    currency_id: "BRL",
  };
}
```

**Porém**, o backend (`mp-create-payment`) **ignora completamente** este campo! Ele apenas cria um pagamento único normal, sem usar a API de Subscriptions do Mercado Pago.

Para criar uma assinatura recorrente, o backend deveria:
1. Usar a API `/preapproval` do Mercado Pago (não `/payments`)
2. Criar um registro na tabela `patient_subscriptions`
3. Vincular a subscription ao `patient_plans`

A função `mp-create-subscription` existe e faz isso corretamente, mas **nunca é chamada pelo frontend**.

---

### Problema 3: Frontend Não Usa mp-create-subscription

O frontend sempre chama `mp-create-payment`, mesmo para planos recorrentes. A busca no código confirma que `mp-create-subscription` nunca é invocado:

```text
No matches found for pattern 'mp-create-subscription' in src/
```

---

## Resumo dos Problemas

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                          FLUXO ATUAL (QUEBRADO)                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Usuário compra plano mensal                                          │
│                    ↓                                                     │
│  2. Frontend chama mp-create-payment (NÃO mp-create-subscription)        │
│                    ↓                                                     │
│  3. Backend cria PAGAMENTO ÚNICO (ignora auto_recurring)                 │
│                    ↓                                                     │
│  4. MP envia webhook para mp-webhook                                     │
│                    ↓                                                     │
│  5. mp-webhook processa como pagamento normal                            │
│                    ↓                                                     │
│  6. Plano é ativado (até aqui funciona)                                  │
│                    ↓                                                     │
│  7. Dia 27/02: NADA ACONTECE (não há subscription no MP!)                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Plano de Correção

### Etapa 1: Adicionar verify_jwt=false para mp-subscription-webhook

**Arquivo:** `supabase/config.toml`

Adicionar:
```toml
[functions.mp-subscription-webhook]
verify_jwt = false
```

Isso permite que o Mercado Pago envie webhooks de subscription sem autenticação JWT.

---

### Etapa 2: Modificar mp-webhook para Redirecionar Eventos de Subscription

**Arquivo:** `supabase/functions/mp-webhook/index.ts`

Quando receber um evento do tipo `subscription_preapproval` ou similar, chamar internamente o `mp-subscription-webhook`:

```typescript
// Detectar eventos de subscription e redirecionar
const subscriptionEvents = ['subscription_preapproval', 'subscription_authorized_payment'];
if (subscriptionEvents.includes(body.type)) {
  console.log('[mp-webhook] 🔄 Redirecionando para mp-subscription-webhook:', body.type);
  // Processar com lógica de subscription
}
```

---

### Etapa 3: Modificar Frontend para Usar mp-create-subscription para Planos

**Arquivo:** `src/components/payment/PaymentModal.tsx`

Na função `handleCardSubmit`, verificar se é um plano com `recurring=true` e chamar a edge function correta:

```typescript
// Detectar se é plano recorrente
const isPlanRecurring = recurring && sku.match(/^(IND_|FAM_)/);

if (isPlanRecurring) {
  // Chamar mp-create-subscription
  const { data, error } = await invokeEdgeFunction("mp-create-subscription", {
    body: subscriptionRequest,
  });
} else {
  // Chamar mp-create-payment (fluxo normal)
  const { data, error } = await invokeEdgeFunction("mp-create-payment", {
    body: paymentRequest,
  });
}
```

---

### Etapa 4: Adicionar verify_jwt=false para mp-create-subscription

**Arquivo:** `supabase/config.toml`

```toml
[functions.mp-create-subscription]
verify_jwt = false
```

---

### Etapa 5: Corrigir URL do mp-subscription-webhook no Mercado Pago

No dashboard do Mercado Pago, adicionar um segundo webhook:
- **URL:** `https://ploqujuhpwutpcibedbr.supabase.co/functions/v1/mp-subscription-webhook`
- **Eventos:** Apenas "Planos e assinaturas"

Ou manter a URL única e processar ambos os tipos no `mp-webhook`.

---

### Etapa 6: Corrigir mp-create-subscription para Usar URLs Fixas

**Arquivo:** `supabase/functions/mp-create-subscription/index.ts`

Atualmente usa `Deno.env.get('SUPABASE_URL')` que pode apontar para Lovable Cloud. Corrigir para:

```typescript
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') 
  ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(
  ORIGINAL_SUPABASE_URL,
  ORIGINAL_SERVICE_ROLE_KEY
);
```

---

## Arquivos a Serem Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/config.toml` | Adicionar `verify_jwt = false` para `mp-subscription-webhook` e `mp-create-subscription` |
| `src/components/payment/PaymentModal.tsx` | Chamar `mp-create-subscription` quando for plano recorrente |
| `supabase/functions/mp-create-subscription/index.ts` | Usar URLs fixas do projeto de produção |
| `supabase/functions/mp-subscription-webhook/index.ts` | Usar URLs fixas do projeto de produção |
| `supabase/functions/mp-webhook/index.ts` | Adicionar tratamento para eventos de subscription (ou redirecionar) |

---

## Fluxo Corrigido

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                        FLUXO CORRIGIDO (ESPERADO)                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Usuário compra plano mensal                                          │
│                    ↓                                                     │
│  2. Frontend detecta recurring=true e SKU de plano                       │
│                    ↓                                                     │
│  3. Frontend chama mp-create-subscription                                │
│                    ↓                                                     │
│  4. Backend cria SUBSCRIPTION no MP (API /preapproval)                   │
│                    ↓                                                     │
│  5. MP cobra cartão imediatamente + agenda cobranças futuras             │
│                    ↓                                                     │
│  6. MP envia webhook subscription_preapproval                            │
│                    ↓                                                     │
│  7. mp-subscription-webhook processa e cria patient_subscriptions        │
│                    ↓                                                     │
│  8. Plano é ativado e vinculado à subscription                           │
│                    ↓                                                     │
│  9. Dia 27/02: MP cobra automaticamente e envia webhook                  │
│                    ↓                                                     │
│  10. mp-subscription-webhook renova o plano automaticamente              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Observações Importantes

1. **Não altero nenhum arquivo que não seja explicitamente necessário** para esta correção
2. O fluxo de consultas avulsas (serviços) continua usando `mp-create-payment` normalmente
3. O PIX não suporta recorrência automática no Mercado Pago - para PIX, o plano seria de pagamento único

---

## Seção Técnica

### Tabelas Envolvidas

- `patient_subscriptions`: Armazena vínculo entre paciente e subscription do MP
- `patient_plans`: Armazena plano ativo do paciente (já existe)
- `pending_payments`: Registro de pagamentos para reconciliação

### APIs do Mercado Pago

- **Pagamentos únicos:** `POST /v1/payments`
- **Assinaturas recorrentes:** `POST /preapproval`
- **Consultar assinatura:** `GET /preapproval/{id}`

### Webhooks Esperados

| Tipo | Action | Descrição |
|------|--------|-----------|
| `subscription_preapproval` | `created` | Assinatura criada |
| `subscription_preapproval` | `updated` | Status alterado |
| `subscription_authorized_payment` | `payment` | Cobrança mensal aprovada |
