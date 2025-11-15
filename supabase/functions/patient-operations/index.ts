import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { getCorsHeaders } from '../common/cors.ts';
import { validateCPF as validateCPFChecksum, cleanCPF } from '../common/cpf-validator.ts';

const corsHeaders = getCorsHeaders();

// Validation helpers
const TEMP_EMAIL_DOMAINS = [
  '10minutemail.com', 'guerrillamail.com', 'mailinator.com', 'tempmail.com',
  'throwaway.email', 'maildrop.cc', 'temp-mail.org', 'getnada.com',
  'yopmail.com', 'mailnesia.com', 'trashmail.com', 'sharklasers.com'
];

const VALID_DDDS = [
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 64, 63, 65, 66, 67, 68,
  69, 71, 73, 74, 75, 77, 79, 81, 87, 82, 83, 84, 85, 88, 86, 89, 91, 93, 94, 92, 97,
  95, 96, 98, 99
];

const validateEmail = (email: string): boolean => {
  if (!email || email.length > 255) return false;
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  
  // Rejeitar domínios temporários
  if (TEMP_EMAIL_DOMAINS.some(temp => domain.includes(temp))) return false;
  
  // Rejeitar emails obviamente falsos
  if (/^(test|fake|exemplo|asdf|qwerty|admin|noreply)@/.test(email.toLowerCase())) {
    return false;
  }
  
  return true;
};

const validatePhone = (phone: string): boolean => {
  if (!phone) return false;
  
  // Validar formato E.164 brasileiro
  if (!/^\+55\d{10,11}$/.test(phone)) return false;
  
  const cleanPhone = phone.replace(/\D/g, '');
  const ddd = parseInt(cleanPhone.substring(2, 4));
  const number = cleanPhone.substring(4);
  
  // Validar DDD
  if (!VALID_DDDS.includes(ddd)) return false;
  
  // Rejeitar números sequenciais
  if (/^(\d)\1+$/.test(number)) return false;
  if (/^(0123456789|9876543210)/.test(number)) return false;
  
  // Validar padrão de celular (9 dígitos começando com 9) ou fixo (8 dígitos)
  if (number.length === 9) {
    // Celular: deve começar com 9
    return number[0] === '9';
  } else if (number.length === 8) {
    // Fixo: não deve começar com 9
    return number[0] !== '9';
  }
  
  return false;
};

