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

interface CompleteProfileRequest {
  operation: 'complete_profile';
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  cpf: string;
  birth_date: string;
  gender?: string;
  cep?: string;
  address_number?: string;
  address_complement?: string;
  city?: string;
  state?: string;
  plano: boolean;
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

interface ScheduleRedirectRequest {
  operation: 'schedule_redirect';
  user_id: string;
  sku: string;
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
        
        console.log('=== PATIENT REGISTRATION START ===');
        console.log('Received data:', { name, email, phone_e164 });
        console.log('GAS_BASE URL:', gasBase);
        
        // Save to Supabase auth.users
        console.log('Creating user in Supabase auth...');
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

        console.log('Supabase auth result:', authData ? 'Success' : 'User already exists');

        // Prepare GAS API payload
        const gasPayload = {
          first_name: name.split(' ')[0] || '',
          last_name: name.split(' ').slice(1).join(' ') || '',
          email,
          phone: phone_e164
        };

        console.log('Calling GAS API with payload:', gasPayload);
        console.log('Full GAS URL:', `${gasBase}?path=site-register`);

        // Call GAS API
        const gasResponse = await fetch(`${gasBase}?path=site-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gasPayload)
        });

        console.log('GAS response status:', gasResponse.status);
        console.log('GAS response ok:', gasResponse.ok);
        
        const gasResult = await gasResponse.text();
        console.log('GAS response body:', gasResult);
        
        console.log('=== PATIENT REGISTRATION END ===');

        return new Response(
          JSON.stringify({ 
            success: true, 
            supabase: authData ? 'created' : 'exists', 
            gas: gasResult,
            gasStatus: gasResponse.status
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'complete_profile': {
        const profileData = body as CompleteProfileRequest;
        
        console.log('=== COMPLETE PROFILE START ===');
        console.log('Received data:', profileData);
        
        // Prepare GAS API payload
        const gasPayload = {
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          email: profileData.email,
          phone: profileData.phone,
          cpf: profileData.cpf,
          birth_date: profileData.birth_date,
          gender: profileData.gender || '',
          cep: profileData.cep || '',
          address_number: profileData.address_number || '',
          address_complement: profileData.address_complement || '',
          city: profileData.city || '',
          state: profileData.state || '',
          source: 'site',
          plano: profileData.plano
        };

        console.log('Calling GAS API with payload:', gasPayload);
        console.log('Full GAS URL:', `${gasBase}?path=site-register`);

        // Call GAS API
        const gasResponse = await fetch(`${gasBase}?path=site-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gasPayload)
        });

        console.log('GAS response status:', gasResponse.status);
        const gasResult = await gasResponse.text();
        console.log('GAS response body:', gasResult);
        console.log('=== COMPLETE PROFILE END ===');

        return new Response(
          JSON.stringify({ 
            success: true, 
            gas: gasResult,
            gasStatus: gasResponse.status
          }),
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

      case 'schedule_redirect': {
        const { user_id, sku } = body as ScheduleRedirectRequest;
        
        console.log('=== SCHEDULE REDIRECT START ===');
        console.log('User ID:', user_id, 'SKU:', sku);
        
        // Fetch complete patient data
        const { data: patient, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .eq('id', user_id)
          .single();
        
        if (patientError || !patient) {
          console.error('Patient not found:', patientError);
          return new Response(
            JSON.stringify({ error: 'Paciente não encontrado' }),
            { status: 404, headers: corsHeaders }
          );
        }
        
        if (!patient.profile_complete) {
          console.error('Profile incomplete for user:', user_id);
          return new Response(
            JSON.stringify({ error: 'Cadastro incompleto' }),
            { status: 400, headers: corsHeaders }
          );
        }
        
        // Get user email from auth
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(user_id);
        
        if (userError || !user?.email) {
          console.error('User email not found:', userError);
          return new Response(
            JSON.stringify({ error: 'Email do usuário não encontrado' }),
            { status: 404, headers: corsHeaders }
          );
        }
        
        // Format birth_date to DD-MM-AAAA
        const formatDateBR = (dateStr: string) => {
          if (!dateStr) return '';
          const [year, month, day] = dateStr.split('-');
          return `${day}-${month}-${year}`;
        };
        
        // Build complete payload for App Script
        const gasPayload = {
          data: new Date().toISOString().split('T')[0],
          id_user: patient.id,
          nome: patient.first_name || '',
          sobrenome: patient.last_name || '',
          email: user.email,
          telefone: patient.phone_e164 || '',
          cpf: patient.cpf || '',
          data_nascimento: formatDateBR(patient.birth_date || ''),
          genero: patient.gender || '',
          cep: patient.cep || '',
          endereco_numero: patient.address_number || '',
          complemento: patient.address_complement || '',
          cidade: patient.city || '',
          uf: patient.state || '',
          fonte: patient.source || 'site',
          plano: false, // TODO: integrate with plan system
          sku: sku || ''
        };
        
        console.log('Calling App Script with payload:', gasPayload);
        
        // Call App Script
        const gasResponse = await fetch(`${gasBase}?path=site-schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gasPayload)
        });
        
        console.log('App Script response status:', gasResponse.status);
        const gasResult = await gasResponse.json();
        console.log('App Script response:', gasResult);
        console.log('=== SCHEDULE REDIRECT END ===');
        
        return new Response(
          JSON.stringify({ 
            success: true,
            meetingLink: gasResult.meetingLink || null,
            queueURL: gasResult.queueURL || null,
            url: gasResult.url || null
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