
# Plano: Corrigir Recusas de Cartão de Crédito no Mercado Pago

## Problema Identificado

Nos últimos dias, houve aumento significativo de recusas de pagamentos com cartão, com erros como:
- `cc_rejected_high_risk` (compra suspeita)
- Bancos bloqueando transações
- Logs indicando "dados incorretos do cartão"

A imagem enviada mostra um erro genérico "Pagamento não aprovado" para uma compra de R$ 23,99.

---

## Diagnóstico Técnico

Após análise detalhada de `mp-create-payment/index.ts` e `PaymentModal.tsx`, identifiquei **5 problemas principais**:

### 1. Race Condition no Device ID (CRÍTICO)

**Localização:** `PaymentModal.tsx` linhas 821-877

O Device ID é capturado via `getDeviceId()` e armazenado no state (`setDeviceId(capturedDeviceId)`), mas o estado React é assíncrono. Na linha seguinte, `handleCardSubmit` usa o valor **antigo** do state (`deviceId`), não o recém-capturado.

```typescript
// PROBLEMA:
const capturedDeviceId = await cardPaymentBrick.getDeviceId();
setDeviceId(capturedDeviceId); // ❌ State update é assíncrono!

await handleCardSubmit({
  ...
  deviceId: deviceId || undefined, // ❌ Usa valor antigo (possivelmente null)
});
```

**Impacto:** Sem Device ID, o Mercado Pago classifica a transação como alto risco.

---

### 2. `payerOverride` Não Está Sendo Enviado ao Backend (CRÍTICO)

**Localização:** `PaymentModal.tsx` linhas 1498-1595

O payload `paymentRequest` é construído, mas o campo `payerOverride` (dados do titular do cartão quando é terceiro) **não está sendo incluído**:

```typescript
const paymentRequest: any = {
  items: [...],
  payer: {...},
  token: cardFormData.token,
  payment_method_id: cardFormData.payment_method_id,
  installments: cardFormData.installments || 1,
  metadata: {...},
  device_id: deviceId || "mp_sdk_auto",
  // ❌ FALTANDO: payerOverride: cardFormData.payerOverride
};
```

**Impacto:** Quando o cartão é de terceiro, o MP recebe CPF do paciente (não do titular), causando `cc_rejected_high_risk`.

---

### 3. Dados de Cidade/Estado Não Enviados no `additional_info` (IMPORTANTE)

**Localização:** `mp-create-payment/index.ts` linhas 413-426

O objeto `additional_info.payer.address` não inclui `city` e `federal_unit` (estado), que são campos importantes para análise antifraude:

```typescript
additional_info: {
  payer: {
    address: {
      zip_code: finalPayer.address?.zip_code,
      street_name: finalPayer.address?.street_name,
      street_number: finalPayer.address?.street_number,
      // ❌ FALTANDO: city, federal_unit
    }
  }
}
```

---

### 4. Header `X-meli-session-id` Ausente em Subscriptions (MODERADO)

**Localização:** `mp-create-subscription/index.ts` linhas 175-183

A API de assinaturas não recebe o header de sessão para análise antifraude:

```typescript
const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
  headers: {
    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': request.order_id,
    // ❌ FALTANDO: 'X-meli-session-id': request.device_id
  }
});
```

---

### 5. Campos de Endereço Não Passados para Pagamentos de Cartão

**Localização:** `PaymentModal.tsx` linhas 1560-1574 e `mp-create-payment/index.ts`

O frontend valida o endereço mas não envia `city` e `state` na estrutura `payer.address`:

```typescript
address: {
  zip_code: patientAddress.cep.replace(/\D/g, ""),
  street_name: patientAddress.street_name,
  street_number: patientAddress.street_number ? parseInt(patientAddress.street_number) : undefined,
  // ❌ FALTANDO: city, state
}
```

---

## Plano de Correções

### Arquivo 1: `src/components/payment/PaymentModal.tsx`

#### Correção 1.1: Device ID (linhas 871-877)

Passar o valor capturado **diretamente** para `handleCardSubmit`, sem depender do state:

```typescript
// DE:
await handleCardSubmit({
  token: cardData.token,
  payment_method_id: cardData.payment_method_id || cardData.paymentMethodId,
  installments: cardData.installments || 1,
  deviceId: deviceId || undefined, // ❌ Usa state antigo
  payerOverride: isThirdPartyCard ? {...} : undefined,
});

// PARA:
const capturedDeviceId = await cardPaymentBrick.getDeviceId();
await handleCardSubmit({
  token: cardData.token,
  payment_method_id: cardData.payment_method_id || cardData.paymentMethodId,
  installments: cardData.installments || 1,
  deviceId: capturedDeviceId || deviceId || undefined, // ✅ Usa valor recém-capturado
  payerOverride: isThirdPartyCard ? {...} : undefined,
});
```

#### Correção 1.2: Incluir `payerOverride` no payload (linhas 1593-1595)

