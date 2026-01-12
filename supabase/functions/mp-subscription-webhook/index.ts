// Supabase Edge Function: mp-subscription-webhook
// Processa webhooks do Mercado Pago relacionados a subscriptions (assinaturas recorrentes)

import { getCorsHeaders } from '../common/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = getCorsHeaders();

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

/**
 * Adiciona meses a uma data
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Adiciona dias a uma data
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Aceitar apenas POST
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar detalhes da subscription no Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${payload.data.id}`, {
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
      }
    });

    if (!mpResponse.ok) {
      console.error('[mp-subscription-webhook] Erro ao buscar subscription:', mpResponse.status);
      throw new Error(`Falha ao buscar subscription: ${mpResponse.status}`);
    }

    const subscriptionData = await mpResponse.json();

    console.log('[mp-subscription-webhook] Dados da subscription:', {
      id: subscriptionData.id,
      status: subscriptionData.status,
      payer_email: subscriptionData.payer_email,
      next_payment_date: subscriptionData.next_payment_date,
      auto_recurring: subscriptionData.auto_recurring
    });

    // Buscar subscription no banco pelo mp_subscription_id
    const { data: dbSubscription, error: fetchError } = await supabaseAdmin
      .from('patient_subscriptions')
      .select('*, patient_plans!patient_plans_subscription_id_fkey(*)')
      .eq('mp_subscription_id', String(subscriptionData.id))
      .maybeSingle();

    if (fetchError) {
      console.error('[mp-subscription-webhook] Erro ao buscar subscription no DB:', fetchError);
    }

    // Mapear ação do webhook
    const action = payload.action;

    switch (action) {
      case 'updated':
      case 'created': {
        // Atualizar status da subscription
        if (dbSubscription) {
          await supabaseAdmin
            .from('patient_subscriptions')
            .update({
              mp_status: subscriptionData.status,
              next_payment_date: subscriptionData.next_payment_date,
              updated_at: new Date().toISOString()
            })
            .eq('id', dbSubscription.id);

          console.log('[mp-subscription-webhook] ✅ Subscription atualizada:', {
            id: dbSubscription.id,
            new_status: subscriptionData.status
          });
        } else {
          console.warn('[mp-subscription-webhook] Subscription não encontrada no DB:', subscriptionData.id);
        }
        break;
      }

      case 'payment.created': {
        // Pagamento recorrente CRIADO - aguardar aprovação
        console.log('[mp-subscription-webhook] Pagamento recorrente criado, aguardando aprovação...');
        break;
      }

      case 'payment': {
        // Pagamento recorrente processado - verificar se foi aprovado
        // Buscar detalhes do pagamento
        if (payload.type === 'subscription_authorized_payment') {
          console.log('[mp-subscription-webhook] 🎉 Pagamento recorrente APROVADO!');
          
          if (dbSubscription) {
            const frequency = subscriptionData.auto_recurring?.frequency || dbSubscription.frequency || 1;
            const frequencyType = subscriptionData.auto_recurring?.frequency_type || dbSubscription.frequency_type || 'months';

            // Calcular nova data de expiração
            const currentExpiry = dbSubscription.patient_plans?.[0]?.plan_expires_at 
              ? new Date(dbSubscription.patient_plans[0].plan_expires_at)
              : new Date();
            
            const newExpiry = frequencyType === 'months' 
              ? addMonths(currentExpiry, frequency)
              : addDays(currentExpiry, frequency);

            // Atualizar patient_subscriptions
            await supabaseAdmin
              .from('patient_subscriptions')
              .update({
                mp_status: 'authorized',
                last_payment_date: new Date().toISOString(),
                next_payment_date: subscriptionData.next_payment_date || newExpiry.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', dbSubscription.id);

            // Atualizar patient_plans com nova data de expiração
            if (dbSubscription.patient_plans?.[0]) {
              await supabaseAdmin
                .from('patient_plans')
                .update({
                  plan_expires_at: newExpiry.toISOString(),
                  status: 'active',
                  updated_at: new Date().toISOString()
                })
                .eq('id', dbSubscription.patient_plans[0].id);

              console.log('[mp-subscription-webhook] ✅ Plano RENOVADO:', {
                plan_id: dbSubscription.patient_plans[0].id,
                old_expiry: currentExpiry.toISOString(),
                new_expiry: newExpiry.toISOString()
              });
            }

            // Registrar métrica de renovação
            await supabaseAdmin.from('metrics').insert({
              metric_type: 'subscription_renewed',
              patient_email: dbSubscription.email,
              plan_code: dbSubscription.plan_code,
              amount_cents: dbSubscription.amount_cents,
              status: 'approved',
              metadata: {
                mp_subscription_id: subscriptionData.id,
                old_expiry: currentExpiry.toISOString(),
                new_expiry: newExpiry.toISOString(),
                frequency: frequency,
                frequency_type: frequencyType
              }
            });
          }
        }
        break;
      }

      case 'cancelled': {
        // Subscription cancelada
        console.log('[mp-subscription-webhook] ⛔ Subscription CANCELADA');
        
        if (dbSubscription) {
          await supabaseAdmin
            .from('patient_subscriptions')
            .update({
              mp_status: 'cancelled',
              updated_at: new Date().toISOString()
            })
            .eq('id', dbSubscription.id);

          // Marcar plano como não-recorrente (mas não cancelar imediatamente - expira normalmente)
          if (dbSubscription.patient_plans?.[0]) {
            await supabaseAdmin
              .from('patient_plans')
              .update({
                is_recurring: false,
                updated_at: new Date().toISOString()
              })
              .eq('id', dbSubscription.patient_plans[0].id);
          }

          // Registrar métrica
          await supabaseAdmin.from('metrics').insert({
            metric_type: 'subscription_cancelled',
            patient_email: dbSubscription.email,
            plan_code: dbSubscription.plan_code,
            status: 'cancelled',
            metadata: {
              mp_subscription_id: subscriptionData.id,
              cancelled_at: new Date().toISOString()
            }
          });
        }
        break;
      }

      case 'paused': {
        // Subscription pausada
        console.log('[mp-subscription-webhook] ⏸️ Subscription PAUSADA');
        
        if (dbSubscription) {
          await supabaseAdmin
            .from('patient_subscriptions')
            .update({
              mp_status: 'paused',
              updated_at: new Date().toISOString()
            })
            .eq('id', dbSubscription.id);

          // Registrar métrica
          await supabaseAdmin.from('metrics').insert({
            metric_type: 'subscription_paused',
            patient_email: dbSubscription.email,
            plan_code: dbSubscription.plan_code,
            status: 'paused',
            metadata: {
              mp_subscription_id: subscriptionData.id,
              paused_at: new Date().toISOString()
            }
          });
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

  } catch (error) {
    console.error('[mp-subscription-webhook] Erro:', error);
    
    // Retornar 200 para não reprocessar (MP reenvia em caso de erro)
    return new Response(JSON.stringify({ 
      received: true, 
      error: error.message 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
