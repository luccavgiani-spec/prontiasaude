
# Plano: Corrigir Erro "Unknown error" na Geração de PIX

## Problema

Quando uma paciente tenta gerar um PIX, o modal fecha e aparece o pop-up "Unknown error". Este erro ocorre porque:

1. O SDK do Mercado Pago pode lançar exceções não tratadas adequadamente
2. Quando o SDK falha (timeout, erro de rede, resposta HTML do gateway), a exceção é capturada pelo catch genérico
3. Se `mpResponse.error?.message` é undefined, o código retorna "Unknown error"

---

## Diagnóstico Técnico

### Localização do Problema

**Arquivo:** `supabase/functions/mp-create-payment/index.ts`

1. **Linha 574-584**: Chamada ao SDK `payment.create()` não tem try-catch próprio
2. **Linha 623**: Gera "Unknown error" quando `responseData.error?.message` é undefined:
   ```typescript
   throw new Error(`Mercado Pago API error: ${responseData.error?.message || 'Unknown error'}`);
   ```
3. **Linha 729**: Catch genérico pode retornar erro genérico se `error.message` estiver vazio

### Fluxo do Erro

```text
[Frontend: handlePixSubmit]
         │
         ▼
[invokeEdgeFunction → ploqujuhpwutpcibedbr/mp-create-payment]
         │
         ▼
[SDK MP: payment.create()] ──► EXCEÇÃO (ex: timeout, API down, HTML response)
         │
         ▼
[Catch genérico: error.message || 'Internal server error']
         │
         ▼
[Frontend recebe: { success: false, error: "..." }]
         │
         ▼
[Toast: "Unknown error" + Modal fecha]
```

---

## Correções Necessárias

### Correção 1: Tratamento robusto do SDK (CRÍTICO)

**Arquivo:** `supabase/functions/mp-create-payment/index.ts`

Envolver a chamada `payment.create()` em try-catch específico para capturar erros do SDK com mais detalhes:

```typescript
// ANTES (linha 574):
const mpResponse = await payment.create({...});

// DEPOIS:
let mpResponse;
try {
  mpResponse = await payment.create({
    body: paymentData,
    requestOptions: {
      idempotencyKey: idempotencyKey,
      customHeaders: {
        'X-meli-session-id': paymentRequest.device_id || '',
        'X-Forwarded-For': clientIp ?? '',
        'User-Agent': req.headers.get('user-agent') ?? ''
      }
    }
  });
} catch (sdkError: any) {
  console.error('[mp-create-payment] SDK Exception:', {
    message: sdkError.message,
    name: sdkError.name,
    stack: sdkError.stack?.substring(0, 500),
    cause: sdkError.cause
  });
  
  // Mensagem amigável baseada no tipo de erro
  let userMessage = 'Erro ao processar pagamento. Tente novamente.';
  
  if (sdkError.message?.includes('timeout') || sdkError.message?.includes('ETIMEDOUT')) {
    userMessage = 'Timeout ao conectar com gateway de pagamento. Tente novamente em alguns segundos.';
  } else if (sdkError.message?.includes('fetch') || sdkError.message?.includes('network')) {
    userMessage = 'Erro de conexão com gateway de pagamento. Verifique sua internet e tente novamente.';
  } else if (sdkError.message?.includes('400') || sdkError.message?.includes('bad request')) {
    userMessage = 'Dados de pagamento inválidos. Verifique CPF, email e telefone.';
  }
  
  return new Response(
    JSON.stringify({
      success: false,
      error: userMessage,
      error_code: 'SDK_EXCEPTION',
      error_detail: sdkError.message
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
  );
}
```

### Correção 2: Melhorar mensagem de erro técnico (IMPORTANTE)

**Arquivo:** `supabase/functions/mp-create-payment/index.ts` (linha 620-624)

Melhorar a mensagem quando `mpResponse.error` existe mas não tem `message`:

```typescript
// ANTES:
if (mpResponse.error) {
  console.error('[mp-create-payment] MP API technical error:', responseData);
  throw new Error(`Mercado Pago API error: ${responseData.error?.message || 'Unknown error'}`);
}

// DEPOIS:
if (mpResponse.error) {
  console.error('[mp-create-payment] MP API technical error:', {
    responseData,
    errorObject: mpResponse.error,
    errorType: typeof mpResponse.error
  });
  
  // Extrair mensagem do erro de múltiplas fontes possíveis
  const errorMessage = 
    responseData.error?.message || 
    responseData.error?.cause?.message ||
    (typeof responseData.error === 'string' ? responseData.error : null) ||
    'Erro inesperado do gateway de pagamento';
    
  throw new Error(`Mercado Pago API error: ${errorMessage}`);
}
```

