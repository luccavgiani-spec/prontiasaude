import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Normalizar telefone para E.164 (assume BR se sem "+")
const normalizePhoneE164 = (raw?: string) => {
  const s = (raw || '').replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.startsWith('+')) return s;
  const n = s.replace(/^0+/, '');
  return n.length >= 10 ? `+55${n}` : '';
};

// Verificar se plano está ativo
const isPlanActive = (p?: { status?: string; plan_expires_at?: string | Date }) =>
  p?.status === 'active' && p?.plan_expires_at && new Date(p.plan_expires_at).getTime() > Date.now();

// Detectar SKU PSICO
const isPsicoSku = (sku?: string) => (sku || '').toLowerCase().match(/psico|psicolog|psiqui/);

// Processed payment intents para idempotência
const processedPaymentIntents = new Set<string>();

// Google Sheets integration removed

// Buscar dados clínicos do perfil no Supabase
async function getPatientData(email: string): Promise<{
  allergies?: string;
  pregnancy_status?: string;
  comorbidities?: string;
  chronic_meds?: string;
  status?: string;
  plan_expires_at?: string;
} | null> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    // Primeiro tentar buscar por email na tabela patients
    const { data, error } = await supabase
      .from('patients')
      .select('allergies, pregnancy_status, comorbidities, chronic_meds')
      .eq('email', email) // Assumindo campo email
      .maybeSingle();
      
    if (error) {
      logStep('Error fetching patient data', { error: error.message, email });
      return null;
    }
    
    return data;
  } catch (error: any) {
    logStep('Exception fetching patient data', { error: error.message, email });
    return null;
  }
}

// Upsert paciente no Supabase (pagamento avulso vs assinatura)
async function upsertPatientInSupabase(
  email: string, 
  phone_e164: string, 
  isSubscription: boolean = false,
  subscriptionData?: { status: string; current_period_end?: number }
): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    const updateData: any = {
      email,
      phone_e164,
      updated_at: new Date().toISOString()
    };
    
    if (isSubscription && subscriptionData?.status === 'active' && subscriptionData.current_period_end) {
      updateData.status = 'active';
      updateData.plan_expires_at = new Date(subscriptionData.current_period_end * 1000).toISOString();
    } else {
      updateData.status = 'inactive';
      // Não preencher plan_expires_at para pagamentos avulsos
    }
    
    const { error } = await supabase
      .from('patients')
      .upsert(updateData, { onConflict: 'email' });
      
    if (error) {
      logStep('Error upserting patient in Supabase', { error: error.message, email });
    } else {
      logStep('Patient upserted in Supabase', { email, status: updateData.status, isSubscription });
    }
  } catch (error: any) {
    logStep('Exception upserting patient', { error: error.message, email });
  }
}

// Google Sheets integration removed

// Enviar para Kommo com payload correto
async function sendToKommoNew(
  data: {
    name: string;
    phone: string;
    email: string;
    plano: string;
    alergias?: string;
    pregnancy_status?: string;
    comorbidades?: string;
    meds_continuous?: string;
  },
  pipeline: 'psico' | 'pronto'
): Promise<{ success: boolean; httpCode?: number; bodyExcerpt?: string }> {
  const webhookUrl = pipeline === 'psico' 
    ? Deno.env.get("KOMMO_WEBHOOK_PSICO") 
    : Deno.env.get("KOMMO_WEBHOOK_PRONTO");
    
  if (!webhookUrl) {
    logStep('Kommo webhook URL not configured', { pipeline });
    return { success: false };
  }
  
  const payload = {
    name: data.name,
    phone: data.phone,
    email: data.email,
    plano: data.plano,
    alergias: data.alergias || '',
    pregnancy_status: data.pregnancy_status || '',
    comorbidades: data.comorbidades || '',
    meds_continuous: data.meds_continuous || '',
    source: "Stripe→Edge→Sheets"
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    const bodyExcerpt = responseText.length > 100 ? responseText.substring(0, 100) + '...' : responseText;
    
    logStep('Kommo webhook response', { 
      pipeline, 
      httpCode: response.status, 
      success: response.ok,
      bodyExcerpt 
    });
    
    return { 
      success: response.ok, 
      httpCode: response.status, 
      bodyExcerpt 
    };
  } catch (error: any) {
    logStep('Kommo webhook error', { pipeline, error: error.message });
    return { success: false };
  }
}

