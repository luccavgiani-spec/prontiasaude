import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { appointment_id, status, meeting_link, provider, external_appointment_id } = await req.json();
    
    console.log('Sync appointment webhook received:', {
      appointment_id,
      status,
      meeting_link,
      provider,
      external_appointment_id
    });

    // Here you could update your Supabase database if needed
    // For now, we'll just log the webhook data
    
    // In a real implementation, you might want to:
    // 1. Update appointment status in your database
    // 2. Send notifications to users
    // 3. Log the sync event
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Appointment sync received successfully',
        appointment_id,
        status 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in sync-appointment webhook:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});