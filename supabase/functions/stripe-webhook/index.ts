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

// Google Sheets Auth
async function createJWT(): Promise<string> {
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
  if (!serviceAccountJson) throw new Error("GOOGLE_SERVICE_ACCOUNT not set");
  
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const message = `${headerB64}.${payloadB64}`;
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    new TextEncoder().encode(serviceAccount.private_key.replace(/\\n/g, '\n')),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(message)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${message}.${signatureB64}`;
}

async function getAccessToken(): Promise<string> {
  const jwt = await createJWT();
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

async function updateGoogleSheet(accessToken: string, range: string, values: any[]): Promise<void> {
  const spreadsheetId = Deno.env.get("SPREADSHEET_ID");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [values] })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update Google Sheet: ${response.status} ${await response.text()}`);
  }
}

async function appendToGoogleSheet(accessToken: string, range: string, values: any[]): Promise<void> {
  const spreadsheetId = Deno.env.get("SPREADSHEET_ID");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [values] })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to append to Google Sheet: ${response.status} ${await response.text()}`);
  }
}

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
  } catch (error) {
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
  } catch (error) {
    logStep('Exception upserting patient', { error: error.message, email });
  }
}

// Buscar linha no Google Sheets por chave
async function findSheetRowByKey(
  accessToken: string, 
  sheetName: string, 
  keyColumn: number, 
  keyValue: string
): Promise<number> {
  const range = `${sheetName}!A:Z`;
  const spreadsheetId = Deno.env.get("SPREADSHEET_ID");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  
  const response = await fetch(`${url}?majorDimension=ROWS`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (!response.ok) return -1;
  
  const data = await response.json();
  const rows = data.values || [];
  
  for (let i = 1; i < rows.length; i++) { // Skip header row
    if (rows[i][keyColumn] === keyValue) {
      return i + 1; // 1-based index
    }
  }
  
  return -1;
}

// Upsert na aba "Controle Geral Kommo" usando telefone como chave
async function upsertControleGeralKommo(
  accessToken: string,
  data: {
    nome?: string;
    sobrenome?: string;
    telefone: string;
    plano: string;
    alergias?: string;
    statusGestacao?: string;
    comorbidades?: string;
    medicamentosContinuos?: string;
    encaminhamento?: string;
  }
): Promise<void> {
  const sheetName = 'Controle Geral Kommo';
  
  // Cabeçalhos exatos: Nome | sobrenome | telefone | Plano | alergias | status gestação | comobidades | medicamentos continuos | encaminhamento
  const valores = [
    data.nome || '',                      // Nome
    data.sobrenome || '',                 // sobrenome
    data.telefone,                        // telefone
    data.plano,                           // Plano
    data.alergias || '',                  // alergias
    data.statusGestacao || '',            // status gestação
    data.comorbidades || '',              // comobidades
    data.medicamentosContinuos || '',     // medicamentos continuos
    data.encaminhamento || ''             // encaminhamento
  ];
  
  // Buscar linha existente por telefone (coluna 2, índice 2)
  const rowIndex = await findSheetRowByKey(accessToken, sheetName, 2, data.telefone);
  
  if (rowIndex > 0) {
    // Update existing - mas não sobrescrever encaminhamento se já estiver preenchido
    const currentRange = `${sheetName}!A${rowIndex}:I${rowIndex}`;
    const spreadsheetId = Deno.env.get("SPREADSHEET_ID");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${currentRange}`;
    
    const currentResponse = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (currentResponse.ok) {
      const currentData = await currentResponse.json();
      const currentRow = currentData.values?.[0] || [];
      
      // Se já tem encaminhamento e não estamos setando um novo, preservar o atual
      if (currentRow[8] && !data.encaminhamento) {
        valores[8] = currentRow[8];
      }
    }
    
    await updateGoogleSheet(accessToken, `${sheetName}!A${rowIndex}:I${rowIndex}`, valores);
    logStep('Updated Controle Geral Kommo', { telefone: data.telefone, rowIndex });
  } else {
    // Append new
    await appendToGoogleSheet(accessToken, `${sheetName}!A:I`, valores);
    logStep('Created new Controle Geral Kommo entry', { telefone: data.telefone });
  }
}

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
  } catch (error) {
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
  const patient = { status: 'inactive', plan_expires_at: null }; // Pagamento avulso sempre inactive
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
  
  // 7. Obter access token para Google Sheets
  const accessToken = await getAccessToken();
  
  // 8. Extrair nome e sobrenome se disponíveis
  const fullName = session.customer_details?.name || '';
  const nameParts = fullName.split(' ');
  const nome = nameParts[0] || '';
  const sobrenome = nameParts.slice(1).join(' ') || '';
  
  // 9. Upsert na aba "Controle Geral Kommo" usando telefone como chave
  await upsertControleGeralKommo(accessToken, {
    nome,
    sobrenome,
    telefone: phone_e164,
    plano: planActive ? 'ATIVO' : '', // 'ATIVO' quando isPlanActive === true, senão vazio
    alergias: clinicalData.allergies,
    statusGestacao: clinicalData.pregnancy_status,
    comorbidades: clinicalData.comorbidities,
    medicamentosContinuos: clinicalData.chronic_meds,
    encaminhamento: '' // Vazio por padrão, será setado para "Kommo" após push
  });
  
  // 10. Roteamento e push para Kommo (apenas se !isPlanActive)
  let kommoResult = { success: false, httpCode: 0, bodyExcerpt: '' };
  if (!planActive) {
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
    
    // Se POST para Kommo retornar 2xx, atualizar coluna encaminhamento para "Kommo"
    if (kommoResult.success && phone_e164) {
      await upsertControleGeralKommo(accessToken, {
        nome,
        sobrenome,
        telefone: phone_e164,
        plano: '',
        alergias: clinicalData.allergies,
        statusGestacao: clinicalData.pregnancy_status,
        comorbidades: clinicalData.comorbidities,
        medicamentosContinuos: clinicalData.chronic_meds,
        encaminhamento: 'Kommo'
      });
    }
  } else {
    logStep('Skipping Kommo - user has active plan', { email, planActive });
  }
  
  // 11. Registrar Orders
  const orderData = [
    session.id,                    // Order ID
    paymentIntentId,              // Payment Intent ID
    productSku,                   // SKU
    session.amount_total || 0,    // Amount
    'paid',                       // Status
    email,                        // Email
    new Date().toISOString(),     // Timestamp
    JSON.stringify({ session_id: session.id, payment_intent: paymentIntentId }) // Details
  ];
  
  await appendToGoogleSheet(accessToken, 'Orders!A:H', orderData);
  
  // 12. Log detalhado com campos solicitados
  const logData = [
    new Date().toISOString(),         // Timestamp
    'SUCCESS',                        // Status
    session.id,                       // Session ID
    email,                            // Email
    phone_e164,                       // Phone E164
    productSku,                       // Product SKU
    pipeline,                         // Pipeline
    planActive ? 'YES' : 'NO',        // Plan Active
    kommoResult.httpCode || 0,        // Kommo HTTP Code
    kommoResult.bodyExcerpt || '',    // Kommo Body Excerpt
    JSON.stringify({ 
      session_id: session.id, 
      payment_intent: paymentIntentId,
      clinical_data: clinicalData
    }) // Details
  ];
  
  await appendToGoogleSheet(accessToken, 'Logs!A:K', logData);
  
  // Marcar como processado para idempotência
  if (paymentIntentId) {
    processedPaymentIntents.add(paymentIntentId);
  }
  
  logStep('Payment processing completed successfully', { 
    email, 
    phone_e164, 
    product_sku: productSku, 
    pipeline, 
    planActive,
    kommo_http_code: kommoResult.httpCode 
  });
}

