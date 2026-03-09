// Supabase Edge Function: mp-create-subscription
// Cria assinaturas recorrentes no Mercado Pago usando a API de Subscriptions (preapproval)
// ✅ VERSÃO AUTO-CONTIDA - CORS inline (sem import externo)
// ✅ v2 - Verifica primeiro pagamento antes de ativar plano

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

// ============================================================
// ✅ CORS INLINE - Headers para permitir chamadas do frontend
// ============================================================
const ALLOWED_ORIGINS = [
  'https://prontiasaude.com.br',
  'https://www.prontiasaude.com.br',
  'https://prontiasaude.lovable.app',
  'http://localhost:5173',
];

function isLovablePreviewOrigin(origin: string): boolean {
  return /^https:\/\/id-preview--[a-f0-9-]+\.lovable\.app$/.test(origin);
}

function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin = requestOrigin || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || isLovablePreviewOrigin(origin);
  const allowedOrigin = isAllowed ? origin : '';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin || ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}
// ============================================================

// ✅ URL FIXA do projeto original - NÃO usar Deno.env.get('SUPABASE_URL')
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';

interface SubscriptionRequest {
  payer_email: string;
  payer_cpf: string;
  payer_name: string;
  payer_phone: string;
  card_token: string;
  payment_method_id: string;
  plan_sku: string;
  plan_name: string;
  amount_cents: number;
  frequency: number;
  frequency_type: 'months' | 'days';
  order_id: string;
  device_id?: string;
}

interface SubscriptionResponse {
  success: boolean;
  status: 'authorized' | 'pending' | 'rejected' | 'cancelled' | 'payment_pending';
  subscription_id?: string;
  mp_subscription_id?: string;
  plan_expires_at?: string;
  next_payment_date?: string;
  error?: string;
  error_message?: string;
  first_payment_status?: string;
}

/**
 * Calcula a data de expiração do plano baseado na frequência
 */
function calculatePlanExpiry(frequency: number, frequencyType: 'months' | 'days'): Date {
  const now = new Date();
  if (frequencyType === 'months') {
    now.setMonth(now.getMonth() + frequency);
  } else {
    now.setDate(now.getDate() + frequency);
  }
  return now;
}

/**
 * Mapeia SKU para plan_code interno
 */
function extractPlanCode(sku: string): string {
  if (sku.startsWith('IND_COM')) return 'INDIVIDUAL_COM_ESPECIALISTA';
  if (sku.startsWith('IND_SEM')) return 'INDIVIDUAL_SEM_ESPECIALISTA';
  if (sku.startsWith('FAM_COM')) return 'FAMILIAR_COM_ESPECIALISTA';
  if (sku.startsWith('FAM_SEM')) return 'FAMILIAR_SEM_ESPECIALISTA';
  return sku;
}

/**
 * Aguarda um tempo em ms
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ✅ NOVO: Verifica o status do primeiro pagamento da subscription
 * Tenta até 3 vezes com intervalo de 2s para dar tempo do MP processar
 */
