import { useCallback } from 'react';
import { toast } from 'sonner';
import { getPaymentGateway, CheckoutOrder } from '@/lib/payment-gateway';

export function usePayment() {
  const createCheckout = useCallback(async (order: CheckoutOrder) => {
    const gateway = getPaymentGateway();
    const result = await gateway.createCheckoutSession(order);
    
    if (!result.success) {
      toast.info(result.error || 'Pagamentos temporariamente indisponíveis');
      return null;
    }
    
    return result.checkoutUrl;
  }, []);

  return { createCheckout };
}