// Processar criação/atualização de assinatura
async function processSubscriptionChange(subscription: any): Promise<void> {
  logStep('Processing subscription change', { 
    subscriptionId: subscription.id, 
    status: subscription.status 
  });
  
  // Buscar customer details
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
  });
  
  const customer = await stripe.customers.retrieve(subscription.customer);
  const email = (customer as any).email;
  
  if (!email) {
    logStep('No email found for customer', { customerId: subscription.customer });
    return;
  }
  
  // Upsert paciente no Supabase com dados de assinatura
  const subscriptionData = {
    status: subscription.status,
    current_period_end: subscription.current_period_end
  };
  
  await upsertPatientInSupabase(email, '', true, subscriptionData);
  
  // Logs
  const accessToken = await getAccessToken();
  const logData = [
    new Date().toISOString(),
    'SUBSCRIPTION_CHANGE',
    subscription.id,
    email,
    '',
    '',
    'subscription',
    subscription.status === 'active' ? 'YES' : 'NO',
    0,
    '',
    JSON.stringify({ 
      subscription_id: subscription.id, 
      status: subscription.status,
      current_period_end: subscription.current_period_end
    })
  ];
  
  await appendToGoogleSheet(accessToken, 'Logs!A:K', logData);
  
  logStep('Subscription processing completed', { 
    email, 
    status: subscription.status 
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Webhook received', { method: req.method, url: req.url });
    
    const stripeSignature = req.headers.get('stripe-signature');
    if (!stripeSignature) {
      throw new Error('Missing stripe-signature header');
    }
    
    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });
    
    // Verificar assinatura do webhook
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, stripeSignature, webhookSecret);
      logStep('Webhook signature verified', { eventType: event.type });
    } catch (err) {
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
        
        // Log adicional para payment_intent
        const accessToken = await getAccessToken();
        const logData = [
          new Date().toISOString(),
          'PAYMENT_INTENT_SUCCEEDED',
          paymentIntent.id,
          paymentIntent.receipt_email || '',
          paymentIntent.amount,
          paymentIntent.status,
          JSON.stringify(paymentIntent.metadata || {}),
          JSON.stringify({ payment_intent_id: paymentIntent.id })
        ];
        
        await appendToGoogleSheet(accessToken, 'Logs!A:H', logData);
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
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('Webhook processing error', { error: errorMessage });
    
    // Log de erro no Google Sheets
    try {
      const accessToken = await getAccessToken();
      const logData = [
        new Date().toISOString(),
        'ERROR',
        'webhook-processing',
        '',
        errorMessage,
        '',
        '',
        JSON.stringify({ error: errorMessage, stack: error.stack })
      ];
      
      await appendToGoogleSheet(accessToken, 'Logs!A:H', logData);
    } catch (logError) {
      console.error('Failed to log error to sheets:', logError);
    }
    
    return new Response(`Webhook error: ${errorMessage}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});