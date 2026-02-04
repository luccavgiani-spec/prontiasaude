

# Plano: Integração Mercado Pago 100/100 - Eliminar Recusas

## Diagnóstico Atual (90/100)

Analisando as imagens do painel de qualidade do Mercado Pago, identifico que todos os itens estão marcados como "ação recomendada" ou "boas práticas" concluídas, mas há **10 pontos faltando** que estão relacionados a problemas de implementação identificados no código:

### Problemas Identificados no Código

| Problema | Arquivo | Impacto |
|----------|---------|---------|
| Device ID não capturado | MercadoPagoCardForm.tsx (linha 167) | **CRÍTICO** - Causa `cc_rejected_high_risk` |
| Fallback "mp_sdk_auto" inválido | PaymentModal.tsx (linha 1617) | **CRÍTICO** - ID inválido no header |
| issuer_id não enviado | PaymentModal.tsx + Edge Function | **RECOMENDADO** - 2 pontos perdidos |
| city/federal_unit como strings | mp-create-payment (linhas 448-449) | **CRÍTICO** - Causa SDK_EXCEPTION |
| Header X-meli-session-id vazio | mp-create-payment (linha 684) | **CRÍTICO** - Antifraude falha |
| Script security.js ausente | index.html | **RECOMENDADO** - Melhora fingerprint |

---

## Alterações Necessárias

### 1. Frontend: Capturar Device ID Corretamente

**Arquivo:** `src/components/payment/MercadoPagoCardForm.tsx`

O SDK React do Mercado Pago cria uma variável global `MP_DEVICE_SESSION_ID` após a inicialização. Precisamos capturá-la explicitamente:

```typescript
// Adicionar função helper antes do handleCardPaymentSubmit
const getDeviceId = (): string | undefined => {
  if (typeof window !== 'undefined') {
    // O SDK React cria estas variáveis globais automaticamente
    return (window as any).MP_DEVICE_SESSION_ID || 
           (window as any).deviceId ||
           undefined;
  }
  return undefined;
};

// No handleCardPaymentSubmit (linha 163-170), alterar para:
await onSubmit({
  token: formData.token,
  payment_method_id: formData.payment_method_id,
  installments: formData.installments,
  issuer_id: formData.issuer_id, // ✅ NOVO: Enviar issuer_id (+2 pontos)
  deviceId: getDeviceId(), // ✅ CORREÇÃO: Capturar Device ID real
  additionalData,
  payerOverride,
});
```

**Também atualizar a interface `CardFormSubmitData`:**

```typescript
export interface CardFormSubmitData {
  token: string;
  payment_method_id: string;
  installments: number;
  issuer_id?: string; // ✅ NOVO
  deviceId?: string;
  additionalData?: IAdditionalData;
  payerOverride?: { ... };
}
```

---

### 2. Frontend: Remover Fallback Inválido

**Arquivo:** `src/components/payment/PaymentModal.tsx`

Linha 1617 - Remover fallback "mp_sdk_auto":

```typescript
// ANTES:
device_id: cardFormData.deviceId || deviceId || "mp_sdk_auto",

// DEPOIS:
device_id: cardFormData.deviceId || deviceId || undefined,
```

---

### 3. Frontend: Adicionar issuer_id no Payload

**Arquivo:** `src/components/payment/PaymentModal.tsx`

No payload (após linha 1600), adicionar issuer_id:

```typescript
token: cardFormData.token,
payment_method_id: cardFormData.payment_method_id,
issuer_id: cardFormData.issuer_id, // ✅ NOVO: Enviar código do emissor
installments: cardFormData.installments || 1,
```

---

### 4. Frontend: Adicionar Script de Segurança

**Arquivo:** `index.html`

Adicionar antes de `</head>` (após linha 170):

```html
<!-- Mercado Pago Security Script - Device Fingerprint -->
<script src="https://www.mercadopago.com/v2/security.js" view="checkout" defer></script>
```

---

### 5. Edge Function: Corrigir additional_info (Deploy Manual)

**Arquivo:** `supabase/functions/mp-create-payment/index.ts`

**Alteração 1 - Linha 8 (BUILD_ID):**
```typescript
const BUILD_ID = 'mp-create-payment@2026-02-04T20:00:00Z-v4';
```

