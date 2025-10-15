/**
 * Mercado Pago API Integration
 * Handles payment creation (Card & PIX) via Supabase gas-proxy
 */

import { callGas } from './gas-proxy';

export interface PaymentPayload {
  method: 'card' | 'pix';
  transaction_amount: number;
  description: string;
  token?: string; // Para cartão (gerado pelo CardForm)
  payment_method_id?: string; // Para cartão (ex: 'visa', 'master')
  installments?: number; // Para cartão
  payer: {
    email: string;
    identification?: {
      type: 'CPF';
      number: string;
    };
  };
  schedulePayload: {
    cpf: string;
    email: string;
    nome: string;
    telefone: string;
    especialidade?: string;
    sku: string;
    horario_iso?: string;
    plano_ativo: boolean;
  };
}

export interface PaymentResponse {
  success: boolean;
  status?: 'approved' | 'rejected' | 'in_process' | 'pending';
  payment_id?: string;
  qr_code?: string;
  qr_code_base64?: string;
  error?: string;
  message?: string;
}

/**
 * Inicializa o SDK do Mercado Pago
 */
export function initMercadoPago(publicKey: string): void {
  // O SDK será carregado via script tag no PaymentModal
  console.log('[MP] SDK initialized with key:', publicKey.substring(0, 10) + '...');
}

/**
 * Cria pagamento via Supabase gas-proxy
 */
export async function createPayment(payload: PaymentPayload): Promise<PaymentResponse> {
  try {
    console.log('[MP] Creating payment via gas-proxy:', payload.method);
    
    const { json: data } = await callGas('mp-create-payment', payload);
    console.log('[MP] Payment response:', data);
    
    return {
      success: data && data.success !== false,
      status: data?.status,
      payment_id: data?.payment_id || data?.id,
      qr_code: data?.qr_code,
      qr_code_base64: data?.qr_code_base64,
      error: data?.error,
      message: data?.message,
    };
  } catch (error) {
    console.error('[MP] Payment creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao processar pagamento',
    };
  }
}

/**
 * Polling para verificar status do pagamento PIX
 * Consulta a cada 5 segundos por até 2 minutos
 */
export async function pollPixStatus(
  paymentId: string,
  onStatusUpdate: (status: PaymentResponse['status']) => void,
  maxAttempts = 24 // 24 * 5s = 2 minutos
): Promise<void> {
  let attempts = 0;

  const poll = async () => {
    try {
      const { json: data } = await callGas('mp-payment-status', { payment_id: paymentId });
      const status = data?.status as PaymentResponse['status'];
      
      console.log('[MP] Polling status:', status);
      onStatusUpdate(status);

      // Para se aprovado ou rejeitado
      if (status === 'approved' || status === 'rejected') {
        return;
      }

      // Continua polling se ainda pendente
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000); // 5 segundos
      } else {
        console.warn('[MP] Polling timeout');
        onStatusUpdate('pending');
      }
    } catch (error) {
      console.error('[MP] Polling error:', error);
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      }
    }
  };

  // Inicia polling
  setTimeout(poll, 5000); // Primeira checagem após 5s
}

/**
 * Cria assinatura recorrente via Supabase gas-proxy
 */
export async function createSubscription(payload: any): Promise<any> {
  try {
    console.log('[MP] Creating subscription via gas-proxy:', payload.reason);
    
    const { json: data } = await callGas('mp-create-subscription', payload);
    console.log('[MP] Subscription response:', data);
    
    return {
      success: data && data.success !== false,
      status: data?.status,
      subscription_id: data?.subscription_id || data?.id,
      error: data?.error,
      message: data?.message,
    };
  } catch (error) {
    console.error('[MP] Subscription creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar assinatura',
    };
  }
}

/**
 * Polling para verificar status da assinatura
 * Consulta a cada 5 segundos por até 3 minutos
 */
export async function pollSubscriptionStatus(
  subscriptionId: string,
  onStatusUpdate: (status: 'confirmed' | 'pending' | 'rejected') => void,
  maxAttempts = 36 // 36 * 5s = 3 minutos
): Promise<void> {
  let attempts = 0;

  const poll = async () => {
    try {
      const { json: data } = await callGas('mp-subscription-status', { subscription_id: subscriptionId });
      const status = data?.status;
      
      console.log('[MP] Subscription polling status:', status);

      // Mapear status do MP para nosso status
      if (status === 'authorized' && data?.first_payment_status === 'approved') {
        onStatusUpdate('confirmed');
        return;
      } else if (status === 'cancelled' || data?.first_payment_status === 'rejected') {
        onStatusUpdate('rejected');
        return;
      }

      // Continua polling
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      } else {
        console.warn('[MP] Subscription polling timeout');
        onStatusUpdate('pending');
      }
    } catch (error) {
      console.error('[MP] Subscription polling error:', error);
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      }
    }
  };

  // Inicia polling
  setTimeout(poll, 5000);
}
