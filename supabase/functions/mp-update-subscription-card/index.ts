// Supabase Edge Function: mp-update-subscription-card
// Atualiza o cartão de uma assinatura recorrente no Mercado Pago

import { getCorsHeaders } from '../common/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = getCorsHeaders();

interface UpdateCardRequest {
  subscription_id: string;
  card_token: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) throw new Error('MP_ACCESS_TOKEN not configured');

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

    const { subscription_id, card_token }: UpdateCardRequest = await req.json();

    if (!card_token) {
      return new Response(JSON.stringify({ error: 'Token do cartão é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

    console.log('[mp-update-subscription-card] Atualizando cartão:', {
      subscription_id,
      mp_subscription_id: subscription.mp_subscription_id
    });

    const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${subscription.mp_subscription_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ card_token_id: card_token })
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[mp-update-subscription-card] Erro MP:', mpData);
      throw new Error(mpData.message || 'Erro ao atualizar cartão no Mercado Pago');
    }

    await supabaseAdmin
      .from('patient_subscriptions')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription_id);

    await supabaseAdmin.from('metrics').insert({
      metric_type: 'subscription_card_updated',
      patient_email: subscription.email,
      plan_code: subscription.plan_code,
      status: 'updated',
      metadata: {
        subscription_id,
        mp_subscription_id: subscription.mp_subscription_id,
        updated_at: new Date().toISOString()
      }
    });

    console.log('[mp-update-subscription-card] ✅ Cartão atualizado com sucesso');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Cartão atualizado com sucesso!'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[mp-update-subscription-card] Erro:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
