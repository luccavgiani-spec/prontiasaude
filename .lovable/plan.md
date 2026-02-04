
# Plano: Correção Definitiva - Mercado Pago 100/100

## Diagnóstico dos Problemas Atuais

Analisando os códigos e as imagens do painel MP:

| Problema | Localização | Status |
|----------|-------------|--------|
| BUILD_ID ainda v3 | mp-create-payment linha 8 | ❌ Não deployado |
| Fallback "mp_sdk_auto" para PIX | PaymentModal.tsx linha 2090 | ❌ Ainda presente |
| city/federal_unit como strings | mp-create-payment linhas 448-449 | ❌ Ainda presente |
| Header X-meli-session-id vazio | mp-create-payment linha 684 | ❌ Enviando string vazia |
| issuer_id não utilizado | mp-create-payment | ❌ Não adicionado |

### Por que a qualidade caiu para 70?

O Mercado Pago detectou na transação `144121741393`:
1. **Device ID inválido/vazio** (-2 pontos → ação obrigatória)
2. **SDK do frontend** não detectado corretamente (-10 pontos → ação obrigatória)
3. **statement_descriptor** ausente ou inconsistente (-10 pontos → ação recomendada)

---

## Correções Necessárias

### 1. Frontend: Remover fallback "mp_sdk_auto" do PIX

**Arquivo:** `src/components/payment/PaymentModal.tsx`

**Linha 2090 - Alterar de:**
```typescript
device_id: deviceId || "mp_sdk_auto",
```

**Para:**
```typescript
device_id: deviceId || undefined,
```

### 2. Edge Function: Versão Completa Corrigida para Deploy Manual

O código completo da `mp-create-payment` com TODAS as correções:

**Alterações principais:**
1. `BUILD_ID` → `mp-create-payment@2026-02-04T21:00:00Z-v5`
2. Remover `city` e `federal_unit` do `payer.address` (linhas 448-449)
3. Usar `city_name` ao invés de `city` no `receiver_address` (linha 458)
4. Header `X-meli-session-id` condicional (linha 684)
5. Adicionar `issuer_id` no payload (linha 530)
6. Garantir `statement_descriptor` em TODOS os fluxos

---

## Bloco de Código Corrigido para mp-create-payment

### Trecho 1: BUILD_ID (linha 8)
```typescript
const BUILD_ID = 'mp-create-payment@2026-02-04T21:00:00Z-v5';
```

### Trecho 2: Interface PaymentRequest (adicionar issuer_id após linha 90)
```typescript
  issuer_id?: string; // ✅ NOVO: Código do banco emissor (+2 pontos)
```

### Trecho 3: fullAdditionalInfo (linhas 440-463)
```typescript
    const fullAdditionalInfo = {
      items: [
        {
          id: sku,
          title: service.name,
          description: hasCoupon 
            ? `${service.name} (${paymentRequest.metadata.discount_percentage}% desconto)` 
            : service.name,
          picture_url: `https://prontiasaude.com.br/assets/servicos/${sku.toLowerCase()}.jpg`,
          category_id: getCategoryIdBySKU(sku),
          quantity: 1,
          unit_price: hasCoupon 
            ? (paymentRequest.metadata.amount_discounted! / 100) 
            : expectedAmount
        }
      ],
      payer: {
        first_name: finalPayer.first_name || '',
        last_name: finalPayer.last_name || '',
        phone: finalPayer.phone || {},
        address: {
          zip_code: finalPayer.address?.zip_code,
          street_name: finalPayer.address?.street_name,
          street_number: finalPayer.address?.street_number
          // ✅ REMOVIDO: city e federal_unit (API espera códigos IBGE numéricos)
        },
        registration_date: paymentRequest.metadata?.schedulePayload?.registration_date || new Date().toISOString()
      },
      shipments: {
        receiver_address: {
          zip_code: finalPayer.address?.zip_code,
          street_name: finalPayer.address?.street_name,
          street_number: finalPayer.address?.street_number,
          city_name: paymentRequest.payerOverride?.address?.city || (paymentRequest.payer?.address as any)?.city || '',
          state_name: paymentRequest.payerOverride?.address?.state || (paymentRequest.payer?.address as any)?.state || ''
        }
      },
      ip_address: clientIp
    };
```

### Trecho 4: Card payment (linhas 528-534)
```typescript
      // Card payment (PRECISA ter token E payment_method_id)
      paymentData.token = paymentRequest.token;
      paymentData.payment_method_id = paymentRequest.payment_method_id;
      paymentData.installments = paymentRequest.installments || 1;
      paymentData.issuer_id = paymentRequest.issuer_id; // ✅ NOVO: Código do emissor (+2 pontos)
      paymentData.statement_descriptor = 'PRONTIA SAUDE'; // ✅ OBRIGATÓRIO: Nome na fatura (+10 pontos)
```

### Trecho 5: debug_context (linhas 642-651)
```typescript
    const debug_context = {
      build_id: BUILD_ID,
      selected_flow: isPix ? 'pix' : 'card',
      has_token: !!paymentRequest.token,
      has_device_id: !!paymentRequest.device_id, // ✅ NOVO: Log se device_id existe
      has_issuer_id: !!paymentRequest.issuer_id, // ✅ NOVO: Log se issuer_id existe
      payment_method_id_final: paymentData.payment_method_id,
      additional_info_keys: Object.keys(paymentData.additional_info || {}),
      has_additional_info_payer: !!(paymentData.additional_info?.payer),
      has_additional_info_shipments: !!(paymentData.additional_info?.shipments)
    };
```

### Trecho 6: customHeaders (linhas 681-688)
```typescript
        requestOptions: {
          idempotencyKey: idempotencyKey,
          customHeaders: {
            // ✅ CORREÇÃO: Só enviar X-meli-session-id se device_id existir
            ...(paymentRequest.device_id ? { 'X-meli-session-id': paymentRequest.device_id } : {}),
            ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}),
            'User-Agent': req.headers.get('user-agent') ?? ''
          }
        }
```

---

## Arquivos a Modificar

| Arquivo | Responsável | Alteração |
|---------|-------------|-----------|
| `src/components/payment/PaymentModal.tsx` | Lovable (automático) | Remover fallback "mp_sdk_auto" na linha 2090 |
| `supabase/functions/mp-create-payment/index.ts` | Deploy Manual | Atualizar código conforme trechos acima |

---

## Checklist de Validação Pós-Deploy

1. **Verificar build_id na resposta:**
   - Deve retornar `mp-create-payment@2026-02-04T21:00:00Z-v5`

2. **Verificar debug_context:**
   - `has_device_id: true` (se SDK capturou corretamente)
   - `has_issuer_id: true` (para cartões)
   - `has_additional_info_payer: true` (para cartões)
   - `has_additional_info_shipments: true` (para cartões)

3. **Verificar aprovação:**
   - Sem erro `SDK_EXCEPTION`
   - `status: approved` ou `pending` (para PIX)

4. **Rodar medição de qualidade MP:**
   - Aguardar 10 minutos após teste
   - Acessar painel de qualidade
   - Espera-se 90-100/100

---

## Sobre o PIX não aparecer no extrato

O PIX pode ter sido aprovado mas:
1. O webhook não chegou (verificar logs do mp-webhook)
2. O pagamento foi registrado com email diferente
3. Pode demorar até 5 minutos para aparecer

Verificar no painel MP: Cobranças > filtrar por payment_id ou email