### Correção 3: Catch genérico com mensagem amigável (IMPORTANTE)

**Arquivo:** `supabase/functions/mp-create-payment/index.ts` (linhas 719-735)

Melhorar o catch genérico para retornar mensagens mais específicas:

```typescript
} catch (error: any) {
  console.error('[mp-create-payment] Error:', {
    message: error.message,
    stack: error.stack?.substring(0, 500),
    name: error.name
  });
  
  const requestOrigin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(requestOrigin);
  
  // Mapear erros conhecidos para mensagens amigáveis
  let userMessage = 'Erro ao criar pagamento. Tente novamente.';
  let errorCode = 'INTERNAL_ERROR';
  
  if (error.message?.includes('Invalid or inactive service SKU')) {
    userMessage = 'Serviço temporariamente indisponível. Atualize a página e tente novamente.';
    errorCode = 'INVALID_SKU';
  } else if (error.message?.includes('Price validation failed')) {
    userMessage = 'Erro de validação de preço. Atualize a página e tente novamente.';
    errorCode = 'PRICE_MISMATCH';
  } else if (error.message?.includes('Missing card token')) {
    userMessage = 'Dados do cartão incompletos. Preencha novamente.';
    errorCode = 'MISSING_TOKEN';
  } else if (error.message?.includes('Mercado Pago API')) {
    userMessage = 'Gateway de pagamento indisponível. Tente novamente em alguns segundos.';
    errorCode = 'MP_API_ERROR';
  }
  
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: userMessage,
      error_code: errorCode,
      error_detail: error.message
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
  );
}
```

### Correção 4: Frontend - Exibir mensagem do backend (IMPORTANTE)

**Arquivo:** `src/components/payment/PaymentModal.tsx` (linhas 2099-2107)

Melhorar tratamento de erro para exibir mensagem específica do backend:

```typescript
// ANTES:
if (error || !data) {
  console.error("[handlePixSubmit] invoke error:", error);
  toast.dismiss();
  toast.error("Erro ao gerar código PIX", { description: "Tente novamente." });
  ...
}

// DEPOIS:
if (error || !data) {
  console.error("[handlePixSubmit] invoke error:", error);
  toast.dismiss();
  
  // Extrair mensagem específica do erro
  const errorMessage = error?.message || data?.error || "Erro ao gerar código PIX";
  const errorDescription = error?.error_detail || "Tente novamente em alguns instantes.";
  
  toast.error(errorMessage, { description: errorDescription });
  setPaymentStatus("idle");
  setShowErrorOverlay(true);
  setErrorOverlayMessage(errorMessage);
  return;
}
```

---

## Resumo das Alterações

| # | Arquivo | Linhas | Alteração | Impacto |
|---|---------|--------|-----------|---------|
| 1 | mp-create-payment/index.ts | 574-584 | Envolver SDK em try-catch com mensagens específicas | CRÍTICO |
| 2 | mp-create-payment/index.ts | 620-624 | Melhorar extração de mensagem de erro | IMPORTANTE |
| 3 | mp-create-payment/index.ts | 719-735 | Catch genérico com mensagens amigáveis | IMPORTANTE |
| 4 | PaymentModal.tsx | 2099-2107 | Exibir mensagem específica do backend | IMPORTANTE |

---

## Resultado Esperado

Após as correções:
- Erros do SDK serão capturados com mensagens específicas (timeout, rede, dados inválidos)
- "Unknown error" será substituído por mensagens claras e acionáveis
- O modal NÃO fechará silenciosamente - mostrará mensagem explicativa
- Logs detalhados facilitarão debug de problemas futuros

---

## IMPORTANTE: Deploy para Produção

Como a edge function está no Supabase de Produção (ploqujuhpwutpcibedbr) e NÃO no Lovable Cloud:

1. Após aprovar este plano, farei as alterações no código
2. Você precisará copiar o código da edge function atualizada
3. E deployar manualmente no dashboard do Supabase de Produção
