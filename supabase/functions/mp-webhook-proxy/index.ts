// Supabase Edge Function: mp-webhook-proxy
// Recebe webhooks do Mercado Pago e processa pagamentos aprovados

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[mp-webhook-proxy] Received webhook from Mercado Pago');
    
    const body = await req.json();
    console.log('[mp-webhook-proxy] Webhook data:', body);

    // Mercado Pago envia: { action: "payment.updated", data: { id: "123456" } }
    if (body.action === 'payment.updated' && body.data?.id) {
      const paymentId = body.data.id;
      
      // Buscar detalhes do pagamento no MP
      const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
      if (!MP_ACCESS_TOKEN) {
        throw new Error('MP_ACCESS_TOKEN not configured');
      }

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        },
      });

      const payment = await mpResponse.json();
      console.log('[mp-webhook-proxy] Payment details:', {
        id: payment.id,
        status: payment.status,
        payment_method: payment.payment_method_id
      });

      // Se foi aprovado, chamar lovable-payment-notify
      if (payment.status === 'approved') {
        const schedulePayload = payment.metadata?.schedulePayload;
        
        if (schedulePayload) {
          console.log('[mp-webhook-proxy] Calling lovable-payment-notify...');
          
          const notifyResponse = await fetch(
            `${SUPABASE_URL}/functions/v1/gas-proxy?path=${encodeURIComponent('lovable-payment-notify')}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                payment_id: payment.id.toString(),
                payment_status: 'approved',
                sku: schedulePayload.sku,
                amount: payment.transaction_amount * 100,
                currency: 'BRL',
                cpf: schedulePayload.cpf,
                email: schedulePayload.email,
                nome: schedulePayload.nome,
                telefone: schedulePayload.telefone,
                especialidade: schedulePayload.especialidade,
                servicoNome: payment.description,
                horarioISO: schedulePayload.horario_iso,
                planoAtivo: schedulePayload.plano_ativo
              })
            }
          );

          const notifyData = await notifyResponse.json();
          console.log('[mp-webhook-proxy] Notify response:', notifyData);
        } else {
          console.warn('[mp-webhook-proxy] No schedulePayload in metadata');
        }
      } else {
        console.log('[mp-webhook-proxy] Payment not approved yet, status:', payment.status);
      }
    }

    // ✅ Sempre retornar 200 para o Mercado Pago
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('[mp-webhook-proxy] Error:', error);
    // ✅ Retornar 200 mesmo em erro para evitar retries do MP
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});
