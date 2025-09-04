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

// Verificar se usuário tem plano ativo
async function hasActivePlan(email: string): Promise<boolean> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    const { data, error } = await supabase
      .from('patients')
      .select('plan_expires_at')
      .eq('id', email) // Assumindo que o email é usado como ID ou existe um campo email
      .single();
      
    if (error) {
      logStep('Error checking active plan', { error: error.message });
      return false;
    }
    
    if (data?.plan_expires_at) {
      const expirationDate = new Date(data.plan_expires_at);
      const now = new Date();
      return expirationDate > now;
    }
    
    return false;
  } catch (error) {
    logStep('Exception checking active plan', { error: error.message });
    return false;
  }
}

// Determinar funil baseado no SKU
function determineKommoFunnel(sku: string): 'PSICO' | 'PRONTO' {
  const lowerSku = sku.toLowerCase();
  if (lowerSku.includes('psico') || lowerSku.includes('psicologa') || lowerSku.includes('psiqui')) {
    return 'PSICO';
  }
  return 'PRONTO';
}

// Enviar para Kommo
async function sendToKommo(data: any, funnel: 'PSICO' | 'PRONTO'): Promise<void> {
  const webhookUrl = funnel === 'PSICO' 
    ? Deno.env.get("KOMMO_WEBHOOK_PSICO") 
    : Deno.env.get("KOMMO_WEBHOOK_PRONTO");
    
  if (!webhookUrl) {
    logStep('Kommo webhook URL not configured', { funnel });
    return;
  }
  
  const payload = {
    ...data,
    source: "Stripe→Edge→Sheets",
    funnel: funnel
  };
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Kommo webhook failed: ${response.status}`);
  }
  
  logStep('Successfully sent to Kommo', { funnel, status: response.status });
}

// Processar pagamento aprovado
async function processPaymentSuccess(session: any): Promise<void> {
  logStep('Processing payment success', { sessionId: session.id });
  
  const accessToken = await getAccessToken();
  const now = new Date().toISOString();
  
  // Extrair dados do metadata
  const email = session.metadata?.email || session.customer_details?.email;
  const phone = session.customer_details?.phone || '';
  const sku = session.metadata?.product_sku || session.metadata?.service_code || '';
  const paymentIntentId = session.payment_intent;
  
  if (!email) {
    throw new Error('Email not found in session');
  }
  
  logStep('Extracted session data', { email, phone, sku, paymentIntentId });
  
  // 1. Verificar se usuário tem plano ativo
  const hasActive = await hasActivePlan(email);
  logStep('Active plan check', { email, hasActivePlan: hasActive });
  
  // 2. Determinar funil
  const funnel = determineKommoFunnel(sku);
  logStep('Determined funnel', { sku, funnel });
  
  // 3. Atualizar Patients no Google Sheets
  // Primeiro, buscar se já existe
  const patientsRange = 'Patients!A:Z';
  const patientsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${Deno.env.get("SPREADSHEET_ID")}/values/${patientsRange}`;
  const patientsResponse = await fetch(`${patientsUrl}?majorDimension=ROWS`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  let patientRowIndex = -1;
  if (patientsResponse.ok) {
    const patientsData = await patientsResponse.json();
    const rows = patientsData.values || [];
    
    for (let i = 1; i < rows.length; i++) { // Skip header row
      if (rows[i][0] === email) { // Assumindo email na coluna A
        patientRowIndex = i + 1;
        break;
      }
    }
  }
  
  // Preparar dados do paciente (ajustar colunas conforme necessário)
  const patientData = [
    email,           // A - Email
    phone,           // B - Phone
    '',              // C - Outros campos conforme estrutura da planilha
    '',              // D - ...
    '',              // E - Status do plano
    '',              // F - Data de expiração
    now              // G - Updated at
  ];
  
  if (patientRowIndex > 0) {
    // Update existing
    await updateGoogleSheet(accessToken, `Patients!A${patientRowIndex}:G${patientRowIndex}`, patientData);
    logStep('Updated existing patient', { email, rowIndex: patientRowIndex });
  } else {
    // Append new
    await appendToGoogleSheet(accessToken, 'Patients!A:G', patientData);
    logStep('Created new patient', { email });
  }
  
  // 4. Atualizar Controle Geral Kommo
  const controleRange = 'Controle Geral Kommo!A:Z';
  const controleUrl = `https://sheets.googleapis.com/v4/spreadsheets/${Deno.env.get("SPREADSHEET_ID")}/values/${controleRange}`;
  const controleResponse = await fetch(`${controleUrl}?majorDimension=ROWS`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  let controleRowIndex = -1;
  if (controleResponse.ok) {
    const controleData = await controleResponse.json();
    const rows = controleData.values || [];
    
    for (let i = 1; i < rows.length; i++) { // Skip header row
      if (rows[i][1] === phone) { // Assumindo phone na coluna B
        controleRowIndex = i + 1;
        break;
      }
    }
  }
  
  // Determinar encaminhamento
  const encaminhamento = hasActive ? "ClickLife" : "Kommo";
  
  const controleData = [
    email,           // A - Email
    phone,           // B - Phone
    encaminhamento,  // C - Encaminhamento
    funnel,          // D - Funil
    sku,             // E - SKU do serviço
    now              // F - Timestamp
  ];
  
  if (controleRowIndex > 0) {
    // Update existing
    await updateGoogleSheet(accessToken, `Controle Geral Kommo!A${controleRowIndex}:F${controleRowIndex}`, controleData);
    logStep('Updated controle geral', { phone, encaminhamento, rowIndex: controleRowIndex });
  } else {
    // Append new
    await appendToGoogleSheet(accessToken, 'Controle Geral Kommo!A:F', controleData);
    logStep('Created controle geral entry', { phone, encaminhamento });
  }
  
  // 5. Atualizar Orders
  const orderData = [
    session.id,                    // A - Order ID (usando session ID)
    paymentIntentId,              // B - Payment Intent
    sku,                          // C - SKU
    session.amount_total || 0,    // D - Amount
    'paid',                       // E - Status
    email,                        // F - Email
    now,                          // G - Timestamp
    JSON.stringify(session)       // H - Raw JSON
  ];
  
  await appendToGoogleSheet(accessToken, 'Orders!A:H', orderData);
  logStep('Created order entry', { orderId: session.id, amount: session.amount_total });
  
  // 6. Enviar para Kommo (somente se não tiver plano ativo)
  if (!hasActive) {
    const kommoData = {
      email,
      phone,
      sku,
      service_name: session.metadata?.product_name || sku,
      amount: session.amount_total,
      payment_intent_id: paymentIntentId
    };
    
    await sendToKommo(kommoData, funnel);
  } else {
    logStep('Skipping Kommo - user has active plan', { email, funnel });
  }
  
  // 7. Log de sucesso
  const logData = [
    now,                          // A - Timestamp
    'SUCCESS',                    // B - Status
    session.id,                   // C - Session ID
    email,                        // D - Email
    sku,                          // E - SKU
    funnel,                       // F - Funil
    encaminhamento,               // G - Encaminhamento
    hasActive ? 'YES' : 'NO',     // H - Plano Ativo
    JSON.stringify({ session_id: session.id, payment_intent: paymentIntentId }) // I - Details
  ];
  
  await appendToGoogleSheet(accessToken, 'Logs!A:I', logData);
  logStep('Payment processing completed successfully');
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