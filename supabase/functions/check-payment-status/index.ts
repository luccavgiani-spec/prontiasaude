import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id, email, order_id } = await req.json();
    
    console.log('[check-payment-status] Verificando pagamento:', payment_id);

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN não configurado');
    }

    // Consultar API do Mercado Pago
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${payment_id}`,
      { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } }
    );

    if (!response.ok) {
      console.error('[check-payment-status] Erro ao buscar payment:', response.status);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Payment não encontrado' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payment = await response.json();
    console.log('[check-payment-status] Status do payment:', payment.status);

    // Se aprovado, processar criação de appointment
    if (payment.status === 'approved') {
      const schedulePayload = payment.metadata?.schedulePayload || payment.metadata?.schedule_payload;
      
      if (!schedulePayload) {
        console.error('[check-payment-status] schedulePayload não encontrado no metadata');
        return new Response(JSON.stringify({ 
          success: false,
          status: payment.status,
          error: 'Dados de agendamento não encontrados'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!
      );

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // ✅ VERIFICAÇÃO DE DUPLICAÇÃO: Checar se já existe appointment com este order_id
      const orderIdToCheck = payment.metadata?.order_id || order_id;
      if (orderIdToCheck) {
        const { data: existingAppointment } = await supabaseAdmin
          .from('appointments')
          .select('appointment_id, redirect_url, provider')
          .eq('order_id', orderIdToCheck)
          .maybeSingle();
        
        if (existingAppointment) {
          console.log('[check-payment-status] ⚠️ Appointment já existe para order_id:', orderIdToCheck);
          console.log('[check-payment-status] Retornando dados existentes em vez de criar duplicado');
          return new Response(JSON.stringify({ 
            success: true,
            status: payment.status,
            approved: true,
            redirect_url: existingAppointment.redirect_url,
            appointment_id: existingAppointment.appointment_id,
            existing: true
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      console.log('[check-payment-status] 🎉 PIX aprovado! Criando appointment...');

      // Chamar schedule-redirect para criar appointment
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
          order_id: orderIdToCheck,
          payment_id: payment.id
        }
      });

      if (scheduleError) {
        console.error('[check-payment-status] Erro ao criar appointment:', scheduleError);
        return new Response(JSON.stringify({ 
          success: false,
          status: payment.status,
          error: 'Erro ao criar agendamento'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Gravar métrica de venda
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      await supabaseAdmin.from('metrics').insert({
        metric_type: 'sale',
        amount_cents: Math.round(payment.transaction_amount * 100),
        plan_code: schedulePayload.sku || 'UNKNOWN',
        platform: scheduleData?.provider || 'unknown',
        status: 'approved',
        patient_email: payment.payer?.email || schedulePayload.email,
        metadata: { 
          payment_id: payment.id, 
          mp_status: payment.status,
          order_id: payment.metadata?.order_id,
          source: 'manual_check'
        }
      });

      // Marcar pending_payment como processado
      if (order_id || payment.metadata?.order_id) {
        await supabaseAdmin
          .from('pending_payments')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('order_id', order_id || payment.metadata?.order_id);
      }

      console.log('[check-payment-status] ✅ Appointment criado:', scheduleData);

      return new Response(JSON.stringify({ 
        success: true,
        status: payment.status,
        approved: true,
        redirect_url: scheduleData?.url,
        appointment_id: scheduleData?.appointment_id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Se ainda pending ou outro status
    return new Response(JSON.stringify({ 
      success: true,
      status: payment.status,
      approved: false
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[check-payment-status] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
