import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpsertPatientRequest {
  operation: 'upsert_patient';
  name: string;
  email: string;
  phone_e164: string;
}

interface ScheduleAppointmentRequest {
  operation: 'schedule_appointment';
  user_id: string;
  email: string;
  nome: string;
  especialidade: string;
  horario_iso: string;
  plano_ativo: boolean;
  servico: string;
  cpf?: string;
  adicional?: string;
  cupom?: string;
  fotos_base64?: string[];
}

interface SyncAppointmentRequest {
  operation: 'sync_appointment';
  appointment_id: string;
  status: string;
  meeting_link?: string;
  provider?: string;
  external_appointment_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const gasBase = Deno.env.get('GAS_BASE');

    if (!supabaseServiceRoleKey || !supabaseUrl || !gasBase) {
      throw new Error('Missing required environment variables');
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await req.json();
    console.log('Patient operations request:', body);

    switch (body.operation) {
      case 'upsert_patient': {
        const { name, email, phone_e164 } = body as UpsertPatientRequest;
        
        // Save to Supabase (assuming we have a patients table or auth.users)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            first_name: name.split(' ')[0] || '',
            last_name: name.split(' ').slice(1).join(' ') || '',
            phone_e164
          }
        });

        if (authError && !authError.message.includes('already exists')) {
          console.error('Supabase auth error:', authError);
          throw authError;
        }

        console.log('User created/exists in Supabase:', authData);

        // Call GAS API
        const gasPayload = {
          first_name: name.split(' ')[0] || '',
          last_name: name.split(' ').slice(1).join(' ') || '',
          email,
          phone: phone_e164
        };

        const gasResponse = await fetch(`${gasBase}?path=site-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gasPayload)
        });

        const gasResult = await gasResponse.text();
        console.log('GAS register response:', gasResult);

        return new Response(
          JSON.stringify({ success: true, supabase: authData, gas: gasResult }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'schedule_appointment': {
        const appointmentData = body as ScheduleAppointmentRequest;
        
        // Save to Supabase appointments table (if exists)
        // For now, we'll just log and proceed to GAS
        console.log('Scheduling appointment in Supabase:', appointmentData);

        // Call GAS API
        const gasPayload = {
          user_id: appointmentData.user_id,
          email: appointmentData.email,
          nome: appointmentData.nome,
          especialidade: appointmentData.especialidade,
          horario_iso: appointmentData.horario_iso,
          plano_ativo: appointmentData.plano_ativo,
          servico: appointmentData.servico,
          ...(appointmentData.cpf && { cpf: appointmentData.cpf }),
          ...(appointmentData.adicional && { adicional: appointmentData.adicional }),
          ...(appointmentData.cupom && { cupom: appointmentData.cupom }),
          ...(appointmentData.fotos_base64 && { fotos_base64: appointmentData.fotos_base64 })
        };

        const gasResponse = await fetch(`${gasBase}?path=site-schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gasPayload)
        });

        const gasResult = await gasResponse.text();
        console.log('GAS schedule response:', gasResult);

        return new Response(
          JSON.stringify({ success: true, gas: gasResult }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync_appointment': {
        const { appointment_id, status, meeting_link, provider, external_appointment_id } = body as SyncAppointmentRequest;
        
        // Update Supabase appointment (if appointments table exists)
        console.log('Syncing appointment:', body);
        
        // For now, just log the sync - you can implement Supabase update later
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Appointment synced',
            appointment_id,
            status,
            meeting_link,
            provider,
            external_appointment_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown operation: ${body.operation}`);
    }

  } catch (error) {
    console.error('Error in patient-operations:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});