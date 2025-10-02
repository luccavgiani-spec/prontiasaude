// API do InfinitePay (Substitui api.ts com lógica InfinitePay)
// Este arquivo mantém compatibilidade com a interface antiga para migração suave

import { openCheckoutModal, getProductKeyFromSlug, getCurrentCustomerData } from './infinitepay-checkout';

// Interface de compatibilidade (não usado mais, mas mantido por compatibilidade)
export interface CheckoutRequest {
  mode: 'payment' | 'subscription';
  price_id?: string;
  email: string;
  plan_code?: string;
  plan_duration_months?: number;
  phone_e164?: string;
  product_sku?: string;
  service_code?: string;
}

export interface CheckoutResponse {
  sessionId?: string;
  url?: string;
  error?: string;
}

/**
 * Função de compatibilidade - redireciona para o novo sistema InfinitePay
 * @deprecated Use openCheckoutModal diretamente
 */
export async function criarCheckout(data: CheckoutRequest): Promise<CheckoutResponse> {
  console.warn('criarCheckout is deprecated. Use openCheckoutModal directly.');
  
  // Para pagamentos de serviços, redirecionar para o modal InfinitePay
  if (data.mode === 'payment' && data.product_sku) {
    const productKey = getProductKeyFromSlug(data.product_sku.toLowerCase());
    
    if (productKey) {
      const customerData = await getCurrentCustomerData();
      
      return new Promise((resolve, reject) => {
        openCheckoutModal(
          productKey,
          customerData,
          () => {
            resolve({ url: '/confirmacao' });
          },
          () => {
            reject({ error: 'Timeout do pagamento' });
          }
        );
      });
    }
  }
  
  // Para assinaturas, retornar erro informando que precisa de implementação
  if (data.mode === 'subscription') {
    return {
      error: 'Assinaturas não estão disponíveis no momento. Entre em contato conosco.'
    };
  }
  
  return {
    error: 'Tipo de checkout não suportado'
  };
}

/**
 * Função de compatibilidade
 * @deprecated Não necessário com InfinitePay modal
 */
export function redirecionarParaCheckout(checkoutData: CheckoutResponse): void {
  if (checkoutData.url) {
    window.location.href = checkoutData.url;
  }
}
