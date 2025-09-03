import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppointmentData {
  appointment_id?: string;
  email: string;
  service_code: string;
  start_at_local: string; // ISO 8601 com offset: 2025-09-03T16:00:00-03:00
  duration_min: number;
  status?: string;
  order_id?: string;
}

// Google Sheets configuration - NOVO SPREADSHEET
const SHEET_ID = '1w9DkrKnwvfCiVvGVFUzu272by0khGy5qx4Voh43H56I';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const logStep = (step: string, details?: any) => {
  console.log(`[APPOINTMENTS-MANAGER] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
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

    const { operation, ...appointmentData } = await req.json();
    logStep('Operation requested', { operation, email: appointmentData.email });

    const accessToken = await getAccessToken();
    
    switch (operation) {
      case 'create_appointment':
        return await createAppointment(appointmentData, accessToken);
      case 'update_appointment':
        return await updateAppointment(appointmentData, accessToken);
      case 'get_appointments':
        return await getAppointments(appointmentData.email, accessToken);
      case 'get_appointment':
        return await getAppointment(appointmentData.appointment_id, accessToken);
      case 'get_patient_plan':
        return await getPatientPlan(appointmentData.email, accessToken);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

  } catch (error) {
    logStep('ERROR', { 
      message: error.message,
      stack: error.stack,
      details: error
    });
    
    // More specific error messages
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error.message.includes('JSON')) {
      errorMessage = 'Invalid Google Service Account configuration';
    } else if (error.message.includes('access') || error.message.includes('403')) {
      errorMessage = 'Google Sheets access denied - check Service Account permissions';
    } else if (error.message.includes('OAuth2')) {
      errorMessage = 'Authentication with Google failed - check Service Account credentials';
    } else if (error.message.includes('Unknown operation')) {
      errorMessage = error.message;
      statusCode = 400;
    } else {
      errorMessage = error.message || 'Internal server error';
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createJWT(): Promise<string> {
  logStep('Creating JWT for Google Sheets API');
  
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable not set');
  }
  
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (error) {
    logStep('Failed to parse GOOGLE_SERVICE_ACCOUNT JSON', { error: error.message });
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT JSON format');
  }
  
  if (!serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('Invalid service account: missing private_key or client_email');
  }
  
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

async function findAppointmentRow(accessToken: string, appointment_id: string): Promise<number | null> {
  logStep('Searching for existing appointment', { appointment_id });
  
  const range = `Appointments!A:A`;
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
    if (values[i][0] === appointment_id) {
      logStep('Found existing appointment at row', { row: i + 1 });
      return i + 1;
    }
  }
  
  logStep('Appointment not found, will create new row');
  return null;
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

async function createAppointment(data: AppointmentData, accessToken: string) {
  logStep('Creating appointment', { 
    email: data.email,
    service_code: data.service_code,
    start_at_local: data.start_at_local
  });

  // Generate appointment_id if not provided
  const appointment_id = data.appointment_id || crypto.randomUUID();
  
  // Check if appointment already exists
  const existingRow = await findAppointmentRow(accessToken, appointment_id);
  
  const now = new Date().toISOString();
  
  // Appointments: appointment_id | email | service_code | start_at_local | duration_min | teams_join_url | teams_meeting_id | status | order_id | created_at
  const rowData = [
    appointment_id,         // appointment_id
    data.email,            // email  
    data.service_code,     // service_code
    data.start_at_local,   // start_at_local
    data.duration_min,     // duration_min
    '',                    // teams_join_url (preenchido pelo webhook)
    '',                    // teams_meeting_id (preenchido pelo webhook)
    data.status || 'scheduled', // status
    data.order_id || '',   // order_id
    existingRow ? '' : now // created_at (só define se for novo)
  ];

  try {
    if (existingRow) {
      // Update existing row
      await updateGoogleSheet(accessToken, `Appointments!A${existingRow}:J${existingRow}`, [rowData]);
      logStep('Updated existing appointment in Google Sheets');
    } else {
      // Append new row
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Appointments!A:J:append?valueInputOption=RAW`;
      
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
        logStep('Appointment added to Google Sheets successfully');
      }
    }
  } catch (sheetsError) {
    logStep('Google Sheets update failed', { error: sheetsError.message });
    throw sheetsError;
  }

  logStep('Appointment created successfully');

  return new Response(JSON.stringify({ 
    success: true, 
    appointment_id,
    message: 'Appointment created successfully'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function updateAppointment(data: AppointmentData, accessToken: string) {
  if (!data.appointment_id) {
    throw new Error('appointment_id is required for updates');
  }

  logStep('Updating appointment', { appointment_id: data.appointment_id });

  const existingRow = await findAppointmentRow(accessToken, data.appointment_id);
  if (!existingRow) {
    throw new Error('Appointment not found');
  }

  // Get existing data first
  const getResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Appointments!A${existingRow}:J${existingRow}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  if (!getResponse.ok) {
    throw new Error('Failed to get existing appointment data');
  }

  const existingData = await getResponse.json();
  const currentRow = existingData.values?.[0] || [];

  // Merge existing data with updates
  const rowData = [
    data.appointment_id,                    // appointment_id
    data.email || currentRow[1],           // email  
    data.service_code || currentRow[2],    // service_code
    data.start_at_local || currentRow[3],  // start_at_local
    data.duration_min || currentRow[4],    // duration_min
    currentRow[5] || '',                   // teams_join_url (mantém existente)
    currentRow[6] || '',                   // teams_meeting_id (mantém existente)
    data.status || currentRow[7],          // status
    data.order_id || currentRow[8],        // order_id
    currentRow[9] || ''                    // created_at (mantém existente)
  ];

  await updateGoogleSheet(accessToken, `Appointments!A${existingRow}:J${existingRow}`, [rowData]);

  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Appointment updated successfully'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAppointments(email: string, accessToken: string) {
  logStep('Getting appointments for email', { email });

  const range = `Appointments!A:J`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch appointments');
  }

  const data = await response.json();
  const values = data.values || [];
  
  if (values.length <= 1) {
    return new Response(JSON.stringify({ appointments: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Skip header row and filter by email
  const appointments = values.slice(1)
    .filter(row => row[1] === email) // email is column B (index 1)
    .map(row => ({
      appointment_id: row[0] || '',
      email: row[1] || '',
      service_code: row[2] || '',
      start_at_local: row[3] || '',
      duration_min: parseInt(row[4]) || 0,
      teams_join_url: row[5] || '',
      teams_meeting_id: row[6] || '',
      status: row[7] || '',
      order_id: row[8] || '',
      created_at: row[9] || ''
    }));

  logStep('Found appointments', { count: appointments.length });

  return new Response(JSON.stringify({ appointments }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAppointment(appointment_id: string, accessToken: string) {
  logStep('Getting appointment', { appointment_id });

  const existingRow = await findAppointmentRow(accessToken, appointment_id);
  if (!existingRow) {
    return new Response(JSON.stringify({ appointment: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const getResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Appointments!A${existingRow}:J${existingRow}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );

  if (!getResponse.ok) {
    throw new Error('Failed to get appointment data');
  }

  const data = await getResponse.json();
  const row = data.values?.[0] || [];

  const appointment = {
    appointment_id: row[0] || '',
    email: row[1] || '',
    service_code: row[2] || '',
    start_at_local: row[3] || '',
    duration_min: parseInt(row[4]) || 0,
    teams_join_url: row[5] || '',
    teams_meeting_id: row[6] || '',
    status: row[7] || '',
    order_id: row[8] || '',
    created_at: row[9] || ''
  };

  return new Response(JSON.stringify({ appointment }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getPatientPlan(email: string, accessToken: string) {
  logStep('Getting patient plan for email', { email });
  
  try {
    const range = `Patients!A:H`; // patient_id | name | email | phone_e164 | stripe_customer_id | plan_code | plan_expires_at | status
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.status}`);
    }
    
    const data = await response.json();
    const rows = data.values || [];
    
    if (rows.length <= 1) {
      return new Response(JSON.stringify({ plan: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Find header row and get column indices
    const headers = rows[0];
    const emailCol = headers.indexOf('email');
    const planCodeCol = headers.indexOf('plan_code');
    const planExpiresCol = headers.indexOf('plan_expires_at');
    const statusCol = headers.indexOf('status');
    
    if (emailCol === -1) {
      throw new Error('Email column not found in Patients sheet');
    }
    
    // Find patient row
    const patientRow = rows.slice(1).find(row => 
      row[emailCol] && row[emailCol].toLowerCase().trim() === email.toLowerCase().trim()
    );
    
    if (!patientRow) {
      logStep('Patient not found in Patients sheet', { email });
      return new Response(JSON.stringify({ plan: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const plan = {
      plan_code: planCodeCol >= 0 && patientRow[planCodeCol] ? patientRow[planCodeCol] : undefined,
      plan_expires_at: planExpiresCol >= 0 && patientRow[planExpiresCol] ? patientRow[planExpiresCol] : undefined,
      status: statusCol >= 0 && patientRow[statusCol] ? patientRow[statusCol] : undefined,
    };
    
    logStep('Patient plan found', { email, plan });
    
    return new Response(JSON.stringify({ plan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    logStep('Error getting patient plan', { email, error: error.message });
    return new Response(JSON.stringify({ error: 'Failed to get patient plan' }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}