const validateCPF = (cpf: string): boolean => {
  if (!cpf) return false;
  
  const cleaned = cleanCPF(cpf);
  if (cleaned.length !== 11) return false;
  
  // Rejeitar CPFs com todos dígitos iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validar checksum matemático
  return validateCPFChecksum(cleaned);
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
  user_id: string;
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

interface DisablePlanRequest {
  operation: 'disable_plan';
  email: string;
}

interface ActivatePlanManualRequest {
  operation: 'activate_plan_manual';
  patient_email: string;
  patient_id?: string;
  plan_code: string;
  duration_days: number;
  send_email?: boolean;
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

    if (!supabaseServiceRoleKey || !supabaseUrl) {
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
          console.error('[upsert_patient] Auth error:', authError.message);
          throw authError;
        }

        const userId = authData?.user?.id || null;

        console.log('[upsert_patient] User registration:', { 
          userId,
          status: authData ? 'created' : 'already_exists'
        });

        // ✅ Gravar métrica de cadastro (apenas se for novo usuário)
        if (authData?.user) {
          try {
            await supabase
              .from('metrics')
              .insert({
                metric_type: 'registration',
                patient_email: email,
                platform: 'site',
                status: 'completed',
                metadata: { user_id: userId, phone: phone_e164 }
              });
            console.log('[upsert_patient] ✅ Métrica de cadastro gravada');
          } catch (metricError) {
            console.error('[upsert_patient] Erro ao gravar métrica:', metricError);
          }
        }

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
        
        const cpfClean = cleanCPF(profileData.cpf);
        if (!validateCPF(cpfClean)) {
          return new Response(
            JSON.stringify({ error: 'CPF inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for duplicate CPF
        const { data: existingPatient } = await supabase
          .from('patients')
          .select('id')
          .eq('cpf', cpfClean)
          .neq('id', profileData.user_id)
          .maybeSingle();

        if (existingPatient) {
          return new Response(
            JSON.stringify({ error: 'CPF já cadastrado' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!validateDate(profileData.birth_date)) {
          return new Response(
            JSON.stringify({ error: 'Data de nascimento inválida' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Validate user_id
        if (!profileData.user_id) {
          console.error('[complete_profile] Missing user_id');
          return new Response(
            JSON.stringify({ error: 'user_id é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[complete_profile] Processing profile:', {
          user_id: profileData.user_id,
          has_plano: profileData.plano
        });
        
        // Prepare GAS API payload with validated data
        const gasPayload = {
          user_id: profileData.user_id,
          first_name: profileData.first_name.substring(0, 100),
          last_name: profileData.last_name.substring(0, 100),
          email: profileData.email.substring(0, 255),
          phone: profileData.phone,
          cpf: cpfClean,
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
        const gasTarget = `${gasBase}?path=site-register`;
        
        const gasResponse = await fetch(gasTarget, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gasPayload)
        });

        const gasResult = await gasResponse.text();

        console.log('[complete_profile] GAS Response status:', gasResponse.status);

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

      case 'disable_plan': {
        const { email } = body as DisablePlanRequest;
        
        if (!validateEmail(email)) {
          return new Response(
            JSON.stringify({ error: 'Email inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Check if user is admin
        const token = authHeader!.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: 'Não autorizado' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (!roles || roles.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Apenas administradores podem desabilitar planos' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Disable the plan
        const { data: updatedPlan, error: updateError } = await supabase
          .from('patient_plans')
          .update({ 
            status: 'inactive',
            updated_at: new Date().toISOString()
          })
          .eq('email', email)
          .eq('status', 'active')
          .select();
        
        if (updateError) {
          console.error('[disable_plan] Error:', updateError);
          return new Response(
            JSON.stringify({ error: 'Erro ao desabilitar plano' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!updatedPlan || updatedPlan.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Nenhum plano ativo encontrado para este email' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('[disable_plan] Plan disabled:', { email, plan: updatedPlan[0] });
        
        return new Response(
          JSON.stringify({ 
            success: true,
            message: `Plano desabilitado com sucesso para ${email}`,
            plan: updatedPlan[0]
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'activate_plan_manual': {
        // Validar admin
        const token = authHeader!.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar se é admin
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        
        if (!roles?.some((r: any) => r.role === 'admin')) {
          return new Response(
            JSON.stringify({ error: 'Forbidden - Admin only' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { 
          patient_email, 
          patient_id, 
          plan_code, 
          duration_days,
          send_email 
        } = body;

        // Validar dados
        if (!patient_email || !plan_code || !duration_days) {
          return new Response(
            JSON.stringify({ 
              error: 'Missing required fields: patient_email, plan_code, duration_days' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Calcular data de expiração
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(duration_days));

        // Buscar user_id se não fornecido
        let userId = patient_id;
        if (!userId) {
          const { data: patient } = await supabase
            .from('patients')
            .select('id')
            .eq('email', patient_email)
            .single();
          
          userId = patient?.id;
        }

        // Upsert plano na tabela patient_plans
        const { error: upsertError } = await supabase
          .from('patient_plans')
          .upsert({
            user_id: userId,
            email: patient_email.toLowerCase().trim(),
            plan_code: plan_code,
            status: 'active',
            plan_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'email'
          });

        if (upsertError) {
          console.error('[activate_plan_manual] Error upserting plan:', upsertError);
          return new Response(
            JSON.stringify({ error: upsertError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Sincronizar email na tabela patients (se necessário)
        if (userId) {
          await supabase
            .from('patients')
            .update({ email: patient_email })
            .eq('id', userId);
        }

        // Registrar métrica de auditoria
        await supabase.from('metrics').insert({
          metric_type: 'manual_plan_activation',
          patient_email: patient_email,
          plan_code: plan_code,
          status: 'success',
          platform: 'admin_dashboard',
          metadata: {
            activated_by_admin: user.email,
            duration_days: duration_days,
            expires_at: expiresAt.toISOString(),
            timestamp: new Date().toISOString()
          }
        });

        console.log('[activate_plan_manual] Plan activated successfully:', {
          patient_email,
          plan_code,
          expires_at: expiresAt.toISOString(),
          activated_by: user.email
        });

        // TODO: Enviar email (opcional)
        if (send_email) {
          console.log('[activate_plan_manual] Email notification queued for:', patient_email);
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Plan activated successfully',
            expires_at: expiresAt.toISOString()
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
