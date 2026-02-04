
# Plano: Correção dos Alertas do Mercado Pago

## Diagnóstico dos Problemas

Com base nas imagens enviadas, identifiquei os seguintes alertas do painel de monitoramento do Mercado Pago:

| Categoria | Alerta | Status | Impacto |
|-----------|--------|--------|---------|
| **Segurança** | Formulário de Cartões - PCI Compliance (Secure Fields) | ⚠️ Pendente | 8 pontos |
| **Experiência de compra** | Descrição - Fatura do cartão (statement_descriptor) | ⚠️ Pendente | 10 pontos |
| **Escalabilidade** | SDK do frontend MercadoPago.JS V2 | ⚠️ Pendente | 10 pontos |
| **Aprovação dos pagamentos** | Identificador do dispositivo (Device ID) | ⚠️ Pendente | 2 pontos |

### Erros de API (400/404)
- **POST /payments** com código 400: 65 ocorrências (73.03%)
- **GET /payments** com código 404: 24 ocorrências (26.97%)

---

## Análise do Código Atual

### O que já está implementado corretamente:

1. **SDK v2 carregando corretamente** (`sdk.mercadopago.com/js/v2`)
2. **statement_descriptor** já está sendo enviado (`PRONTIA SAUDE`) na edge function
3. **Device ID** está sendo capturado via `cardPaymentBrick.getDeviceId()`
4. **SDK oficial no backend** (`npm:mercadopago@2.0.15`)

### Problemas identificados:

1. **SDK React não está sendo usado** - O código carrega o SDK via script tag em vez de usar `@mercadopago/sdk-react` que já está instalado no projeto
2. **Secure Fields (PCI Compliance)** - O CardPaymentBrick atual usa o método tradicional. O MP recomenda usar componentes React nativos do SDK
3. **Device ID pode ter race condition** - Está sendo capturado no `onSubmit` mas pode falhar silenciosamente
4. **Erros 400 em POST /payments** - Provavelmente dados malformados ou validação falhando

---

## Solução Proposta

### Etapa 1: Migrar para SDK React Oficial

Substituir o carregamento manual do SDK por componentes nativos do `@mercadopago/sdk-react`:

```typescript
// Antes (atual)
const script = document.createElement("script");
script.src = "https://sdk.mercadopago.com/js/v2";

// Depois (recomendado)
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';

initMercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
```

### Etapa 2: Usar CardPayment Component Nativo

O pacote `@mercadopago/sdk-react` já está instalado (versão ^1.0.6). Usar o componente React nativo:

```tsx
import { CardPayment } from '@mercadopago/sdk-react';

<CardPayment
  initialization={{
    amount: amount / 100,
    payer: {
      email: formData.email,
      identification: { type: 'CPF', number: formData.cpf }
    }
  }}
  onSubmit={handleCardPayment}
  onReady={handleBrickReady}
  onError={handleBrickError}
/>
```

### Etapa 3: Garantir Device ID via SDK

O SDK React gerencia automaticamente o Device ID quando usado corretamente. Manter fallback explícito:

```typescript
// No onSubmit do CardPayment
const handleCardPayment = async (formData, additionalData) => {
  // additionalData.deviceId já vem preenchido pelo SDK
  const deviceId = additionalData?.deviceId || 'sdk_managed';
  
  // Enviar para backend
  await invokeEdgeFunction('mp-create-payment', {
    body: { ...paymentRequest, device_id: deviceId }
  });
};
```

### Etapa 4: Validar statement_descriptor no Backend

Já está implementado na edge function (`paymentData.statement_descriptor = 'PRONTIA SAUDE'`), mas precisa garantir que só é enviado para pagamentos com cartão (não PIX).

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/payment/PaymentModal.tsx` | Migrar para SDK React nativo |
| `src/main.tsx` ou `src/App.tsx` | Inicializar `initMercadoPago()` globalmente |
| `supabase/functions/mp-create-payment/index.ts` | Validar campos obrigatórios antes de enviar |

---

## Benefícios Esperados

1. **+8 pontos** - PCI Compliance com Secure Fields automático
2. **+10 pontos** - SDK oficial reconhecido
3. **+2 pontos** - Device ID gerenciado automaticamente
4. **Redução de erros 400** - Validação mais robusta
5. **Melhor taxa de aprovação** - Dados antifraude completos

---

## Considerações Importantes

- Esta é uma mudança significativa no fluxo de pagamento
- Recomendo testar extensivamente em ambiente de desenvolvimento antes de publicar
- O statement_descriptor já está implementado corretamente no backend
- Os erros 404 em GET /payments são provavelmente do polling de status (não crítico)

---

## Próximos Passos

1. Aprovar este plano para implementação
2. Modificar o PaymentModal para usar SDK React
3. Testar fluxo completo de cartão e PIX
4. Monitorar métricas no painel do MP
