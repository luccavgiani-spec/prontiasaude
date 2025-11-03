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
    
    console.log('[mp-webhook] ========================================');
    console.log('[mp-webhook] 📥 WEBHOOK RECEBIDO:', new Date().toISOString());
    console.log('[mp-webhook] Action:', body.action);
    console.log('[mp-webhook] Payment ID:', body.data?.id);
    console.log('[mp-webhook] Type:', body.type);
    console.log('[mp-webhook] ========================================');

    // Aceitar múltiplos formatos de action do Mercado Pago
    const action = (body.action || '').toLowerCase();
    const validActions = ['payment.updated', 'payment.created', 'updated', 'created'];

    if (!validActions.includes(action)) {
      console.log('[mp-webhook] Ignorando action não relacionada a pagamentos:', body.action);
      return new Response(JSON.stringify({ success: true, message: 'Action ignored' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[mp-webhook] ✅ Action aceita:', body.action);

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
    
    // Retry logic para race conditions
    let paymentRes;
    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries) {
      paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
      });

      if (paymentRes.ok) {
        console.log('[mp-webhook] ✅ Payment encontrado na tentativa', attempts + 1);
        break;
      }

      if (paymentRes.status === 404 && attempts < maxRetries - 1) {
        console.log(`[mp-webhook] Payment não encontrado, tentativa ${attempts + 1}/${maxRetries}, aguardando 3s...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempts++;
      } else {
        break;
      }
    }

    if (!paymentRes.ok) {
      const errorText = await paymentRes.text();
      console.error('[mp-webhook] Erro ao buscar payment após', attempts + 1, 'tentativas:', paymentRes.status, errorText);
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
      
      // Gravar métrica de tentativa PIX pending para tracking
      if (payment.status === 'pending' && payment.payment_type_id === 'pix') {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        await supabaseAdmin.from('metrics').insert({
          metric_type: 'payment_attempt',
          status: 'pending',
          amount_cents: Math.round(payment.transaction_amount * 100),
          plan_code: schedulePayload?.sku || 'UNKNOWN',
          patient_email: payment.payer?.email || schedulePayload?.email,
          metadata: { 
            payment_id: payment.id, 
            payment_type: 'pix',
            order_id: payment.metadata?.order_id 
          }
        });
        
        // Salvar em pending_payments para tracking manual
        await supabaseAdmin.from('pending_payments').insert({
          payment_id: payment.id,
          order_id: payment.metadata?.order_id,
          email: schedulePayload?.email || payment.payer?.email,
          status: 'pending',
          sku: schedulePayload?.sku,
          amount_cents: Math.round(payment.transaction_amount * 100)
        });
        
        console.log('[mp-webhook] ⏳ PIX pending registrado, aguardando aprovação');
      }
      
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

    // Chamar schedule-redirect diretamente
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    console.log('[mp-webhook] Calling schedule-redirect for payment:', payment.id);

    const { data: scheduleData, error: scheduleError } = await supabase.functions.invoke('schedule-redirect', {
      body: {
        cpf: schedulePayload.cpf,
        email: schedulePayload.email,
        nome: schedulePayload.nome,
        telefone: schedulePayload.telefone,
        especialidade: schedulePayload.especialidade || 'Clínico Geral',
        sku: schedulePayload.sku,
        horario_iso: schedulePayload.horario_iso || new Date().toISOString(),
        plano_ativo: schedulePayload.plano_ativo || false,
        order_id: payment.metadata?.order_id,
        payment_id: payment.id
      }
    });

    if (scheduleError) {
      console.error('[mp-webhook] Schedule-redirect error:', scheduleError.message);
    } else {
      console.log('[mp-webhook] Scheduled successfully:', scheduleData);
      
      if (scheduleData) {
        console.log('[mp-webhook] Appointment details:', {
          appointment_id: scheduleData.appointment_id,
          redirect_url: scheduleData.url,
          provider: scheduleData.provider
        });
      }
    }

    // ✅ Gravar métrica de venda
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabaseAdmin
      .from('metrics')
      .insert({
        metric_type: 'sale',
        amount_cents: Math.round(payment.transaction_amount * 100),
        plan_code: schedulePayload.sku || 'UNKNOWN',
        platform: scheduleData?.provider || 'unknown',
        status: 'approved',
        patient_email: payment.payer?.email || schedulePayload.email,
        metadata: { 
          payment_id: payment.id, 
          mp_status: payment.status,
          order_id: payment.metadata?.order_id
        }
      });

    console.log('[mp-webhook] ✅ Métrica de venda gravada');

    console.log('[mp-webhook] ========================================');
    console.log('[mp-webhook] ✅ PROCESSAMENTO CONCLUÍDO');
    console.log('[mp-webhook] Payment ID:', payment.id);
    console.log('[mp-webhook] Status:', payment.status);
    console.log('[mp-webhook] Email:', schedulePayload.email);
    console.log('[mp-webhook] SKU:', schedulePayload.sku);
    console.log('[mp-webhook] Appointment ID:', scheduleData?.appointment_id || 'N/A');
    console.log('[mp-webhook] ========================================');

    // ✅ Sincronizar com ClubeBen (fire-and-forget)
    if (schedulePayload.email || schedulePayload.cpf) {
      console.log('[mp-webhook] Iniciando sincronização ClubeBen');
      supabase.functions.invoke('clubeben-sync', {
        body: {
          user_email: schedulePayload.email,
          trigger_source: 'payment_approved'
        }
      }).catch(err => console.error('[mp-webhook] ClubeBen sync error (non-blocking):', err));
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
