import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  mode: 'payment' | 'subscription';
  price_id?: string;
  email: string;
  product_name?: string;
  product_sku?: string;
  plan_name?: string;
  plan_code?: string;
  success_url?: string;
  cancel_url?: string;
  // Novos campos para agendamentos
  appointment_id?: string;
  service_code?: string;
  start_at_local?: string;
  duration_min?: number;
  order_id?: string;
}

// Google Sheets configuration - NOVO SPREADSHEET
const SHEET_ID = '1w9DkrKnwvfCiVvGVFUzu272by0khGy5qx4Voh43H56I';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SITE_BASE_URL = 'https://medicosdobem.com';

const logStep = (step: string, details?: any) => {
  console.log(`[STRIPE-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || "", {
      apiVersion: "2023-10-16",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    // Get user if authenticated (optional for some checkouts)
    let user = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      user = userData.user;
    }

    const checkoutData: CheckoutRequest = await req.json();
    logStep('Checkout requested', { 
      mode: checkoutData.mode,
      email: checkoutData.email,
      user: user?.email 
    });

    // Check for existing customer
    const customers = await stripe.customers.list({ 
      email: checkoutData.email, 
      limit: 1 
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep('Found existing customer', { customerId });
    }

    // Create line items based on mode
    let lineItems;
    if (checkoutData.price_id) {
      // Use Price ID for both payments and subscriptions
      lineItems = [{
        price: checkoutData.price_id,
        quantity: 1,
      }];
    } else {
      // Fallback with price_data for cases without price_id
      lineItems = [{
        price_data: {
          currency: 'brl',
          product_data: { 
            name: checkoutData.product_name || 'Produto',
          },
          unit_amount: 1000, // Fallback value - should use price_id instead
        },
        quantity: 1,
      }];
    }

    const origin = req.headers.get("origin") || "https://ploqujuhpwutpcibedbr.supabase.co";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : checkoutData.email,
      line_items: lineItems,
      mode: checkoutData.mode,
      success_url: checkoutData.success_url || `${SITE_BASE_URL}/confirmacao?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(checkoutData.email)}`,
      cancel_url: checkoutData.cancel_url || `${SITE_BASE_URL}/servicos?cancel=1`,
      metadata: {
        user_id: user?.id || '',
        product_sku: checkoutData.product_sku || '',
        plan_code: checkoutData.plan_code || '',
        // Metadata para webhook (OBRIGATÓRIO - novo fluxo automático)
        email: checkoutData.email,
        service_code: checkoutData.service_code || 'CONSULTA_CLINICA',
        duration_min: checkoutData.duration_min ? String(checkoutData.duration_min) : '30',
      },
    });

    // Record order in Google Sheets for tracking
    try {
      const accessToken = await getAccessToken();
      await recordOrderInSheet(accessToken, session, checkoutData, user);
    } catch (sheetsError) {
      logStep('Google Sheets recording failed', { error: sheetsError.message });
    }

    logStep('Checkout session created', { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ 
      sessionId: session.id,
      url: session.url 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    logStep('ERROR', { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createJWT(): Promise<string> {
  logStep('Creating JWT for Google Sheets API');
  
  const serviceAccount = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT') || '{}');
  const privateKey = serviceAccount.private_key?.replace(/\\n/g, '\n');
  
  if (!privateKey) throw new Error('Google service account private key not found');

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(JSON.stringify(header));
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  
  const headerB64 = btoa(String.fromCharCode(...headerBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payloadB64 = btoa(String.fromCharCode(...payloadBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const message = `${headerB64}.${payloadB64}`;
  
  // Import private key for signing
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  
  logStep('Importing private key for signing...');
  
  // Convert base64 to ArrayBuffer
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const keyData = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyData,
    encoder.encode(message)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  return `${message}.${signatureB64}`;
}

async function getAccessToken(): Promise<string> {
  logStep('Getting access token from Google OAuth2');
  
  const jwt = await createJWT();
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    throw new Error(`OAuth2 token request failed: ${response.status}`);
  }

  const data = await response.json();
  logStep('Access token obtained successfully');
  return data.access_token;
}

async function recordOrderInSheet(accessToken: string, session: any, checkoutData: CheckoutRequest, user: any) {
  logStep('Recording order in Google Sheets', { sessionId: session.id });
  
  const now = new Date().toISOString();
  const orderId = checkoutData.order_id || crypto.randomUUID();
  
  // Orders: order_id | customer_id | payment_intent | product_sku | amount_cents | status | email | created_at | raw_json
  const rowData = [
    orderId,                              // order_id
    user?.id || '',                       // customer_id
    '',                                   // payment_intent (preenchido pelo webhook)
    checkoutData.product_sku || checkoutData.service_code || '', // product_sku
    (session.amount_total || 0),          // amount_cents
    'pending',                            // status
    checkoutData.email,                   // email
    now,                                  // created_at
    JSON.stringify(session)               // raw_json
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Orders!A:I:append?valueInputOption=RAW`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowData]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Sheets append failed: ${response.status} - ${error}`);
  }

  logStep('Order recorded in Google Sheets successfully');
}