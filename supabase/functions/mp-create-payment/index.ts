// Supabase Edge Function: mp-create-payment
// Cria pagamentos no Mercado Pago usando ACCESS_TOKEN server-side

import { getCorsHeaders } from '../common/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = getCorsHeaders();

interface PaymentRequest {
  items: Array<{
    id: string;
    title: string;
    unit_price: number;
    quantity: number;
  }>;
  payer: {
    email: string;
    first_name?: string;
    last_name?: string;
    identification?: {
      type: string;
      number: string;
    };
    phone?: {
      area_code: string;
      number: string;
    };
    address?: {
      zip_code?: string;
      street_name?: string;
      street_number?: number;
    };
  };
  payment_method_id?: string;
  token?: string;
  installments?: number;
  metadata: {
    order_id: string;
    schedulePayload?: any;
  };
  device_id?: string;
}

/**
 * Mapeia SKU para category_id do Mercado Pago
 */
function getCategoryIdBySKU(sku: string): string {
  if (sku.includes('PSI') || sku.includes('PSICO')) {
    return 'services';
  }
  return 'health';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    const MP_NOTIFICATION_URL = Deno.env.get('MP_NOTIFICATION_URL');

    if (!MP_ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN not configured');
    }

    const paymentRequest: PaymentRequest = await req.json();
    
    // ✅ NOVO: Conectar ao Supabase para validar preço
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const sku = paymentRequest.items?.[0]?.id;
    if (!sku) {
      throw new Error('Missing SKU in payment request');
    }

    const clientAmount = paymentRequest.items.reduce(
      (sum, item) => sum + (item.unit_price * item.quantity), 
      0
    );

    console.log('[mp-create-payment] Items received:', {
      items_count: paymentRequest.items?.length || 0,
      client_amount: clientAmount
    });

    // ✅ NOVO: Buscar preço validado do banco
    const { data: service, error: serviceError } = await supabaseClient
      .from('services')
      .select('sku, name, price_cents, allows_recurring, recurring_frequency, recurring_frequency_type')
      .eq('sku', sku)
      .eq('active', true)
      .maybeSingle();

    if (serviceError || !service) {
      console.error('[mp-create-payment] Invalid SKU:', {
        sku,
        error: serviceError?.message
      });
      throw new Error(`Invalid or inactive service SKU: ${sku}`);
    }

    const expectedAmount = service.price_cents / 100; // Converter para reais

    // ✅ CORRIGIDO: Tolerar clientAmount ausente/zero (usar apenas preço do DB)
    if (clientAmount === 0 || !paymentRequest.items || paymentRequest.items.length === 0) {
      console.log('[mp-create-payment] Client amount missing or zero, using DB price:', {
        sku,
        expected: expectedAmount
      });
    } else {
      // Se cliente enviou amount, validar com tolerância de 1 centavo
      const priceDifference = Math.abs(clientAmount - expectedAmount);
      if (priceDifference > 0.01) {
        console.error('[mp-create-payment] Price mismatch detected:', {
          sku,
          client_sent: clientAmount,
          expected: expectedAmount,
          difference: priceDifference
        });
        throw new Error(
          `Price validation failed: expected R$ ${expectedAmount.toFixed(2)}, received R$ ${clientAmount.toFixed(2)}`
        );
      }
    }

    console.log('[mp-create-payment] Validation passed:', {
      sku,
      name: service.name,
      amount: expectedAmount
    });

    // ✅ Usar valores validados do DB (não do cliente)
    const paymentData: any = {
      transaction_amount: expectedAmount,
      description: service.name,
      payer: paymentRequest.payer,
      metadata: paymentRequest.metadata,
      notification_url: MP_NOTIFICATION_URL,
      additional_info: {
        items: [
          {
            id: sku,
            title: service.name,
            category_id: getCategoryIdBySKU(sku),
            quantity: 1,
            unit_price: expectedAmount
          }
        ],
        payer: {
          first_name: paymentRequest.payer.first_name || '',
          last_name: paymentRequest.payer.last_name || '',
          phone: paymentRequest.payer.phone || {},
          address: paymentRequest.payer.address || {}
        }
      }
    };

    // ✅ Determinar método de pagamento sem fallback silencioso
    if (paymentRequest.payment_method_id === 'pix' || (!paymentRequest.token && !paymentRequest.payment_method_id)) {
      // PIX payment (explícito ou quando não há dados de cartão)
      paymentData.payment_method_id = 'pix';
    } else if (paymentRequest.token && paymentRequest.payment_method_id) {
      // Card payment (PRECISA ter token E payment_method_id)
      paymentData.token = paymentRequest.token;
      paymentData.payment_method_id = paymentRequest.payment_method_id;
      paymentData.installments = paymentRequest.installments || 1;
      
      // ✅ NOVO: Normalização server-side para cartão + binary_mode
      const payerEmail = String(paymentRequest.payer?.email || '').trim().toLowerCase();
      const payerCPF = String(paymentRequest.payer?.identification?.number || '').replace(/\D/g, '');
      
      paymentData.payer = {
        ...paymentRequest.payer,
        email: payerEmail,
        identification: {
          type: 'CPF',
          number: payerCPF
        }
      };
      
      // ✅ binary_mode: true força resposta approved/rejected (evita in_process)
      paymentData.binary_mode = true;
      
      // ✅ Ativar 3DS 2.0 em modo opcional
      paymentData.three_d_secure_mode = 'optional';
      
      console.log('[mp-create-payment] Card payment normalized:', {
        email: payerEmail,
        cpf: payerCPF ? `${payerCPF.substring(0, 3)}***` : 'AUSENTE',
        binary_mode: true,
        three_d_secure_mode: 'optional'
      });
    } else {
      // ✅ BLOQUEAR fallback silencioso: cartão sem token é ERRO
      console.error('[mp-create-payment] Invalid card payment: missing token or payment_method_id', {
        has_token: !!paymentRequest.token,
        has_payment_method: !!paymentRequest.payment_method_id,
        payment_method: paymentRequest.payment_method_id
      });
      throw new Error('Missing card token or payment_method_id for card payment');
    }

    // Generate idempotency key
    const idempotencyKey = crypto.randomUUID();

    console.log('[mp-create-payment] Creating payment:', {
      amount: paymentData.transaction_amount,
      payment_method: paymentData.payment_method_id,
      order_id: paymentRequest.metadata.order_id
    });

    // Call Mercado Pago API
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    };

    // Adicionar Device ID no header (se disponível)
    if (paymentRequest.device_id) {
      headers['X-meli-session-id'] = paymentRequest.device_id;
      console.log('[mp-create-payment] Device ID added to header');
    }

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers,
      body: JSON.stringify(paymentData),
    });

    const responseData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[mp-create-payment] MP API error:', responseData);
      throw new Error(`Mercado Pago API error: ${responseData.message || 'Unknown error'}`);
    }

    console.log('[mp-create-payment] Payment created successfully:', {
      payment_id: responseData.id,
      status: responseData.status,
      status_detail: responseData.status_detail,
      security_validation: {
        has_device_id: !!paymentRequest.device_id,
        has_additional_info: !!paymentData.additional_info,
        has_3ds: !!paymentData.three_d_secure_mode,
        payer_data_completeness: {
          has_email: !!paymentRequest.payer.email,
          has_cpf: !!paymentRequest.payer.identification?.number,
          has_phone: !!paymentRequest.payer.phone,
          has_address: !!paymentRequest.payer.address
        }
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: responseData.id,
        status: responseData.status,
        status_detail: responseData.status_detail,
        error_message: responseData.error?.message,
        qr_code: responseData.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: responseData.point_of_interaction?.transaction_data?.qr_code_base64,
        ticket_url: responseData.point_of_interaction?.transaction_data?.ticket_url,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('[mp-create-payment] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