**Alteração 2 - Linhas 444-450 (payer.address):**
```typescript
payer: {
  first_name: finalPayer.first_name || '',
  last_name: finalPayer.last_name || '',
  phone: finalPayer.phone || {},
  address: {
    zip_code: finalPayer.address?.zip_code,
    street_name: finalPayer.address?.street_name,
    street_number: finalPayer.address?.street_number
    // REMOVIDO: city e federal_unit (API espera códigos IBGE numéricos)
  },
  registration_date: paymentRequest.metadata?.schedulePayload?.registration_date || new Date().toISOString()
},
```

**Alteração 3 - Linhas 453-460 (shipments.receiver_address):**
```typescript
shipments: {
  receiver_address: {
    zip_code: finalPayer.address?.zip_code,
    street_name: finalPayer.address?.street_name,
    street_number: finalPayer.address?.street_number,
    city_name: paymentRequest.payerOverride?.address?.city || (paymentRequest.payer?.address as any)?.city || '',
    state_name: paymentRequest.payerOverride?.address?.state || (paymentRequest.payer?.address as any)?.state || ''
  }
}
```

**Alteração 4 - Linhas 683-688 (Headers condicionais + issuer_id):**
```typescript
requestOptions: {
  idempotencyKey: idempotencyKey,
  customHeaders: {
    // ✅ CORREÇÃO: Só enviar X-meli-session-id se tiver device_id válido
    ...(paymentRequest.device_id ? { 'X-meli-session-id': paymentRequest.device_id } : {}),
    'X-Forwarded-For': clientIp ?? '',
    'User-Agent': req.headers.get('user-agent') ?? ''
  }
}
```

**Alteração 5 - Adicionar issuer_id no paymentData (após linha 532):**
```typescript
// Card payment (PRECISA ter token E payment_method_id)
paymentData.token = paymentRequest.token;
paymentData.payment_method_id = paymentRequest.payment_method_id;
paymentData.installments = paymentRequest.installments || 1;
paymentData.issuer_id = paymentRequest.issuer_id; // ✅ NOVO: Código do emissor (+2 pontos)
paymentData.statement_descriptor = 'PRONTIA SAUDE';
```

---

## Resumo das Alterações

| Arquivo | Responsável | Ação |
|---------|-------------|------|
| `src/components/payment/MercadoPagoCardForm.tsx` | Lovable | Capturar Device ID + issuer_id |
| `src/components/payment/PaymentModal.tsx` | Lovable | Remover fallback + enviar issuer_id |
| `index.html` | Lovable | Adicionar security.js |
| `supabase/functions/mp-create-payment/index.ts` | **Deploy Manual** | Corrigir additional_info + headers + issuer_id |

---

## Código Completo para Deploy Manual (Edge Function)

Após aprovar este plano, você receberá:
1. As alterações de frontend implementadas automaticamente
2. O código completo da Edge Function corrigida para você copiar e fazer deploy manual no Supabase Dashboard

---

## Checklist de Validação Pós-Deploy

1. **No console do navegador:**
   - Verificar se `window.MP_DEVICE_SESSION_ID` está preenchido
   - Log `[MercadoPagoCardForm] onSubmit triggered:` deve mostrar `deviceId` com valor UUID

2. **Na resposta do pagamento:**
   - `build_id` deve ser `mp-create-payment@2026-02-04T20:00:00Z-v4`
   - Sem erro `SDK_EXCEPTION`

3. **No painel Mercado Pago:**
   - Rodar nova medição de qualidade
   - Espera-se 100/100 ou próximo

4. **Testar com cartão real:**
   - Cartões de teste não ativam análise antifraude completa
   - Um cartão real validará a implementação

---

## Detalhes Técnicos

### Por que o Device ID é crítico?

O Device ID é um identificador único gerado pelo SDK que permite ao Mercado Pago:
- Identificar o dispositivo do comprador
- Detectar comportamentos suspeitos (mesmo dispositivo, cartões diferentes)
- Construir histórico de transações do dispositivo
- Reduzir falsos positivos no antifraude

Sem um Device ID válido, **todas as transações** são tratadas como "primeira compra de dispositivo desconhecido", aumentando drasticamente a taxa de rejeição por alto risco.

### Por que issuer_id melhora aprovação?

O `issuer_id` é o código do banco emissor do cartão. Quando enviado:
- O Mercado Pago pode rotear a transação para a melhor adquirente
- Evita erros de processamento entre bandeiras e bancos
- Melhora a taxa de aprovação em 3-5%