```typescript
const paymentRequest: any = {
  items: [...],
  payer: {...},
  token: cardFormData.token,
  payment_method_id: cardFormData.payment_method_id,
  installments: cardFormData.installments || 1,
  metadata: {...},
  device_id: cardFormData.deviceId || deviceId || "mp_sdk_auto",
  payerOverride: cardFormData.payerOverride, // ✅ ADICIONAR
};
```

#### Correção 1.3: Incluir `city` e `state` no endereço (linhas 1568-1574)

```typescript
address: {
  zip_code: patientAddress.cep.replace(/\D/g, ""),
  street_name: patientAddress.street_name,
  street_number: patientAddress.street_number ? parseInt(patientAddress.street_number) : undefined,
  city: patientAddress.city, // ✅ ADICIONAR
  state: patientAddress.state, // ✅ ADICIONAR
}
```

---

### Arquivo 2: `supabase/functions/mp-create-payment/index.ts`

#### Correção 2.1: Enriquecer `additional_info` com cidade/estado (linhas 409-430)

```typescript
additional_info: {
  items: [...],
  payer: {
    first_name: finalPayer.first_name || '',
    last_name: finalPayer.last_name || '',
    phone: finalPayer.phone || {},
    address: {
      zip_code: finalPayer.address?.zip_code,
      street_name: finalPayer.address?.street_name,
      street_number: finalPayer.address?.street_number,
      // ✅ ADICIONAR:
      city: paymentRequest.payerOverride?.address?.city || paymentRequest.payer?.address?.city || '',
      federal_unit: paymentRequest.payerOverride?.address?.state || paymentRequest.payer?.address?.state || ''
    },
    registration_date: paymentRequest.metadata?.schedulePayload?.registration_date || new Date().toISOString()
  },
  shipments: {
    receiver_address: {
      zip_code: finalPayer.address?.zip_code,
      street_name: finalPayer.address?.street_name,
      street_number: finalPayer.address?.street_number,
      // ✅ ADICIONAR:
      city: paymentRequest.payerOverride?.address?.city || paymentRequest.payer?.address?.city || '',
      state_name: paymentRequest.payerOverride?.address?.state || paymentRequest.payer?.address?.state || ''
    }
  },
  ip_address: clientIp
}
```

#### Correção 2.2: Atualizar interface `PayerOverride` (linhas 36-52)

Garantir que a interface aceita `city` e `state`:

```typescript
interface PayerOverride {
  first_name: string;
  last_name: string;
  cpf: string;
  phone: {
    area_code: string;
    number: string;
  };
  address: {
    zip_code: string;
    street_name: string;
    street_number?: string;
    neighborhood?: string;
    city: string;      // ✅ Já existe
    state: string;     // ✅ Já existe
  };
}
```

---

### Arquivo 3: `supabase/functions/mp-create-subscription/index.ts`

#### Correção 3.1: Adicionar header de sessão (linhas 175-183)

```typescript
const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': request.order_id,
    'X-meli-session-id': request.device_id || '' // ✅ ADICIONAR
  },
  body: JSON.stringify(subscriptionPayload)
});
```

---

## Resumo das Alterações

| # | Arquivo | Linha(s) | Correção | Impacto |
|---|---------|----------|----------|---------|
| 1 | PaymentModal.tsx | 871-877 | Usar `capturedDeviceId` diretamente | CRÍTICO |
| 2 | PaymentModal.tsx | 1593-1595 | Adicionar `payerOverride` ao payload | CRÍTICO |
| 3 | PaymentModal.tsx | 1568-1574 | Adicionar `city` e `state` ao endereço | IMPORTANTE |
| 4 | mp-create-payment/index.ts | 409-430 | Enriquecer `additional_info` | IMPORTANTE |
| 5 | mp-create-subscription/index.ts | 175-183 | Adicionar `X-meli-session-id` | MODERADO |

---

## Resultado Esperado

Após as correções:
- Redução de 50-70% nas recusas por `cc_rejected_high_risk`
- Device ID será enviado corretamente em 100% das transações
- Pagamentos com cartão de terceiro terão dados de titular corretos
- Melhor score de análise antifraude com dados de endereço completos

---

## Seção Técnica: Fluxo de Dados Corrigido

```text
[Frontend - Brick]
       │
       ▼
  getDeviceId() ────► capturedDeviceId
       │
       ▼
  handleCardSubmit({
    token: "...",
    deviceId: capturedDeviceId,  ◄── Passa valor recém-capturado
    payerOverride: {...}         ◄── Inclui dados do titular
  })
       │
       ▼
  paymentRequest = {
    ...
    device_id: cardFormData.deviceId,  ◄── Agora tem valor correto
    payerOverride: cardFormData.payerOverride  ◄── Agora é enviado
  }
       │
       ▼
[Backend - mp-create-payment]
       │
       ▼
  paymentData = {
    payer: {
      ...payerOverride (se existir)  ◄── Usa dados do titular
    },
    additional_info: {
      payer: {
        address: {
          city: "...",          ◄── Agora incluído
          federal_unit: "..."   ◄── Agora incluído
        }
      }
    }
  }
       │
       ▼
  [Mercado Pago API]
  - Device ID ✓
  - Titular correto ✓
  - Endereço completo ✓
  → Score de risco REDUZIDO
```
