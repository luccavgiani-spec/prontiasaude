// Supabase Edge Function: mp-create-payment
// Cria pagamentos no Mercado Pago usando ACCESS_TOKEN server-side

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  };
  payment_method_id?: string;
  token?: string;
  installments?: number;
  metadata: {
    order_id: string;
    schedulePayload?: any;
  };
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
    
    // Prepare payment data for Mercado Pago API
    const paymentData: any = {
      transaction_amount: paymentRequest.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0),
      description: paymentRequest.items.map(i => i.title).join(', '),
      payer: paymentRequest.payer,
      metadata: paymentRequest.metadata,
      notification_url: MP_NOTIFICATION_URL,
    };

    // Add payment method details if provided (for card payments)
    if (paymentRequest.token && paymentRequest.payment_method_id) {
      paymentData.token = paymentRequest.token;
      paymentData.payment_method_id = paymentRequest.payment_method_id;
      paymentData.installments = paymentRequest.installments || 1;
    } else {
      // PIX payment
      paymentData.payment_method_id = 'pix';
    }

    // Generate idempotency key
    const idempotencyKey = crypto.randomUUID();

    console.log('[mp-create-payment] Creating payment:', {
      amount: paymentData.transaction_amount,
      payment_method: paymentData.payment_method_id,
      order_id: paymentRequest.metadata.order_id
    });

    // Call Mercado Pago API
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(paymentData),
    });

    const responseData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[mp-create-payment] MP API error:', responseData);
      throw new Error(`Mercado Pago API error: ${responseData.message || 'Unknown error'}`);
    }

    console.log('[mp-create-payment] Payment created successfully:', {
      payment_id: responseData.id,
      status: responseData.status
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: responseData.id,
        status: responseData.status,
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
