/**
 * Interface Neutra de Gateway de Pagamento
 * Preparado para integração futura com novo provedor
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
 * Gateway Nulo (Placeholder)
 * Retorna "não implementado" para todas as operações
 */
class NullGateway implements PaymentGateway {
  async createCheckoutSession(_order: CheckoutOrder): Promise<CheckoutResult> {
    return {
      success: false,
      error: 'Pagamentos temporariamente indisponíveis. Aguarde novo gateway.'
    };
  }

  async getPaymentStatus(_paymentId: string): Promise<PaymentStatus> {
    return 'not_implemented';
  }

  async cancelPayment(_paymentId: string): Promise<void> {
    console.warn('NullGateway: cancelPayment não implementado');
  }
}

// Singleton
let currentGateway: PaymentGateway = new NullGateway();

export function getPaymentGateway(): PaymentGateway {
  return currentGateway;
}

export function setPaymentGateway(gateway: PaymentGateway): void {
  currentGateway = gateway;
}
