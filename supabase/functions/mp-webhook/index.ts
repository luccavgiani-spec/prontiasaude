import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getWebhookCorsHeaders } from '../common/cors.ts';

const corsHeaders = getWebhookCorsHeaders(); // Webhooks need wildcard CORS

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[mp-webhook] Webhook received - action:', body.action);

    // Apenas processar payment.updated
    if (body.action !== 'payment.updated') {
      console.log('[mp-webhook] Ignorando action:', body.action);
      return new Response(JSON.stringify({ success: true, message: 'Action ignored' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      console.error('[mp-webhook] Payment ID não encontrado');
      return new Response(JSON.stringify({ success: true, message: 'No payment ID' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar detalhes do pagamento no Mercado Pago
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      console.error('[mp-webhook] MP_ACCESS_TOKEN não configurado');
      return new Response(JSON.stringify({ success: false, error: 'Token não configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[mp-webhook] Buscando payment:', paymentId);
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
      }
    });

    if (!paymentRes.ok) {
      const errorText = await paymentRes.text();
      console.error('[mp-webhook] Erro ao buscar payment:', paymentRes.status, errorText);
      return new Response(JSON.stringify({ success: true, message: 'Payment fetch failed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payment = await paymentRes.json();
    console.log('[mp-webhook] Payment status:', payment.status, 'Payment ID:', payment.id);

    // Processar apenas pagamentos aprovados
    if (payment.status !== 'approved') {
      console.log('[mp-webhook] Payment status não é approved:', payment.status);
      return new Response(JSON.stringify({ success: true, message: 'Not approved yet' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extrair schedulePayload do metadata
    const schedulePayload = payment.metadata?.schedulePayload || payment.metadata?.schedule_payload;
    if (!schedulePayload) {
      console.error('[mp-webhook] schedulePayload não encontrado no metadata');
      return new Response(JSON.stringify({ success: true, message: 'No schedule payload' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[mp-webhook] Processing payment for SKU:', schedulePayload.sku);

    // Chamar gas-proxy com lovable-payment-notify
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const notifyPayload = {
      payment_id: payment.id.toString(),
      payment_status: payment.status,
      sku: schedulePayload.sku,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
      cpf: schedulePayload.cpf,
      email: schedulePayload.email,
      nome: schedulePayload.nome,
      telefone: schedulePayload.telefone,
      especialidade: schedulePayload.especialidade || 'Clínico Geral',
      horario_iso: schedulePayload.horario_iso || new Date().toISOString(),
      plano_ativo: schedulePayload.plano_ativo || false
    };

    console.log('[mp-webhook] Notifying gas-proxy - payment_id:', notifyPayload.payment_id);

    const { data: notifyData, error: notifyError } = await supabase.functions.invoke('gas-proxy', {
      body: {
        path: 'lovable-payment-notify',
        ...notifyPayload
      }
    });

    if (notifyError) {
      console.error('[mp-webhook] Notification error:', notifyError.message);
    } else {
      console.log('[mp-webhook] Notification sent successfully');
    }

    // Sempre retornar 200 OK para MP não retentar
    return new Response(JSON.stringify({ success: true, payment_id: paymentId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[mp-webhook] Error:', error);
    // Sempre retornar 200 para MP não retentar
    return new Response(JSON.stringify({ success: true, error: 'Internal error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
