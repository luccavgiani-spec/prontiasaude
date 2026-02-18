// Supabase Edge Function: mp-create-subscription
// Cria assinaturas recorrentes no Mercado Pago usando a API de Subscriptions (preapproval)
// ✅ VERSÃO AUTO-CONTIDA - CORS inline (sem import externo)

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
// Isso evita o problema de split-brain onde a função roda em um projeto diferente
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
  status: 'authorized' | 'pending' | 'rejected' | 'cancelled';
  subscription_id?: string;
  mp_subscription_id?: string;
  plan_expires_at?: string;
  next_payment_date?: string;
  error?: string;
  error_message?: string;
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
  // SKUs de plano seguem padrão: IND_COM_ESP_1M, FAM_SEM_ESP_6M, etc
  if (sku.startsWith('IND_COM')) return 'INDIVIDUAL_COM_ESPECIALISTA';
  if (sku.startsWith('IND_SEM')) return 'INDIVIDUAL_SEM_ESPECIALISTA';
  if (sku.startsWith('FAM_COM')) return 'FAMILIAR_COM_ESPECIALISTA';
  if (sku.startsWith('FAM_SEM')) return 'FAMILIAR_SEM_ESPECIALISTA';
  return sku;
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
    // Documentação: https://www.mercadopago.com.br/developers/pt/reference/subscriptions/_preapproval/post
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
      status: 'authorized' // Iniciar como autorizada (cobrança imediata)
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
        // ✅ ADICIONADO: Header de sessão para análise antifraude
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

    // Calcular datas
    const planExpiresAt = calculatePlanExpiry(frequency, frequencyType as 'months' | 'days');
    const nextPaymentDate = mpData.next_payment_date ? new Date(mpData.next_payment_date) : planExpiresAt;

    // Buscar user_id pelo email
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('email', request.payer_email)
      .maybeSingle();

    const userId = patient?.id || null;
    const planCode = extractPlanCode(request.plan_sku);

    // Salvar na tabela patient_subscriptions
    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('patient_subscriptions')
      .insert({
        user_id: userId,
        email: request.payer_email,
        mp_subscription_id: mpData.id,
        mp_status: mpData.status,
        plan_code: planCode,
        amount_cents: request.amount_cents,
        frequency: frequency,
        frequency_type: frequencyType,
        next_payment_date: nextPaymentDate.toISOString(),
        last_payment_date: new Date().toISOString()
      })
      .select()
      .single();

    if (subscriptionError) {
      console.error('[mp-create-subscription] Erro ao salvar subscription:', subscriptionError);
      // Não falhar - a subscription foi criada no MP
    }

    // Criar/atualizar patient_plans com a subscription vinculada
    const { data: existingPlan } = await supabaseAdmin
      .from('patient_plans')
      .select('id')
      .eq('email', request.payer_email)
      .eq('status', 'active')
      .maybeSingle();

    if (existingPlan) {
      // Atualizar plano existente
      await supabaseAdmin
        .from('patient_plans')
        .update({
          plan_code: planCode,
          plan_expires_at: planExpiresAt.toISOString(),
          subscription_id: subscription?.id,
          is_recurring: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPlan.id);
    } else {
      // Criar novo plano
      await supabaseAdmin
        .from('patient_plans')
        .insert({
          user_id: userId,
          email: request.payer_email,
          plan_code: planCode,
          plan_expires_at: planExpiresAt.toISOString(),
          status: 'active',
          subscription_id: subscription?.id,
          is_recurring: true
        });
    }

    // Registrar métrica
    await supabaseAdmin.from('metrics').insert({
      metric_type: 'subscription_created',
      patient_email: request.payer_email,
      plan_code: planCode,
      amount_cents: request.amount_cents,
      status: mpData.status,
      metadata: {
        mp_subscription_id: mpData.id,
        order_id: request.order_id,
        frequency: frequency,
        frequency_type: frequencyType,
        is_recurring: true
      }
    });

    console.log('[mp-create-subscription] ✅ Subscription criada com sucesso:', {
      subscription_id: subscription?.id,
      mp_subscription_id: mpData.id,
      plan_code: planCode,
      plan_expires_at: planExpiresAt.toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      status: mpData.status as 'authorized' | 'pending',
      subscription_id: subscription?.id,
      mp_subscription_id: mpData.id,
      plan_expires_at: planExpiresAt.toISOString(),
      next_payment_date: nextPaymentDate.toISOString()
    } as SubscriptionResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[mp-create-subscription] Erro:', error);
    
    // ✅ CORS: Obter origin da requisição para resposta de erro
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
