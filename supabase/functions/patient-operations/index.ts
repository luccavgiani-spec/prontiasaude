import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PatientData {
  name: string;
  email: string;
  phone_e164: string;
  first_name?: string;
  last_name?: string;
  cpf?: string;
  birth_date?: string;
  address_line?: string;
}

const logStep = (step: string, details?: any) => {
  console.log(`[PATIENT-OPS] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started', { method: req.method });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { operation, ...requestData } = await req.json();
    logStep('Operation requested', { operation, user: user.email });

    // Initialize Google Sheets API
    const serviceAccount = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT') || '{}');
    const jwt = await createJWT(serviceAccount);
    const accessToken = await getAccessToken(jwt);

    switch (operation) {
      case 'upsert_patient':
        return await upsertPatient(requestData, user, accessToken, supabaseClient);
      case 'get_patient':
        return await getPatient(user, accessToken, supabaseClient);
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

async function createJWT(serviceAccount: any) {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // For production, you would need to implement proper JWT signing
  // This is a simplified version - in real implementation, use proper crypto
  return unsignedToken;
}

async function getAccessToken(jwt: string) {
  // This is a placeholder - in production, implement proper OAuth2 flow
  // For now, return a mock token
  return "mock_access_token";
}

async function upsertPatient(data: PatientData, user: any, accessToken: string, supabase: any) {
  logStep('Upserting patient', { email: data.email });

  // Split name into first_name and last_name if provided
  if (data.name && !data.first_name && !data.last_name) {
    const nameParts = data.name.trim().split(' ');
    data.first_name = nameParts[0];
    data.last_name = nameParts.slice(1).join(' ');
  }

  // Update Supabase first
  const { error: supabaseError } = await supabase
    .from('patients')
    .upsert({
      id: user.id,
      first_name: data.first_name,
      last_name: data.last_name,
      phone_e164: data.phone_e164,
      cpf: data.cpf,
      birth_date: data.birth_date,
      address_line: data.address_line,
      updated_at: new Date().toISOString()
    });

  if (supabaseError) {
    logStep('Supabase error', supabaseError);
    throw new Error(`Database error: ${supabaseError.message}`);
  }

  // TODO: Update Google Sheets with the access token
  // This would involve calling the Google Sheets API
  logStep('Patient upserted successfully');

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getPatient(user: any, accessToken: string, supabase: any) {
  logStep('Getting patient', { userId: user.id });

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    logStep('Supabase error', error);
    throw new Error(`Database error: ${error.message}`);
  }

  return new Response(JSON.stringify(data || null), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}