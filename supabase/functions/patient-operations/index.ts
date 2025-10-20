import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation helpers
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

const validateCPF = (cpf: string): boolean => {
  const cpfRegex = /^\d{11}$/;
  return cpfRegex.test(cpf);
};

const validateString = (str: string, maxLength: number): boolean => {
  return typeof str === 'string' && str.length > 0 && str.length <= maxLength;
};

const validateDate = (dateStr: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
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

    // Get authenticated user from JWT (except for upsert_patient which allows registration)
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    const body = await req.json();
    
    // Validate authenticated user for operations that require it
    if (body.operation !== 'upsert_patient') {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Autenticação necessária' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Token inválido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    switch (body.operation) {
      case 'upsert_patient': {
        const { name, email, phone_e164 } = body as UpsertPatientRequest;
        
        // Validate inputs
        if (!validateString(name, 255)) {
          return new Response(
            JSON.stringify({ error: 'Nome inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!validateEmail(email)) {
          return new Response(
            JSON.stringify({ error: 'Email inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!validatePhone(phone_e164)) {
          return new Response(
            JSON.stringify({ error: 'Telefone inválido (formato E.164 esperado)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Save to Supabase auth.users
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

        const userId = authData?.user?.id || null;

        console.log('[upsert_patient] User created/exists:', { 
          email, 
          userId,
          status: authData ? 'created' : 'already_exists'
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            user_id: userId,
            status: authData ? 'created' : 'exists',
            message: 'Usuário registrado. Complete o perfil para finalizar o cadastro.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'complete_profile': {
        const profileData = body as CompleteProfileRequest;
        
        // Validate required fields
        if (!validateString(profileData.first_name, 100) || 
            !validateString(profileData.last_name, 100)) {
          return new Response(
            JSON.stringify({ error: 'Nome ou sobrenome inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!validateEmail(profileData.email)) {
          return new Response(
            JSON.stringify({ error: 'Email inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!validatePhone(profileData.phone)) {
          return new Response(
            JSON.stringify({ error: 'Telefone inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!validateCPF(profileData.cpf)) {
          return new Response(
            JSON.stringify({ error: 'CPF inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!validateDate(profileData.birth_date)) {
          return new Response(
            JSON.stringify({ error: 'Data de nascimento inválida' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Prepare GAS API payload with validated data
        const gasPayload = {
          first_name: profileData.first_name.substring(0, 100),
          last_name: profileData.last_name.substring(0, 100),
          email: profileData.email.substring(0, 255),
          phone: profileData.phone,
          cpf: profileData.cpf,
          birth_date: profileData.birth_date,
          gender: profileData.gender ? profileData.gender.substring(0, 1) : '',
          cep: profileData.cep ? profileData.cep.substring(0, 10) : '',
          address_number: profileData.address_number ? profileData.address_number.substring(0, 20) : '',
          address_complement: profileData.address_complement ? profileData.address_complement.substring(0, 100) : '',
          city: profileData.city ? profileData.city.substring(0, 100) : '',
          state: profileData.state ? profileData.state.substring(0, 2) : '',
          source: 'site',
          plano: profileData.plano
        };

        // Call GAS API
        const gasResponse = await fetch(`${gasBase}?path=site-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gasPayload)
        });

        const gasResult = await gasResponse.text();

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
        
        // Validate inputs
        if (!validateEmail(appointmentData.email)) {
          return new Response(
            JSON.stringify({ error: 'Email inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!validateString(appointmentData.nome, 255)) {
          return new Response(
            JSON.stringify({ error: 'Nome inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Call GAS API
        const gasPayload = {
          user_id: appointmentData.user_id,
          email: appointmentData.email.substring(0, 255),
          nome: appointmentData.nome.substring(0, 255),
          especialidade: appointmentData.especialidade,
          horario_iso: appointmentData.horario_iso,
          plano_ativo: appointmentData.plano_ativo,
          servico: appointmentData.servico,
          ...(appointmentData.cpf && validateCPF(appointmentData.cpf) && { cpf: appointmentData.cpf }),
          ...(appointmentData.adicional && { adicional: appointmentData.adicional.substring(0, 1000) }),
          ...(appointmentData.cupom && { cupom: appointmentData.cupom.substring(0, 50) }),
          ...(appointmentData.fotos_base64 && { fotos_base64: appointmentData.fotos_base64 })
        };

        const gasResponse = await fetch(`${gasBase}?path=site-schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gasPayload)
        });

        const gasResult = await gasResponse.text();

        return new Response(
          JSON.stringify({ success: true, gas: gasResult }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync_appointment': {
        const { appointment_id, status, meeting_link, provider, external_appointment_id } = body as SyncAppointmentRequest;
        
        if (!validateString(appointment_id, 255) || !validateString(status, 50)) {
          return new Response(
            JSON.stringify({ error: 'Dados inválidos' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
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
        
        if (!validateString(sku, 50)) {
          return new Response(
            JSON.stringify({ error: 'SKU inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Fetch complete patient data
        const { data: patient, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .eq('id', user_id)
          .single();
        
        if (patientError || !patient) {
          return new Response(
            JSON.stringify({ error: 'Paciente não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!patient.profile_complete) {
          return new Response(
            JSON.stringify({ error: 'Cadastro incompleto' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Get user email from auth
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(user_id);
        
        if (userError || !user?.email) {
          return new Response(
            JSON.stringify({ error: 'Email do usuário não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
          plano: false,
          sku: sku.substring(0, 50)
        };
        
        // Call App Script
        const gasResponse = await fetch(`${gasBase}?path=site-schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gasPayload)
        });
        
        const gasResult = await gasResponse.json();
        
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
        return new Response(
          JSON.stringify({ error: `Operação desconhecida: ${body.operation}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error in patient-operations:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno do servidor'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
