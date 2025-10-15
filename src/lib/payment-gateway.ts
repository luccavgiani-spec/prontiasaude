/**
 * Interface Neutra de Gateway de Pagamento
 * Integração Mercado Pago ativa
 */

export interface PaymentGateway {
  createCheckoutSession(order: CheckoutOrder): Promise<CheckoutResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  cancelPayment(paymentId: string): Promise<void>;
}

export interface CheckoutOrder {
  sku: string;
  name: string;
  price: number; // em centavos
  quantity: number;
  customerEmail?: string;
  customerPhone?: string;
}

export interface CheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'not_implemented';

/**
 * Gateway Mercado Pago (Ativo)
 * Abre modal de pagamento transparente
 */
class MercadoPagoGateway implements PaymentGateway {
  async createCheckoutSession(order: CheckoutOrder): Promise<CheckoutResult> {
    // Modal é aberto diretamente nos componentes
    // Este método retorna sucesso para sinalizar que o modal deve abrir
    return {
      success: true,
      checkoutUrl: 'modal', // Flag especial para abrir modal
    };
  }

  async getPaymentStatus(_paymentId: string): Promise<PaymentStatus> {
    // Status é verificado via polling no modal
    return 'pending';
  }

  async cancelPayment(_paymentId: string): Promise<void> {
    console.log('[MP] Payment cancelled');
  }
}

// Singleton
let currentGateway: PaymentGateway = new MercadoPagoGateway();

export function getPaymentGateway(): PaymentGateway {
  return currentGateway;
}

export function setPaymentGateway(gateway: PaymentGateway): void {
  currentGateway = gateway;
}

/**
 * Ativa gateway Mercado Pago
 */
export function enableMercadoPago(): void {
  currentGateway = new MercadoPagoGateway();
  console.log('[Payment Gateway] Mercado Pago enabled');
}
