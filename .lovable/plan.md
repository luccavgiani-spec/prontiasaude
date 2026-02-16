

# Diagnostico: Pagamentos com Cartao Nao Completam

## Causa Raiz Principal

Foram identificadas **3 causas** que, combinadas, explicam o problema de "barra carrega mas pagamento nao completa":

---

### Causa 1: CORS Bloqueando Requests no Mobile (Mesma do schedule-redirect)

O `mp-create-payment` no Supabase de Producao tem os mesmos CORS limitados que acabamos de corrigir no `schedule-redirect`:

```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
```

Em navegadores mobile dentro do iframe do Lovable, headers adicionais (`x-supabase-client-platform`, etc.) sao enviados e **rejeitados no preflight OPTIONS**, resultando em `Failed to fetch` antes do request chegar a funcao. Por isso **nao ha logs** no `mp-create-payment` - o request nunca chega.

### Causa 2: Validacao de Endereco Bloqueia Silenciosamente

A funcao `validatePaymentReadiness()` (linha 960) exige `patientAddress?.street_number` (numero do endereco). Muitos pacientes nao tem esse campo preenchido no perfil. Quando falta:

1. O Brick do MP mostra a barra de loading (tokenizacao ok)
2. `handleCardSubmit` e chamado
3. `validatePaymentReadiness()` retorna `false`
4. Um toast aparece dizendo "Complete seu endereco"
5. **Mas o usuario pode nao ver o toast** porque ele aparece atras/abaixo do modal

O pagamento nunca e enviado ao backend.

### Causa 3: issuer_id Nao Sendo Passado

Na callback `onSubmit` do `MercadoPagoCardForm` (linhas 2442-2449 e 2712-2719), o `issuer_id` nao e incluido no objeto passado para `handleCardSubmit`:

```typescript
// ATUAL - falta issuer_id
await handleCardSubmit({
  token: data.token,
  payment_method_id: data.payment_method_id,
  installments: data.installments,
  deviceId: data.deviceId,
  payerOverride: data.payerOverride,
});
```

Isso nao bloqueia o pagamento, mas reduz a pontuacao de qualidade do Mercado Pago e pode contribuir para recusas.

---

## Plano de Correcao

### 1. CORS do mp-create-payment (Edge Function)

**Arquivo:** `supabase/functions/mp-create-payment/index.ts` (linha 35)

Atualizar `Access-Control-Allow-Headers` para incluir os headers extras de mobile:

```
ANTES:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'

DEPOIS:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

**Pos-alteracao:** Copiar o arquivo e redeployar no Supabase de Producao.

### 2. Relaxar Validacao de street_number

**Arquivo:** `src/components/payment/PaymentModal.tsx` (linhas 966-972)

Tornar `street_number` **opcional** na validacao (manter o warning mas nao bloquear):

```typescript
// ANTES: Bloqueia sem street_number
address: !!(patientAddress?.cep && patientAddress?.city && patientAddress?.state && patientAddress?.street_name && patientAddress?.street_number),

// DEPOIS: Apenas exige CEP, cidade, estado e rua
address: !!(patientAddress?.cep && patientAddress?.city && patientAddress?.state && patientAddress?.street_name),
```

### 3. Passar issuer_id na Callback

**Arquivo:** `src/components/payment/PaymentModal.tsx` (linhas 2442-2449 e 2712-2719)

Adicionar `issuer_id: data.issuer_id` ao objeto passado:

```typescript
await handleCardSubmit({
  token: data.token,
  payment_method_id: data.payment_method_id,
  installments: data.installments,
  issuer_id: data.issuer_id,       // NOVO
  deviceId: data.deviceId,
  payerOverride: data.payerOverride,
});
```

---

## Resumo de Alteracoes

| # | Arquivo | Linha(s) | Alteracao |
|---|---------|----------|-----------|
| 1 | `supabase/functions/mp-create-payment/index.ts` | 35 | Expandir CORS headers |
| 2 | `src/components/payment/PaymentModal.tsx` | 966-972 | Tornar street_number opcional |
| 3 | `src/components/payment/PaymentModal.tsx` | 2442-2449 | Passar issuer_id (instancia 1) |
| 4 | `src/components/payment/PaymentModal.tsx` | 2712-2719 | Passar issuer_id (instancia 2) |

**Nota importante:** Apos a alteracao #1, voce precisara redeployar o `mp-create-payment` no Supabase de Producao manualmente.