// Processar pagamento aprovado - NOVA IMPLEMENTAÇÃO
async function processPaymentSuccess(session: any): Promise<void> {
  const paymentIntentId = session.payment_intent;
  
  // Idempotência - não reprocessar o mesmo payment_intent
  if (paymentIntentId && processedPaymentIntents.has(paymentIntentId)) {
    logStep('Payment already processed - skipping', { paymentIntentId });
    return;
  }
  
  logStep('Processing payment success', { sessionId: session.id, paymentIntentId });
  
  // 1. Obter telefone com prioridade correta e normalizar
  const rawPhone = session.customer_details?.phone || 
                  session.metadata?.phone_e164 || 
                  session.metadata?.phone || '';
  const phone_e164 = normalizePhoneE164(rawPhone);
  
  // 2. Extrair dados básicos
  const email = session.customer_details?.email || session.metadata?.email;
  const productSku = session.metadata?.product_sku || session.metadata?.service_code || '';
  
  if (!email) {
    throw new Error('Email not found in session');
  }
  
  logStep('Extracted session data', { 
    email, 
    phone_e164, 
    product_sku: productSku, 
    paymentIntentId 
  });
  
  // 3. Upsert paciente no Supabase (pagamento avulso - status sempre 'inactive')
  await upsertPatientInSupabase(email, phone_e164, false);
  
  // 4. Buscar dados clínicos do perfil no banco (com fallback para metadata)
  const patientData = await getPatientData(email);
  const clinicalData = {
    allergies: patientData?.allergies || session.metadata?.allergies || '',
    pregnancy_status: patientData?.pregnancy_status || session.metadata?.pregnancy_status || '',
    comorbidities: patientData?.comorbidities || session.metadata?.comorb || '',
    chronic_meds: patientData?.chronic_meds || session.metadata?.meds || ''
  };
  
  logStep('Clinical data gathered', clinicalData);
  
  // 5. Verificar se tem plano ativo usando helper correto
  const patient = { status: 'inactive', plan_expires_at: undefined }; // Pagamento avulso sempre inactive
  const planActive = isPlanActive(patient);
  
  // 6. Determinar pipeline
  const pipeline = isPsicoSku(productSku) ? 'psico' : 'pronto';
  
  logStep('Processing details', { 
    email, 
    phone_e164, 
    product_sku: productSku, 
    pipeline, 
    planActive 
  });
  
  // Google Sheets logging removed
  
  let kommoResult = { success: false, httpCode: 0, bodyExcerpt: '' };
  if (!planActive) {
    const fullName = session.customer_details?.name || '';
    const kommoData = {
      name: fullName || 'Nome Sobrenome',
      phone: phone_e164 || email, // Se não houver telefone, usar email
      email: email,
      plano: '',
      alergias: clinicalData.allergies,
      pregnancy_status: clinicalData.pregnancy_status,
      comorbidades: clinicalData.comorbidities,
      meds_continuous: clinicalData.chronic_meds
    };
    
    kommoResult = await sendToKommoNew(kommoData, pipeline);
    
    // Google Sheets logging removed
  } else {
    logStep('Skipping Kommo - user has active plan', { email, planActive });
  }
  
  // Google Sheets logging removed
  
  // Marcar payment_intent como processado
  if (paymentIntentId) {
    processedPaymentIntents.add(paymentIntentId);
  }
  
  logStep('Payment processing completed', { 
    email,
    pipeline,
    planActive,
    kommoSuccess: kommoResult.success,
    kommoHttpCode: kommoResult.httpCode
  });
}

// Processar mudanças de assinatura
async function processSubscriptionChange(subscription: any): Promise<void> {
  logStep('Processing subscription change', { subscriptionId: subscription.id, status: subscription.status });
  
  // Obter customer associado
  const customer = subscription.customer;
  if (typeof customer !== 'string') {
    logStep('Customer data missing or invalid', { customerId: customer });
    return;
  }
  
  // Para subscription, precisamos buscar os dados do customer no Stripe
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
  });
  
  const customerData = await stripe.customers.retrieve(customer);
  if (!customerData || customerData.deleted) {
    logStep('Customer not found or deleted', { customerId: customer });
    return;
  }
  
  const email = customerData.email;
  const phone_e164 = normalizePhoneE164(customerData.phone);
  
  if (!email) {
    logStep('Customer email not found', { customerId: customer });
    return;
  }
  
  // Upsert paciente no Supabase com dados de assinatura
  await upsertPatientInSupabase(email, phone_e164, true, {
    status: subscription.status,
    current_period_end: subscription.current_period_end
  });
  
  // Google Sheets logging removed
  
  logStep('Subscription change processed', { 
    subscriptionId: subscription.id, 
    email, 
    status: subscription.status 
  });
}

// Formatador de moeda para logs
const formatCurrency = (amountCents: number): string => {
  return `R$ ${(amountCents / 100).toFixed(2)}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Webhook received');
    
    const body = await req.text();
    const stripeSignature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    if (!stripeSignature || !webhookSecret) {
      logStep('Missing webhook signature or secret');
      return new Response('Missing webhook signature or secret', { 
        status: 400,
        headers: corsHeaders 
      });
    }
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });
    
    // Verificar assinatura do webhook
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, stripeSignature, webhookSecret);
      logStep('Webhook signature verified', { eventType: event.type });
    } catch (err: any) {
      logStep('Webhook signature verification failed', { error: err.message });
      return new Response('Webhook signature verification failed', { 
        status: 400,
        headers: corsHeaders 
      });
    }
    
    // Processar eventos
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep('Processing checkout.session.completed', { sessionId: session.id });
        
        if (session.payment_status === 'paid') {
          await processPaymentSuccess(session);
        } else {
          logStep('Payment not completed', { paymentStatus: session.payment_status });
        }
        break;
      }
      
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep('Processing payment_intent.succeeded', { paymentIntentId: paymentIntent.id });
        
        // Google Sheets logging removed
        break;
      }
      
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep('Processing customer.subscription.created', { subscriptionId: subscription.id });
        await processSubscriptionChange(subscription);
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep('Processing customer.subscription.updated', { subscriptionId: subscription.id });
        await processSubscriptionChange(subscription);
        break;
      }
      
      default:
        logStep('Unhandled webhook event', { eventType: event.type });
    }
    
    return new Response('Webhook processed successfully', {
      status: 200,
      headers: corsHeaders
    });
    
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('Webhook processing error', { error: errorMessage });
    
    // Google Sheets logging removed
    
    return new Response(`Webhook error: ${errorMessage}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});