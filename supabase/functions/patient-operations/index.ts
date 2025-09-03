import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PatientData {
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
}

// Google Sheets configuration - NOVO SPREADSHEET
const SHEET_ID = '1w9DkrKnwvfCiVvGVFUzu272by0khGy5qx4Voh43H56I';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const logStep = (step: string, details?: any) => {
  console.log(`[PATIENT-OPERATIONS] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { operation, ...patientData } = await req.json();
    logStep('Operation requested', { operation, email: patientData.email });

    const accessToken = await getAccessToken();
    
    switch (operation) {
      case 'upsert_patient':
        return await upsertPatient(patientData, supabaseClient, accessToken);
      case 'get_patient':
        return await getPatient(patientData.email, supabaseClient, accessToken);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

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
  
  // Properly decode PEM private key
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

async function updateGoogleSheet(accessToken: string, range: string, values: any[][]) {
  logStep('Updating Google Sheet', { range, rowCount: values.length });
  
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=RAW`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: values
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Sheets update failed: ${response.status} - ${error}`);
  }

  logStep('Google Sheet updated successfully');
  return await response.json();
}

async function findPatientRow(accessToken: string, email: string): Promise<number | null> {
  logStep('Searching for existing patient', { email });
  
  const range = `Patients!C:C`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const values = data.values || [];
  
  for (let i = 1; i < values.length; i++) { // Skip header row
    if (values[i][0] === email) {
      logStep('Found existing patient at row', { row: i + 1 });
      return i + 1;
    }
  }
  
  logStep('Patient not found, will create new row');
  return null;
}

async function upsertPatient(data: PatientData, supabase: any, accessToken: string) {
  logStep('Upserting patient', { 
    name: data.name || `${data.first_name} ${data.last_name}`, 
    email: data.email 
  });

  // Split name if needed
  let firstName = data.first_name;
  let lastName = data.last_name;
  
  if (data.name && !firstName && !lastName) {
    const nameParts = data.name.trim().split(' ');
    firstName = nameParts[0];
    lastName = nameParts.slice(1).join(' ');
  }

  // Generate a temporary ID based on email for Google Sheets
  const tempId = `temp_${data.email.replace(/[^a-zA-Z0-9]/g, '_')}`;

  // For now, we'll save to Google Sheets only since we don't have user authentication
  // The patient record will be properly created when they sign up
  logStep('Saving patient to Google Sheets only (no authentication)');

  // Update Google Sheets
  try {
    const existingRow = await findPatientRow(accessToken, data.email);
    const now = new Date().toISOString();
    const fullName = data.name || `${firstName || ''} ${lastName || ''}`.trim();
    
    // Patients: patient_id | name | email | phone_e164 | stripe_customer_id | plan_code | plan_expires_at | status
    const rowData = [
      tempId,                     // patient_id (will be replaced with real user_id later)
      fullName,                   // name  
      data.email,                 // email
      data.phone || '',           // phone_e164
      '',                         // stripe_customer_id (preenchido após integração com Stripe)
      '',                         // plan_code (ex: BASIC, PREMIUM)
      '',                         // plan_expires_at
      'pending'                   // status (pending, active, inactive)
    ];

    if (existingRow) {
      // Update existing row
      await updateGoogleSheet(accessToken, `Patients!A${existingRow}:H${existingRow}`, [rowData]);
      logStep('Updated existing patient in Google Sheets');
    } else {
      // Append new row
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Patients!A:H:append?valueInputOption=RAW`;
      
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
        logStep('Google Sheets append failed', { error });
        throw new Error(`Google Sheets error: ${error}`);
      } else {
        logStep('Patient added to Google Sheets successfully');
      }
    }
  } catch (sheetsError) {
    logStep('Google Sheets update failed', { error: sheetsError.message });
    throw sheetsError;
  }

  logStep('Patient upserted successfully in Google Sheets');

  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Patient data saved to Google Sheets successfully'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getPatient(email: string, supabase: any, accessToken: string) {
  logStep('Getting patient', { email });

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    logStep('No patient found in Supabase');
    return new Response(JSON.stringify({ patient: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  logStep('Patient found', { patient: data });

  return new Response(JSON.stringify({ patient: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}