async function verifyFirstPayment(
  subscriptionId: string,
  accessToken: string
): Promise<{ paid: boolean; status: string; detail: string }> {
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`[mp-create-subscription] Verificando primeiro pagamento (tentativa ${attempt}/3)...`);
    
    // Buscar pagamentos autorizados da subscription
    const paymentsResponse = await fetch(
      `https://api.mercadopago.com/authorized_payments/search?preapproval_id=${subscriptionId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (paymentsResponse.ok) {
      const paymentsData = await paymentsResponse.json();
      const results = paymentsData.results || [];
      
      console.log(`[mp-create-subscription] Pagamentos encontrados: ${results.length}`, 
        results.map((p: any) => ({ id: p.id, status: p.status, status_detail: p.status_detail }))
      );

      if (results.length > 0) {
        const firstPayment = results[0];
        
        if (firstPayment.status === 'approved') {
          return { paid: true, status: 'approved', detail: firstPayment.status_detail || '' };
        }
        
        if (firstPayment.status === 'rejected') {
          return { 
            paid: false, 
            status: 'rejected', 
            detail: firstPayment.status_detail || 'cc_rejected_other_reason' 
          };
        }
        
        // Se está em processamento, continuar tentando
        if (firstPayment.status === 'in_process' || firstPayment.status === 'pending') {
          if (attempt < 3) {
            await sleep(2000);
            continue;
          }
          return { paid: false, status: firstPayment.status, detail: firstPayment.status_detail || '' };
        }
      }
    } else {
      console.warn(`[mp-create-subscription] Erro ao buscar pagamentos: ${paymentsResponse.status}`);
    }

    // Fallback: verificar via summarized da subscription
    const subResponse = await fetch(
      `https://api.mercadopago.com/preapproval/${subscriptionId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (subResponse.ok) {
      const subData = await subResponse.json();
      const charged = subData.summarized?.charged_quantity || 0;
      const pending = subData.summarized?.pending_charge_quantity || 0;
      
      console.log(`[mp-create-subscription] Summarized - charged: ${charged}, pending: ${pending}`);
      
      if (charged > 0) {
        return { paid: true, status: 'approved', detail: '' };
      }
      
      if (pending > 0 && attempt < 3) {
        await sleep(2000);
        continue;
      }
    }

    if (attempt < 3) {
      await sleep(2000);
    }
  }

  // Após 3 tentativas, considerar como pendente (não ativar plano ainda)
  return { paid: false, status: 'pending', detail: 'payment_not_confirmed_after_retries' };
}

