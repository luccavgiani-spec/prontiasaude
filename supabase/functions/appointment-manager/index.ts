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

    switch (operation) {
      case 'schedule_appointment':
        return await scheduleAppointment(appointmentData, user, supabaseClient);
      case 'get_appointments':
        return await getAppointments(user, supabaseClient);
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

async function scheduleAppointment(data: AppointmentRequest, user: any, supabase: any) {
  logStep('Scheduling appointment', { 
    service: data.service_sku, 
    user: user.email 
  });

  const appointmentId = crypto.randomUUID();
  
  // TODO: Save to Google Sheets
  // This would involve calling the Google Sheets API to record the appointment
  
  // For now, return success with appointment details
  const appointment = {
    id: appointmentId,
    user_id: user.id,
    email: user.email,
    service_sku: data.service_sku,
    service_name: data.service_name,
    scheduled_date: data.scheduled_date || new Date().toISOString(),
    status: 'agendado',
    amount_paid: data.amount_paid,
    stripe_session_id: data.stripe_session_id,
    created_at: new Date().toISOString(),
    join_url: null // Will be populated later by video system
  };

  logStep('Appointment scheduled', { appointmentId });

  return new Response(JSON.stringify({ 
    success: true, 
    appointment 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAppointments(user: any, supabase: any) {
  logStep('Getting appointments', { userId: user.id });

  // TODO: Fetch from Google Sheets
  // For now, return empty array
  const appointments = [];

  return new Response(JSON.stringify({ appointments }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}