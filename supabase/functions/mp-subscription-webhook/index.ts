// Supabase Edge Function: mp-subscription-webhook
// Processa webhooks do Mercado Pago relacionados a subscriptions (assinaturas recorrentes)
// ✅ v2 - Trata rejeição de pagamentos recorrentes e ativa planos pendentes

import { getCorsHeaders } from '../common/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = getCorsHeaders();

// ✅ URL FIXA do projeto original
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';

interface WebhookPayload {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: string;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    
    if (!MP_ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN not configured');
    }

    const payload: WebhookPayload = await req.json();
    
    console.log('[mp-subscription-webhook] Webhook recebido:', {
      type: payload.type,
      action: payload.action,
      data_id: payload.data?.id
    });

    // Ignorar eventos não relacionados a subscriptions
    const subscriptionEvents = [
      'subscription_preapproval',
      'subscription_authorized_payment',
      'subscription_preapproval_plan'
    ];

    if (!subscriptionEvents.includes(payload.type)) {
      console.log('[mp-subscription-webhook] Evento ignorado:', payload.type);
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(
      ORIGINAL_SUPABASE_URL,
      ORIGINAL_SERVICE_ROLE_KEY
    );

    // ✅ Tratar subscription_authorized_payment (pagamentos de subscription)
    if (payload.type === 'subscription_authorized_payment') {
      return await handleAuthorizedPayment(payload, MP_ACCESS_TOKEN, supabaseAdmin);
    }

    // Tratar subscription_preapproval (mudanças de status da subscription)
    if (payload.type === 'subscription_preapproval') {
      return await handlePreapproval(payload, MP_ACCESS_TOKEN, supabaseAdmin);
    }

    return new Response(JSON.stringify({ received: true, processed: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[mp-subscription-webhook] Erro:', error);
    return new Response(JSON.stringify({ received: true, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * ✅ NOVO: Trata eventos de pagamentos autorizados (aprovados ou rejeitados)
 */
async function handleAuthorizedPayment(
  payload: WebhookPayload,
  accessToken: string,
  supabaseAdmin: any
): Promise<Response> {
  const paymentId = payload.data.id;
  
  // Buscar detalhes do pagamento no MP
  const paymentResponse = await fetch(
    `https://api.mercadopago.com/authorized_payments/${paymentId}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!paymentResponse.ok) {
    console.error('[mp-subscription-webhook] Erro ao buscar pagamento:', paymentResponse.status);
    return new Response(JSON.stringify({ received: true, error: 'payment_fetch_failed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const paymentData = await paymentResponse.json();

  console.log('[mp-subscription-webhook] Pagamento de subscription:', {
    id: paymentData.id,
    status: paymentData.status,
    status_detail: paymentData.status_detail,
    preapproval_id: paymentData.preapproval_id,
    transaction_amount: paymentData.transaction_amount
  });

  const subscriptionMpId = paymentData.preapproval_id;
  if (!subscriptionMpId) {
    console.warn('[mp-subscription-webhook] Pagamento sem preapproval_id');
    return new Response(JSON.stringify({ received: true, no_preapproval: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Buscar subscription no banco (sem depender de FK para patient_plans)
  const { data: dbSubscription } = await supabaseAdmin
    .from('patient_subscriptions')
    .select('*')
    .eq('mp_subscription_id', String(subscriptionMpId))
    .maybeSingle();

  if (!dbSubscription) {
    console.warn('[mp-subscription-webhook] Subscription não encontrada no DB:', subscriptionMpId);
    return new Response(JSON.stringify({ received: true, subscription_not_found: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Buscar plano existente por email (não depender de FK subscription_id)
  const { data: existingPlan } = await supabaseAdmin
    .from('patient_plans')
    .select('id, plan_expires_at')
    .eq('email', dbSubscription.email)
    .eq('status', 'active')
    .maybeSingle();

  // ✅ PAGAMENTO APROVADO
  if (paymentData.status === 'approved') {
    console.log('[mp-subscription-webhook] 🎉 Pagamento APROVADO!');

    const frequency = dbSubscription.frequency || 1;
    const frequencyType = dbSubscription.frequency_type || 'months';

    const currentExpiry = existingPlan?.plan_expires_at
      ? new Date(existingPlan.plan_expires_at)
      : new Date();

    const newExpiry = frequencyType === 'months'
      ? addMonths(currentExpiry, frequency)
      : addDays(currentExpiry, frequency);

    // Atualizar subscription
    await supabaseAdmin
      .from('patient_subscriptions')
      .update({
        mp_status: 'authorized',
        last_payment_date: new Date().toISOString(),
        next_payment_date: newExpiry.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', dbSubscription.id);

    // Criar ou atualizar plano - sempre garantir que exista
    if (existingPlan) {
      await supabaseAdmin
        .from('patient_plans')
        .update({
          plan_code: dbSubscription.plan_code,
          plan_expires_at: newExpiry.toISOString(),
          subscription_id: dbSubscription.id,
          is_recurring: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPlan.id);

      console.log('[mp-subscription-webhook] ✅ Plano RENOVADO:', {
        plan_id: existingPlan.id,
        old_expiry: currentExpiry.toISOString(),
        new_expiry: newExpiry.toISOString()
      });
    } else {
      // Criar plano novo (primeiro pagamento ou plano não existia)
      console.log('[mp-subscription-webhook] ✅ Criando plano novo via webhook...');

      await supabaseAdmin
        .from('patient_plans')
        .insert({
          user_id: dbSubscription.user_id,
          email: dbSubscription.email,
          plan_code: dbSubscription.plan_code,
          plan_expires_at: newExpiry.toISOString(),
          status: 'active',
          subscription_id: dbSubscription.id,
          is_recurring: true
        });

      console.log('[mp-subscription-webhook] ✅ Plano CRIADO:', {
        email: dbSubscription.email,
        plan_code: dbSubscription.plan_code,
        new_expiry: newExpiry.toISOString()
      });
    }

    // Métrica de pagamento aprovado
    await supabaseAdmin.from('metrics').insert({
      metric_type: 'sale',
      plan_code: dbSubscription.plan_code,
      amount_cents: dbSubscription.amount_cents,
      patient_email: dbSubscription.email,
      status: 'approved',
      metadata: {
        mp_subscription_id: subscriptionMpId,
        payment_id: paymentData.id,
        source: 'subscription_webhook',
        was_first_payment: dbSubscription.mp_status === 'pending_first_payment',
        plan_expires_at: newExpiry.toISOString()
      }
    });
  }

  // ✅ PAGAMENTO REJEITADO
  if (paymentData.status === 'rejected') {
    console.log('[mp-subscription-webhook] ⛔ Pagamento REJEITADO:', paymentData.status_detail);

    await supabaseAdmin
      .from('patient_subscriptions')
      .update({
        mp_status: 'payment_rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', dbSubscription.id);

    // Se era o primeiro pagamento pendente, NÃO ativar o plano
    if (dbSubscription.mp_status === 'pending_first_payment') {
      console.log('[mp-subscription-webhook] ❌ Primeiro pagamento rejeitado. Plano NÃO será ativado.');
    }
  }

  return new Response(JSON.stringify({ 
    received: true, 
    processed: true,
    payment_status: paymentData.status
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Trata eventos de mudança de status da subscription (preapproval)
 */
async function handlePreapproval(
  payload: WebhookPayload,
  accessToken: string,
  supabaseAdmin: any
): Promise<Response> {
  // Buscar detalhes da subscription no MP
  const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${payload.data.id}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!mpResponse.ok) {
    console.error('[mp-subscription-webhook] Erro ao buscar subscription:', mpResponse.status);
    throw new Error(`Falha ao buscar subscription: ${mpResponse.status}`);
  }

  const subscriptionData = await mpResponse.json();

  console.log('[mp-subscription-webhook] Dados da subscription:', {
    id: subscriptionData.id,
    status: subscriptionData.status,
    payer_email: subscriptionData.payer_email
  });

  const { data: dbSubscription } = await supabaseAdmin
    .from('patient_subscriptions')
    .select('*')
    .eq('mp_subscription_id', String(subscriptionData.id))
    .maybeSingle();

  const action = payload.action;

  switch (action) {
    case 'updated':
    case 'created': {
      if (dbSubscription) {
        await supabaseAdmin
          .from('patient_subscriptions')
          .update({
            mp_status: subscriptionData.status,
            next_payment_date: subscriptionData.next_payment_date,
            updated_at: new Date().toISOString()
          })
          .eq('id', dbSubscription.id);
      }
      break;
    }

    case 'cancelled': {
      console.log('[mp-subscription-webhook] ⛔ Subscription CANCELADA');
      if (dbSubscription) {
        await supabaseAdmin
          .from('patient_subscriptions')
          .update({
            mp_status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', dbSubscription.id);

        // Buscar plano por email (não depender de FK)
        const { data: planToUpdate } = await supabaseAdmin
          .from('patient_plans')
          .select('id')
          .eq('email', dbSubscription.email)
          .eq('status', 'active')
          .maybeSingle();

        if (planToUpdate) {
          await supabaseAdmin
            .from('patient_plans')
            .update({
              is_recurring: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', planToUpdate.id);
        }
      }
      break;
    }

    case 'paused': {
      console.log('[mp-subscription-webhook] ⏸️ Subscription PAUSADA');
      if (dbSubscription) {
        await supabaseAdmin
          .from('patient_subscriptions')
          .update({
            mp_status: 'paused',
            updated_at: new Date().toISOString()
          })
          .eq('id', dbSubscription.id);
      }
      break;
    }

    default: {
      console.log('[mp-subscription-webhook] Ação não tratada:', action);
    }
  }

  return new Response(JSON.stringify({ 
    received: true, 
    processed: true,
    action: action,
    subscription_id: subscriptionData.id
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