Deno.serve(async (req) => {
  // ✅ CORS: Obter origin da requisição
  const requestOrigin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(requestOrigin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    
    if (!MP_ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN not configured');
    }

    const request: SubscriptionRequest = await req.json();
    
    console.log('[mp-create-subscription] Recebido:', {
      payer_email: request.payer_email,
      plan_sku: request.plan_sku,
      amount_cents: request.amount_cents,
      frequency: request.frequency,
      frequency_type: request.frequency_type
    });

    // Validações básicas
    if (!request.payer_email || !request.card_token || !request.plan_sku) {
      throw new Error('Campos obrigatórios ausentes: payer_email, card_token, plan_sku');
    }

    // ✅ CORRIGIDO: Usar URL e KEY fixa do projeto original para evitar split-brain
    const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(
      ORIGINAL_SUPABASE_URL,
      ORIGINAL_SERVICE_ROLE_KEY
    );

    // Buscar preço do plano no banco para validação
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('price_cents, name, allows_recurring, recurring_frequency, recurring_frequency_type')
      .eq('sku', request.plan_sku)
      .eq('active', true)
      .maybeSingle();

    if (serviceError || !service) {
      console.error('[mp-create-subscription] SKU não encontrado:', request.plan_sku);
      throw new Error(`Plano ${request.plan_sku} não encontrado ou inativo`);
    }

    // Validar se é um serviço recorrente
    if (!service.allows_recurring) {
      console.error('[mp-create-subscription] SKU não permite recorrência:', request.plan_sku);
      throw new Error(`O serviço ${request.plan_sku} não suporta assinatura recorrente`);
    }

    const transactionAmount = request.amount_cents / 100;
    const frequency = request.frequency || service.recurring_frequency || 1;
    const frequencyType = request.frequency_type || service.recurring_frequency_type || 'months';

    // Criar subscription no Mercado Pago via API de Preapproval
    const subscriptionPayload = {
      reason: request.plan_name || service.name,
      external_reference: request.order_id,
      payer_email: request.payer_email,
      card_token_id: request.card_token,
      auto_recurring: {
        frequency: frequency,
        frequency_type: frequencyType,
        transaction_amount: transactionAmount,
        currency_id: 'BRL'
      },
      back_url: 'https://prontiasaude.com.br/area-do-paciente',
      status: 'authorized'
    };

    console.log('[mp-create-subscription] Criando subscription no MP:', {
      reason: subscriptionPayload.reason,
      external_reference: subscriptionPayload.external_reference,
      auto_recurring: subscriptionPayload.auto_recurring
    });

    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': request.order_id,
        'X-meli-session-id': request.device_id || ''
      },
      body: JSON.stringify(subscriptionPayload)
    });

    const mpData = await mpResponse.json();

    console.log('[mp-create-subscription] Resposta do MP:', {
      status: mpResponse.status,
      id: mpData.id,
      status_subscription: mpData.status,
      reason: mpData.reason
    });

    if (!mpResponse.ok || mpData.status === 'rejected' || mpData.status === 'cancelled') {
      console.error('[mp-create-subscription] Erro na criação:', mpData);
      
      return new Response(JSON.stringify({
        success: false,
        status: mpData.status || 'rejected',
        error: mpData.message || 'Falha ao criar assinatura',
        error_message: mpData.cause?.[0]?.description || 'Verifique os dados do cartão e tente novamente'
      } as SubscriptionResponse), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ✅ NOVO: Verificar se o primeiro pagamento foi realmente processado
    console.log('[mp-create-subscription] Subscription criada, verificando primeiro pagamento...');
    
    const paymentVerification = await verifyFirstPayment(mpData.id, MP_ACCESS_TOKEN);
    
    console.log('[mp-create-subscription] Resultado da verificação do primeiro pagamento:', paymentVerification);

    // Se o primeiro pagamento foi REJEITADO, cancelar a subscription e retornar erro
    if (paymentVerification.status === 'rejected') {
      console.error('[mp-create-subscription] ❌ Primeiro pagamento REJEITADO! Cancelando subscription...');
      
      // Tentar cancelar a subscription no MP
      try {
        await fetch(`https://api.mercadopago.com/preapproval/${mpData.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'cancelled' })
        });
        console.log('[mp-create-subscription] Subscription cancelada no MP');
      } catch (cancelErr) {
        console.warn('[mp-create-subscription] Falha ao cancelar subscription:', cancelErr);
      }

      // Registrar métrica de falha
      await supabaseAdmin.from('metrics').insert({
        metric_type: 'sale',
        plan_code: request.plan_sku,
        amount_cents: request.amount_cents,
        patient_email: request.payer_email,
        status: 'rejected',
        metadata: {
          mp_subscription_id: mpData.id,
          order_id: request.order_id,
          payer_email: request.payer_email,
          payment_status: paymentVerification.status,
          payment_detail: paymentVerification.detail,
          source: 'mp-create-subscription',
          is_recurring: true
        }
      });

      return new Response(JSON.stringify({
        success: false,
        status: 'rejected',
        first_payment_status: paymentVerification.status,
        error: 'first_payment_rejected',
        error_message: 'O pagamento foi recusado pelo banco. Verifique o limite do cartão ou tente com outro cartão.'
      } as SubscriptionResponse), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Se o pagamento ainda está pendente/em processamento, salvar mas NÃO ativar plano
    const isPaymentConfirmed = paymentVerification.paid;
    const planStatus = isPaymentConfirmed ? 'active' : 'pending_payment';
    
    console.log(`[mp-create-subscription] Status do plano: ${planStatus} (pagamento confirmado: ${isPaymentConfirmed})`);

    // Calcular datas
    const planExpiresAt = calculatePlanExpiry(frequency, frequencyType as 'months' | 'days');
    const nextPaymentDate = mpData.next_payment_date ? new Date(mpData.next_payment_date) : planExpiresAt;

    // Buscar user_id pelo email - usar patients.user_id (FK para auth.users), NÃO patients.id
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id, user_id')
      .eq('email', request.payer_email)
      .maybeSingle();

    const userId = patient?.user_id || null;
    const planCode = extractPlanCode(request.plan_sku);

    // Salvar na tabela patient_subscriptions
    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('patient_subscriptions')
      .insert({
        user_id: userId,
        email: request.payer_email,
        mp_subscription_id: mpData.id,
        mp_status: isPaymentConfirmed ? 'authorized' : 'pending_first_payment',
        plan_code: planCode,
        amount_cents: request.amount_cents,
        frequency: frequency,
        frequency_type: frequencyType,
        next_payment_date: nextPaymentDate.toISOString(),
        last_payment_date: isPaymentConfirmed ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (subscriptionError) {
      console.error('[mp-create-subscription] Erro ao salvar subscription:', subscriptionError);
    }

    // Criar/atualizar patient_plans - ativar se confirmado, ou criar como pending_payment
    const { data: existingPlan } = await supabaseAdmin
      .from('patient_plans')
      .select('id, status')
      .eq('email', request.payer_email)
      .in('status', ['active', 'pending_payment'])
      .maybeSingle();

    if (existingPlan) {
      // Atualizar plano existente (active ou pending_payment)
      const updateData: Record<string, any> = {
        plan_code: planCode,
        plan_expires_at: planExpiresAt.toISOString(),
        subscription_id: subscription?.id,
        is_recurring: true,
        updated_at: new Date().toISOString()
      };
      if (isPaymentConfirmed) {
        updateData.status = 'active';
      }
      await supabaseAdmin
        .from('patient_plans')
        .update(updateData)
        .eq('id', existingPlan.id);
      console.log(`[mp-create-subscription] Plano ${existingPlan.id} atualizado (status: ${isPaymentConfirmed ? 'active' : existingPlan.status})`);
    } else {
      // Criar plano novo - active se confirmado, pending_payment se pendente
      const { error: planInsertErr } = await supabaseAdmin
        .from('patient_plans')
        .insert({
          user_id: userId,
          email: request.payer_email,
          plan_code: planCode,
          plan_expires_at: planExpiresAt.toISOString(),
          status: isPaymentConfirmed ? 'active' : 'pending_payment',
          subscription_id: subscription?.id,
          is_recurring: true
        });
      if (planInsertErr) {
        console.error('[mp-create-subscription] Erro ao criar patient_plan:', planInsertErr);
      } else {
        console.log(`[mp-create-subscription] Plano criado com status: ${isPaymentConfirmed ? 'active' : 'pending_payment'}`);
      }
    }

    // Registrar métrica
    await supabaseAdmin.from('metrics').insert({
      metric_type: 'sale',
      plan_code: request.plan_sku,
      amount_cents: request.amount_cents,
      patient_email: request.payer_email,
      status: isPaymentConfirmed ? 'approved' : 'pending',
      metadata: {
        mp_subscription_id: mpData.id,
        order_id: request.order_id,
        payer_email: request.payer_email,
        frequency: frequency,
        frequency_type: frequencyType,
        is_recurring: true,
        first_payment_status: paymentVerification.status,
        plan_activated: isPaymentConfirmed,
        source: 'mp-create-subscription'
      }
    });

    console.log('[mp-create-subscription] ✅ Subscription processada:', {
      subscription_id: subscription?.id,
      mp_subscription_id: mpData.id,
      plan_code: planCode,
      plan_activated: isPaymentConfirmed,
      first_payment: paymentVerification.status
    });

    // Se pagamento pendente, retornar status diferente pro frontend
    if (!isPaymentConfirmed) {
      return new Response(JSON.stringify({
        success: false,
        status: 'payment_pending' as any,
        subscription_id: subscription?.id,
        mp_subscription_id: mpData.id,
        first_payment_status: paymentVerification.status,
        error: 'payment_processing',
        error_message: 'O pagamento ainda está sendo processado pelo banco. Aguarde alguns minutos e verifique na sua área do paciente.'
      } as SubscriptionResponse), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      status: 'authorized',
      subscription_id: subscription?.id,
      mp_subscription_id: mpData.id,
      plan_expires_at: planExpiresAt.toISOString(),
      next_payment_date: nextPaymentDate.toISOString(),
      first_payment_status: 'approved'
    } as SubscriptionResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[mp-create-subscription] Erro:', error);
    
    const requestOrigin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(requestOrigin);
    
    return new Response(JSON.stringify({
      success: false,
      status: 'rejected',
      error: error.message,
      error_message: 'Erro interno ao criar assinatura. Tente novamente.'
    } as SubscriptionResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
