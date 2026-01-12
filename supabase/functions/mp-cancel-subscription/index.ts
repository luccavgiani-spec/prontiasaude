// Supabase Edge Function: mp-cancel-subscription
// Cancela uma assinatura recorrente no Mercado Pago

import { getCorsHeaders } from '../common/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = getCorsHeaders();

interface CancelRequest {
  subscription_id: string; // ID interno da tabela patient_subscriptions
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) throw new Error('MP_ACCESS_TOKEN not configured');

    // Extrair JWT do header para validar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar usuário autenticado
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { subscription_id }: CancelRequest = await req.json();

    // Buscar subscription do usuário
    const { data: subscription, error: fetchError } = await supabaseAdmin
      .from('patient_subscriptions')
      .select('*')
      .eq('id', subscription_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !subscription) {
      return new Response(JSON.stringify({ error: 'Assinatura não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[mp-cancel-subscription] Cancelando subscription:', {
      subscription_id,
      mp_subscription_id: subscription.mp_subscription_id
    });

    // Cancelar no Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${subscription.mp_subscription_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'cancelled' })
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[mp-cancel-subscription] Erro MP:', mpData);
      throw new Error(mpData.message || 'Erro ao cancelar no Mercado Pago');
    }

    // Atualizar no banco
    await supabaseAdmin
      .from('patient_subscriptions')
      .update({
        mp_status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription_id);

    // Atualizar plano como não-recorrente
    await supabaseAdmin
      .from('patient_plans')
      .update({
        is_recurring: false,
        updated_at: new Date().toISOString()
      })
      .eq('subscription_id', subscription_id);

    // Registrar métrica
    await supabaseAdmin.from('metrics').insert({
      metric_type: 'subscription_cancelled_by_user',
      patient_email: subscription.email,
      plan_code: subscription.plan_code,
      status: 'cancelled',
      metadata: {
        subscription_id,
        mp_subscription_id: subscription.mp_subscription_id,
        cancelled_at: new Date().toISOString()
      }
    });

    console.log('[mp-cancel-subscription] ✅ Subscription cancelada com sucesso');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Assinatura cancelada. Seu plano permanece ativo até a data de expiração.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[mp-cancel-subscription] Erro:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
