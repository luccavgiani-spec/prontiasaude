# Migração para InfinitePay - Checkout Transparente

## ✅ O que foi feito

### 1. Remoção completa do Stripe
- ❌ Desinstalada dependência `stripe`
- ❌ Removidas edge functions:
  - `supabase/functions/stripe-checkout/`
  - `supabase/functions/stripe-webhook/`
  - `supabase/functions/subscription-manager/`
- ❌ Removido arquivo `src/lib/stripe-checkout.ts`
- ❌ Limpas todas as referências a Stripe no código
- ❌ Removida chave pública Stripe de `src/lib/constants.ts`
- ❌ Removidas tipagens Stripe de `src/types/global.d.ts`

### 2. Implementação do InfinitePay

#### Arquivo principal: `src/lib/infinitepay-checkout.ts`
Novo sistema de checkout com:
- ✅ Modal transparente com iframe
- ✅ Polling automático (3s) para verificar status do pagamento
- ✅ Timeout de 5 minutos
- ✅ Geração de ORDER_NSU (UUID v4)
- ✅ Suporte a dados do cliente (email, telefone, endereço)
- ✅ Integração com Meta Pixel (InitiateCheckout)
- ✅ URL encoding adequado
- ✅ Tratamento de erros e estados

#### Catálogo de produtos
```typescript
consulta: 5990 centavos (R$ 59,90)
renovacao: 3990 centavos (R$ 39,90)
psicologa: 5990 centavos (R$ 59,90)
psiquiatria: 19990 centavos (R$ 199,90)
laudo_bariatrica: 19990 centavos (R$ 199,90)
laudo_laq_vas: 14990 centavos (R$ 149,90)
```

#### Página de confirmação: `src/pages/Confirmacao.tsx`
- ✅ Timer regressivo de 30s
- ✅ Botão "Ir Agora" para pular espera
- ✅ Exibição de ORDER_NSU e comprovante (se disponível)
- ✅ Tracking de Purchase event (Meta Pixel)
- ✅ Redirecionamento automático para plataforma parceira
- ✅ Design responsivo e acessível

### 3. Configuração de Variáveis de Ambiente

Adicionado ao `.env`:
```env
VITE_INFINITEPAY_HANDLE="cloudwalker"
VITE_PARTNER_REDIRECT_URL="/area-do-paciente"
```

**⚠️ IMPORTANTE:** O usuário deve substituir esses valores pelos reais.

### 4. Atualizações nos componentes

Arquivos atualizados para usar InfinitePay:
- ✅ `src/components/home/ServicoCard.tsx`
- ✅ `src/pages/ServicoDetalhe.tsx`
- ✅ `src/components/home/ProvasSection.tsx` (selo "InfinitePay")
- ✅ `src/components/layout/Footer.tsx` (selo "InfinitePay")
- ✅ `src/lib/constants.ts` (CHECKOUT_MODE = "infinitepay")
- ✅ `src/App.tsx` (rota /confirmacao já existia)

### 5. Arquivo de compatibilidade

Criado `src/lib/api-infinitepay.ts` para manter compatibilidade com código legado que ainda usa `criarCheckout()`.

## 🔧 Configuração Necessária (Próximos Passos)

### 1. Atualizar Handle da InfinitePay
Editar `src/lib/infinitepay-checkout.ts`:
```typescript
export const INFINITEPAY_CONFIG = {
  handle: 'SEU_HANDLE_AQUI', // Substituir 'cloudwalker'
  partnerRedirectUrl: 'URL_DA_PLATAFORMA_PARCEIRA', // Ex: 'https://parceiro.com/area-paciente'
};
```

### 2. Atualizar .env
```env
VITE_INFINITEPAY_HANDLE="seu_handle_real"
VITE_PARTNER_REDIRECT_URL="https://parceiro.com/area-paciente"
```

### 3. Adicionar domínios ao Content Security Policy

Se houver CSP configurado, adicionar:
```
frame-src 'self' https://checkout.infinitepay.io;
connect-src 'self' https://api.infinitepay.io;
```

## 🎯 Fluxo de Pagamento

### Para Serviços Médicos:

1. **Usuário clica em "Comprar/Agendar"**
   - Verifica login (obrigatório)
   - Track Lead event
   - Coleta dados do cliente

2. **Abre modal transparente**
   - Gera ORDER_NSU único
   - Constrói URL do checkout InfinitePay
   - Renderiza iframe dentro do modal
   - Track InitiateCheckout event

3. **Polling de status**
   - A cada 3 segundos chama API pública da InfinitePay
   - Verifica `external_order_nsu`
   - Se `paid: true` → fecha modal e redireciona

4. **Página de confirmação**
   - Timer de 30s
   - Track Purchase event
   - Redireciona automaticamente para plataforma parceira

## 🧪 Testes Preparados

### Caso de teste: Consulta Pronto Atendimento
```javascript
{
  productKey: 'consulta',
  name: 'Consulta Clínica Geral',
  price: 5990, // centavos
  orderNsu: crypto.randomUUID()
}
```

### Cenários:
1. ✅ Modal abre com iframe InfinitePay
2. ✅ Polling inicia automaticamente
3. ✅ Ao simular `paid: true`, modal fecha
4. ✅ Redireciona para `/confirmacao`
5. ✅ Timer conta 30s e redireciona

### Teste de cancelamento:
1. ✅ Usuário fecha modal → confirmação exibida
2. ✅ Polling cancelado
3. ✅ Nova tentativa gera novo ORDER_NSU

## 📊 API da InfinitePay

### Endpoint de verificação:
```
GET https://api.infinitepay.io/invoices/public/checkout/payment_check/{handle}
Query params:
  - handle: string
  - external_order_nsu: string (UUID)
  
Response:
{
  "success": boolean,
  "paid": boolean
}
```

### URL do checkout:
```
https://checkout.infinitepay.io/{handle}?items=[...]&order_nsu={uuid}&redirect_url={url}

Parâmetros opcionais do cliente:
- customer_name
- customer_email  
- customer_cellphone
- address_cep
- address_complement
- address_number
```

## ⚠️ Observações Importantes

1. **Cross-Origin**: Não é possível ler URL do iframe, então dependemos exclusivamente do polling

2. **Sem Redirecionamento**: Todo fluxo acontece no modal, sem navegar a página principal

3. **Planos/Assinaturas**: Não implementado ainda (apenas pagamentos únicos)

4. **Compatibilidade**: Arquivo `api-infinitepay.ts` mantém interface antiga por enquanto

5. **Meta Pixel**: Eventos trackados automaticamente:
   - Lead (no clique)
   - InitiateCheckout (ao abrir modal)
   - Purchase (na confirmação)

## 🚀 Deploy

Não há secrets ou edge functions para configurar. O sistema é 100% frontend + API pública da InfinitePay.

---

**Status**: ✅ Migração completa. Pronto para testes.
**Próximo passo**: Substituir valores de configuração e testar fluxo completo.
