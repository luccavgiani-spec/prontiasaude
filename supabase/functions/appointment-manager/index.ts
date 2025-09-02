import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppointmentRequest {
  service_sku: string;
  service_name: string;
  scheduled_date?: string;
  amount_paid: number;
  stripe_session_id?: string;
}

// Google Sheets configuration
const SHEET_ID = '1JdHLB0zShDDX462L7KkhH-Hdrmwd4lJubKqhvlY9m04';
const APPOINTMENTS_GID = '2106090786';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const logStep = (step: string, details?: any) => {
  console.log(`[APPOINTMENT-MANAGER] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authentication required for appointments");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { operation, ...appointmentData } = await req.json();
    logStep('Operation requested', { operation, user: user.email });

    const accessToken = await getAccessToken();

    switch (operation) {
      case 'schedule_appointment':
        return await scheduleAppointment(appointmentData, user, supabaseClient, accessToken);
      case 'get_appointments':
        return await getAppointments(user, supabaseClient, accessToken);
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
  
  // Import private key for signing
  const keyData = await crypto.subtle.importKey(
    'pkcs8',
    new TextEncoder().encode(privateKey),
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

async function appendToGoogleSheet(accessToken: string, sheetName: string, values: any[][]) {
  logStep('Appending to Google Sheet', { sheetName, rowCount: values.length });
  
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}!A:Z:append?valueInputOption=RAW`;
  
  const response = await fetch(url, {
    method: 'POST',
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
    throw new Error(`Google Sheets append failed: ${response.status} - ${error}`);
  }

  logStep('Google Sheet updated successfully');
  return await response.json();
}

async function getAppointmentsFromSheet(accessToken: string, userId: string): Promise<any[]> {
  logStep('Getting appointments from Google Sheet', { userId });
  
  const range = `Agendamentos!A:K`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return [];

  const data = await response.json();
  const values = data.values || [];
  
  // Skip header row, filter by user_id
  const userAppointments = values.slice(1).filter(row => row[1] === userId);
  
  return userAppointments.map(row => ({
    appointment_id: row[0],
    user_id: row[1],
    email: row[2],
    service_sku: row[3],
    service_name: row[4],
    scheduled_date: row[5],
    status: row[6],
    amount_paid: row[7],
    stripe_session_id: row[8],
    created_at: row[9],
    join_url: row[10]
  }));
}

async function scheduleAppointment(data: AppointmentRequest, user: any, supabase: any, accessToken: string) {
  logStep('Scheduling appointment', { 
    service: data.service_sku, 
    user: user.email 
  });

  const appointmentId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const appointment = {
    id: appointmentId,
    user_id: user.id,
    email: user.email,
    service_sku: data.service_sku,
    service_name: data.service_name,
    scheduled_date: data.scheduled_date || now,
    status: 'agendado',
    amount_paid: data.amount_paid,
    stripe_session_id: data.stripe_session_id,
    created_at: now,
    join_url: null // Will be populated later by video system
  };

  // Save to Google Sheets
  try {
    const rowData = [
      appointmentId,              // appointment_id
      user.id,                    // user_id
      user.email,                 // email
      data.service_sku,           // service_sku
      data.service_name,          // service_name
      data.scheduled_date || now, // scheduled_date
      'agendado',                 // status
      data.amount_paid.toString(), // amount_paid
      data.stripe_session_id || '', // stripe_session_id
      now,                        // created_at
      ''                          // join_url
    ];

    await appendToGoogleSheet(accessToken, 'Agendamentos', [rowData]);
    logStep('Appointment saved to Google Sheets');
  } catch (sheetsError) {
    logStep('Google Sheets save failed', { error: sheetsError.message });
  }

  logStep('Appointment scheduled', { appointmentId });

  return new Response(JSON.stringify({ 
    success: true, 
    appointment 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAppointments(user: any, supabase: any, accessToken: string) {
  logStep('Getting appointments', { userId: user.id });

  try {
    const appointments = await getAppointmentsFromSheet(accessToken, user.id);
    logStep('Appointments retrieved from Google Sheets', { count: appointments.length });
    
    return new Response(JSON.stringify({ appointments }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logStep('Error getting appointments', { error: error.message });
    return new Response(JSON.stringify({ appointments: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}