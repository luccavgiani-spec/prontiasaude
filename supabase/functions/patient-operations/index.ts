import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { getCorsHeaders } from '../common/cors.ts';
import { validateCPF as validateCPFChecksum, cleanCPF } from '../common/cpf-validator.ts';

const corsHeaders = getCorsHeaders();

// ============================================================
// ✅ CONSTANTES E HELPERS PARA SYNC CLICKLIFE DE DEPENDENTES
// ============================================================

// Planos FAMILIARES que incluem especialistas → planoid 1238 na ClickLife
const PLANOS_FAMILIARES_COM_ESPECIALISTAS = [
  'FAM_COM_ESP_1M',
  'FAM_COM_ESP_3M',
  'FAM_COM_ESP_6M',
  'FAM_COM_ESP_12M',
];

// Planos FAMILIARES sem especialistas → planoid 1237 na ClickLife
const PLANOS_FAMILIARES_SEM_ESPECIALISTAS = [
  'FAM_SEM_ESP_1M',
  'FAM_SEM_ESP_3M',
  'FAM_SEM_ESP_6M',
  'FAM_SEM_ESP_12M',
  'FAMILY',
  'FAM_BASIC',
];

// Função para determinar planoid de dependente familiar
function getClickLifePlanIdForDependente(planCode: string | undefined | null): number {
  if (!planCode) return 1237;
  if (PLANOS_FAMILIARES_COM_ESPECIALISTAS.includes(planCode)) return 1238;
  // Planos empresariais familiares também têm especialistas
  if (planCode.startsWith('EMPRESA_')) return 1238;
  return 1237;
}

// Normalizar gênero para 'M' | 'F'
function normalizeGender(gender: string | undefined | null): 'M' | 'F' {
  if (!gender) return 'F';
  const g = gender.trim().toUpperCase();
  if (g === 'M' || g === 'MALE' || g === 'MASCULINO') return 'M';
  if (g === 'F' || g === 'FEMALE' || g === 'FEMININO') return 'F';
  return 'F';
}

// Normalizar telefone (robusto) - NÃO usar fallback placeholder
function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, '');
  // Se começa com 55 e tem pelo menos 12 dígitos (55 + DDD + 8/9 dígitos), remover 55
  if (clean.startsWith('55') && clean.length >= 12) {
    clean = clean.substring(2);
  }
  // Bloquear número placeholder conhecido
  if (clean === '11999999999' || clean === '5511999999999') {
    console.warn('[normalizePhone] Telefone placeholder detectado - rejeitando');
    return null;
  }
  // Garantir que tem pelo menos 10 dígitos (DDD + número)
  if (clean.length < 10) {
    console.warn('[normalizePhone] Telefone muito curto:', clean);
    return null;
  }
  return clean;
}

// Interface para resultado do sync ClickLife
interface ClickLifeSyncResult {
  success: boolean;
  status: 'ok' | 'failed' | 'partial';
  error_message?: string;
  details?: Record<string, any>;
}

// Função para sincronizar dependente na ClickLife
async function syncDependenteClickLife(
  dependente: {
    cpf: string;
    nome: string;
    email: string;
    telefone: string | undefined | null;
    sexo: string | undefined | null;
    birthDate?: string | null;
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    cidade?: string | null;
    estado?: string | null;
  },
  titularCpf: string,
  planoid: number
): Promise<ClickLifeSyncResult> {
  const CLICKLIFE_API = Deno.env.get('CLICKLIFE_API_BASE');
  const INTEGRATOR_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN');
  const PATIENT_PASSWORD = Deno.env.get('CLICKLIFE_PATIENT_DEFAULT_PASSWORD');

  if (!CLICKLIFE_API || !INTEGRATOR_TOKEN) {
    console.error('[syncDependenteClickLife] ❌ Credenciais ClickLife não configuradas');
    return { success: false, status: 'failed', error_message: 'ClickLife credentials not configured' };
  }

  const cpfLimpo = dependente.cpf.replace(/\D/g, '');
  const titularCpfLimpo = titularCpf.replace(/\D/g, '');
  const details: Record<string, any> = {};

  try {
    console.log('[syncDependenteClickLife] 🔄 Iniciando sync ClickLife para dependente');
    console.log('[syncDependenteClickLife] CPF dependente:', cpfLimpo.substring(0, 3) + '***');
    console.log('[syncDependenteClickLife] CPF titular:', titularCpfLimpo.substring(0, 3) + '***');
    console.log('[syncDependenteClickLife] Planoid:', planoid);

    // ================================
    // PASSO 1: Verificar se dependente já existe na ClickLife
    // ================================
    console.log('[ClickLife Dependente] 1️⃣ Verificando se dependente existe...');
    
    const checkUserRes = await fetch(`${CLICKLIFE_API}/usuarios/obter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authtoken': INTEGRATOR_TOKEN
      },
      body: JSON.stringify({
        authtoken: INTEGRATOR_TOKEN,
        cpfpaciente: cpfLimpo
      })
    });
    
    const checkUserData = await checkUserRes.json();
    details.user_check = checkUserData;
    
    // Checagem robusta: verificar múltiplos campos possíveis
    const userExists = checkUserRes.ok && (
      checkUserData?.cpf || 
      checkUserData?.data?.cpf || 
      checkUserData?.usuario?.cpf ||
      (checkUserData?.sucesso === true && (checkUserData?.mensagem || '').toLowerCase().includes('encontrado'))
    );
    console.log('[ClickLife Dependente] Usuário existe?', userExists);

    // ================================
    // PASSO 2: Cadastrar usuário se não existir
    // ================================
    if (!userExists) {
      console.log('[ClickLife Dependente] 2️⃣ Cadastrando dependente...');
      
      // Normalizar telefone de forma robusta
      const telefoneLimpo = normalizePhone(dependente.telefone);
      const numero = telefoneLimpo.substring(2); // Remove DDD

      // Normalizar data de nascimento para DD-MM-YYYY
      let birthDateFormatted = '01-01-1990';
      if (dependente.birthDate) {
        const bd = dependente.birthDate;
        if (bd.includes('-')) {
          const parts = bd.split('-');
          if (parts.length === 3 && parts[0].length === 4) {
            // YYYY-MM-DD -> DD-MM-YYYY
            birthDateFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else if (parts.length === 3) {
            birthDateFormatted = bd;
          }
        }
      }

      // Normalizar gênero
      const sexoNormalizado = normalizeGender(dependente.sexo);

      const registerPayload = {
        nome: dependente.nome,
        cpf: cpfLimpo,
        email: dependente.email,
        senha: PATIENT_PASSWORD || 'Pronto@2024',
        datanascimento: birthDateFormatted,
        sexo: sexoNormalizado,
        telefone: numero,
        logradouro: dependente.logradouro || 'Rua Exemplo',
        numero: dependente.numero || '123',
        bairro: 'Centro', // Fallback fixo (não existe em patients)
        cep: (dependente.cep || '01000000').replace(/\D/g, ''),
        cidade: dependente.cidade || 'São Paulo',
        estado: dependente.estado || 'SP',
        empresaid: 9083,
        planoid: planoid
      };

      console.log('[ClickLife Dependente] Payload cadastro:', {
        ...registerPayload,
        senha: '***',
        cpf: cpfLimpo.substring(0, 3) + '***'
      });

      const registerRes = await fetch(`${CLICKLIFE_API}/usuarios/usuarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authtoken': INTEGRATOR_TOKEN
        },
        body: JSON.stringify(registerPayload)
      });

      const registerData = await registerRes.json();
      details.user_register = registerData;
      console.log('[ClickLife Dependente] Resposta cadastro:', registerData);

      // Tolerar "já cadastrado" como sucesso
      const msgLower = (registerData.mensagem || '').toLowerCase();
      if (!registerRes.ok && !msgLower.includes('já cadastrado') && !msgLower.includes('ja cadastrado')) {
        console.error('[ClickLife Dependente] ❌ Falha ao cadastrar:', registerData);
        return { 
          success: false, 
          status: 'failed', 
          error_message: registerData.mensagem || 'Erro ao cadastrar dependente',
          details 
        };
      }
    }

    // ================================
    // PASSO 3: Verificar se já está vinculado como dependente
    // ================================
    console.log('[ClickLife Dependente] 3️⃣ Verificando vínculo com titular...');
    
    const checkDepsRes = await fetch(`${CLICKLIFE_API}/usuarios/obter-dependentes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authtoken': INTEGRATOR_TOKEN
      },
      body: JSON.stringify({
        authtoken: INTEGRATOR_TOKEN,
        cpftitular: titularCpfLimpo
      })
    });

    const checkDepsData = await checkDepsRes.json();
    details.dependente_check = checkDepsData;
    
    // Verificar se CPF do dependente está na lista
    const dependentes = checkDepsData?.dependentes || checkDepsData?.data || [];
    const jaVinculado = Array.isArray(dependentes) && 
      dependentes.some((d: any) => (d.cpf || '').replace(/\D/g, '') === cpfLimpo);
    
    console.log('[ClickLife Dependente] Já vinculado?', jaVinculado);

    // ================================
    // PASSO 4: Vincular dependente ao titular se necessário
    // ================================
    if (!jaVinculado) {
      console.log('[ClickLife Dependente] 4️⃣ Vinculando dependente ao titular...');
      
      const linkPayload = {
        authtoken: INTEGRATOR_TOKEN,
        cpftitular: titularCpfLimpo,
        cpfdependente: cpfLimpo,
        nomedependente: dependente.nome
      };

      const linkRes = await fetch(`${CLICKLIFE_API}/usuarios/cadastrar-dependente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authtoken': INTEGRATOR_TOKEN
        },
        body: JSON.stringify(linkPayload)
      });

      const linkData = await linkRes.json();
      details.dependente_link = linkData;
      console.log('[ClickLife Dependente] Resposta vínculo:', linkData);

      // Tolerar "já vinculado" como sucesso
      const msgLower = (linkData.mensagem || '').toLowerCase();
      if (!linkRes.ok && !msgLower.includes('já') && !msgLower.includes('ja')) {
        console.warn('[ClickLife Dependente] ⚠️ Falha ao vincular (continuando para ativação):', linkData);
      }
    }

    // ================================
    // PASSO 5: Ativar dependente no plano familiar
    // ================================
    console.log('[ClickLife Dependente] 5️⃣ Ativando no plano familiar...');
    
    const activatePayload = {
      authtoken: INTEGRATOR_TOKEN,
      cpf: cpfLimpo,
      empresaid: 9083,
      planoid: planoid,
      proposito: 'Ativar'
    };

    const activateRes = await fetch(`${CLICKLIFE_API}/usuarios/ativacao`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authtoken': INTEGRATOR_TOKEN
      },
      body: JSON.stringify(activatePayload)
    });

    const activateData = await activateRes.json();
    details.activation = activateData;
    console.log('[ClickLife Dependente] Resposta ativação:', activateData);

    // Tolerar "já ativo" como sucesso
    const msgLower = (activateData.mensagem || '').toLowerCase();
    if (!activateRes.ok && !msgLower.includes('já ativo') && !msgLower.includes('ja ativo')) {
      return { 
        success: false, 
        status: 'partial',
        error_message: activateData.mensagem || 'Erro ao ativar dependente',
        details 
      };
    }

    console.log('[ClickLife Dependente] ✅ Sync completo com sucesso!');
    return { success: true, status: 'ok', details };

  } catch (error) {
    console.error('[ClickLife Dependente] ❌ Exception:', error);
    return { 
      success: false, 
      status: 'failed', 
      error_message: error instanceof Error ? error.message : 'Exception during sync',
      details: { ...details, exception: String(error) }
    };
  }
}

// ============================================================
// FIM HELPERS CLICKLIFE
// ============================================================

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

interface ChangePlanRequest {
  operation: 'change_plan';
  plan_id: string;
  new_plan_code: string;
  new_expires_at?: string;
}

interface ActivatePlanManualRequest {
  operation: 'activate_plan_manual';
  patient_email: string;
  patient_id?: string;
  plan_code: string;
  duration_days: number;
  send_email?: boolean;
}

interface InviteFamiliarRequest {
  operation: 'invite-familiar';
  plan_id: string;
  email: string;
}

interface ResendFamilyInviteRequest {
  operation: 'resend-family-invite';
  invite_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ✅ Usar URLs hardcoded do projeto de PRODUÇÃO para evitar problemas cross-project
    const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
    const supabaseServiceRoleKey = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') 
      || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const gasBase = Deno.env.get('GAS_BASE');

    if (!supabaseServiceRoleKey) {
      throw new Error('Missing required environment variables');
    }

    // Get authenticated user from JWT (except for upsert_patient which allows registration)
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(ORIGINAL_SUPABASE_URL, supabaseServiceRoleKey);
    
    const body = await req.json();
    
    // ============================================================
    // ✅ VALIDAÇÃO GENÉRICA: exceto operações que têm validação própria
    // - upsert_patient: permite registro sem auth
    // - activate_plan_manual: usa validação cross-project (Lovable Cloud)
    // ============================================================
    const AUTH_BYPASS_OPERATIONS = ['upsert_patient', 'activate_plan_manual'];
    
    if (!AUTH_BYPASS_OPERATIONS.includes(body.operation)) {
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
            status: 'cancelled',
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

      case 'change_plan': {
        const { plan_id, new_plan_code, new_expires_at } = body as ChangePlanRequest;
        
        if (!plan_id || !new_plan_code) {
          return new Response(
            JSON.stringify({ error: 'plan_id e new_plan_code são obrigatórios' }),
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
            JSON.stringify({ error: 'Apenas administradores podem alterar planos' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Build update object
        const updateData: Record<string, any> = {
          plan_code: new_plan_code,
          updated_at: new Date().toISOString()
        };
        
        if (new_expires_at) {
          updateData.plan_expires_at = new_expires_at;
        }
        
        // Update the plan
        const { data: updatedPlan, error: updateError } = await supabase
          .from('patient_plans')
          .update(updateData)
          .eq('id', plan_id)
          .select()
          .single();
        
        if (updateError) {
          console.error('[change_plan] Error:', updateError);
          return new Response(
            JSON.stringify({ error: 'Erro ao alterar plano' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!updatedPlan) {
          return new Response(
            JSON.stringify({ error: 'Plano não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('[change_plan] Plan updated:', { plan_id, new_plan_code, updatedPlan });
        
        return new Response(
          JSON.stringify({ 
            success: true,
            message: `Plano alterado com sucesso`,
            plan: updatedPlan
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deactivate_plan_manual': {
        // ============================================================
        // ✅ REMOVER/CANCELAR PLANO MANUALMENTE
        // Usado pelo painel admin para desativar plano de um paciente
        // CORRIGIDO: Buscar por EMAIL (não por id), pois email é a chave de referência
        // ============================================================
        
        const { patient_email } = body;
        
        if (!patient_email) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing patient_email' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const normalizedEmail = patient_email.toLowerCase().trim();
        console.log('[deactivate_plan_manual] Desativando plano para email:', normalizedEmail);
        
        // Atualizar status para 'cancelled' no banco de PRODUÇÃO
        // CORRIGIDO: Usar .eq('email', email) - email é a chave de referência na produção
        const { error: updateError, count } = await supabase
          .from('patient_plans')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('email', normalizedEmail);
        
        if (updateError) {
          console.error('[deactivate_plan_manual] Erro:', updateError.message);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Failed to deactivate plan',
              details: updateError.message 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('[deactivate_plan_manual] ✅ Plano desativado com sucesso para:', normalizedEmail);
        
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Plan deactivated successfully'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'activate_plan_manual': {
        // ============================================================
        // ✅ ARQUITETURA CROSS-PROJECT:
        // 1. Validar token no LOVABLE CLOUD (onde admin fez login)
        // 2. Verificar role admin no LOVABLE CLOUD
        // 3. Executar ativação no BANCO DE PRODUÇÃO
        // ============================================================
        
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token) {
          return new Response(
            JSON.stringify({ success: false, step: 'admin_auth', error: 'No token provided' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ✅ PASSO 1: Criar client do LOVABLE CLOUD para validar o JWT
        const LOVABLE_CLOUD_URL = 'https://yrsjluhhnhxogdgnbnya.supabase.co';
        const LOVABLE_CLOUD_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyc2psdWhobmh4b2dkZ25ibnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjY1NzUsImV4cCI6MjA4MzgwMjU3NX0.fdF2KZage73BDDM0Shs7cMRLnJdFPUef866R5vZBmnY';
        
        const authClient = createClient(LOVABLE_CLOUD_URL, LOVABLE_CLOUD_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } }
        });

        // ✅ PASSO 2: Validar token EXPLICITAMENTE usando getUser(token) no Lovable Cloud
        console.log('[activate_plan_manual] Validando token no Lovable Cloud...');
        console.log('[activate_plan_manual] Token recebido (primeiros 20 chars):', token.substring(0, 20) + '...');
        
        // IMPORTANTE: Passar token explicitamente para getUser()
        const { data: authData, error: authError } = await authClient.auth.getUser(token);
        
        if (authError || !authData?.user) {
          console.error('[activate_plan_manual] Token inválido no Lovable Cloud:', authError?.message);
          console.error('[activate_plan_manual] Auth error code:', authError?.code);
          
          // Verificar se é token anon/público (fallback de sessão não autenticada)
          const isAnonToken = token.includes('"role":"anon"') || 
                              (!authData?.user && !authError?.message?.includes('expired'));
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              step: 'admin_auth', 
              error: isAnonToken 
                ? 'Sessão do Admin não encontrada - faça login novamente'
                : 'Token inválido - não foi possível validar no servidor de auth',
              details: authError?.message || 'No user data returned'
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const adminUserId = authData.user.id;
        const adminEmail = authData.user.email;
        console.log('[activate_plan_manual] ✅ Token válido. Admin user:', { id: adminUserId, email: adminEmail });

        // ✅ PASSO 3: Verificar role admin no Lovable Cloud
        console.log('[activate_plan_manual] Verificando role admin no Lovable Cloud...');
        const { data: roles, error: rolesError } = await authClient
          .from('user_roles')
          .select('role')
          .eq('user_id', adminUserId);
        
        if (rolesError) {
          console.error('[activate_plan_manual] Erro ao buscar roles:', rolesError.message);
          return new Response(
            JSON.stringify({ 
              success: false, 
              step: 'admin_role_check', 
              error: 'Failed to check admin role',
              details: rolesError.message 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const isAdmin = roles?.some((r: any) => r.role === 'admin');
        console.log('[activate_plan_manual] Roles encontradas:', roles, '| É admin?', isAdmin);
        
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              step: 'admin_role_check', 
              error: 'Forbidden - Admin role required',
              details: `User ${adminEmail} does not have admin role` 
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ✅ Admin validado! Agora executar no banco de PRODUÇÃO
        console.log('[activate_plan_manual] ✅ Admin validado! Executando no banco de produção...');

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
              success: false,
              step: 'validation',
              error: 'Missing required fields: patient_email, plan_code, duration_days' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Calcular data de expiração (formato DATE para o banco)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(duration_days));
        const expiresAtDate = expiresAt.toISOString().split('T')[0]; // YYYY-MM-DD

        // ✅ PASSO 4: Buscar paciente no banco de PRODUÇÃO (com fallback para criar)
        // CORRIGIDO: Implementa fallback resiliente para criar o paciente se não existir
        const normalizedPatientEmail = patient_email.toLowerCase().trim();
        console.log('[activate_plan_manual] ========================================');
        console.log('[activate_plan_manual] 🔍 Buscando paciente:', normalizedPatientEmail);
        console.log('[activate_plan_manual] patient_id recebido:', patient_id || '(não informado)');
        
        let patient: { id: string; user_id: string | null } | null = null;
        let patientLookupMethod = 'none';

        // TENTATIVA 1: Buscar por patient_id (se fornecido como patients.id)
        if (patient_id) {
          console.log('[activate_plan_manual] 1️⃣ Tentando buscar por patient_id:', patient_id);
          const { data: patientById, error: errById } = await supabase
            .from('patients')
            .select('id, user_id')
            .eq('id', patient_id)
            .maybeSingle();
          
          if (!errById && patientById) {
            patient = patientById;
            patientLookupMethod = 'by_patient_id';
            console.log('[activate_plan_manual] ✅ Encontrado por patient_id:', { id: patient.id, user_id: patient.user_id });
          } else {
            console.log('[activate_plan_manual] ❌ Não encontrado por patient_id');
          }
        }

        // TENTATIVA 2: Buscar por email
        if (!patient) {
          console.log('[activate_plan_manual] 2️⃣ Tentando buscar por email:', normalizedPatientEmail);
          const { data: patientByEmail, error: errByEmail } = await supabase
            .from('patients')
            .select('id, user_id')
            .eq('email', normalizedPatientEmail)
            .maybeSingle();

          if (errByEmail) {
            console.error('[activate_plan_manual] Erro na busca por email:', errByEmail.message);
            return new Response(
              JSON.stringify({ 
                success: false, 
                step: 'patient_lookup', 
                error: 'Database error looking up patient by email',
                details: errByEmail.message 
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          if (patientByEmail) {
            patient = patientByEmail;
            patientLookupMethod = 'by_email';
            console.log('[activate_plan_manual] ✅ Encontrado por email:', { id: patient.id, user_id: patient.user_id });
          } else {
            console.log('[activate_plan_manual] ❌ Não encontrado por email');
          }
        }

        // TENTATIVA 3: Se não encontrou paciente, NÃO criar - prosseguir apenas com email
        // ✅ CORREÇÃO: Evita erro de FK constraint quando user_id da Produção não existe no Cloud
        if (!patient) {
          console.log('[activate_plan_manual] 3️⃣ Paciente não existe em patients - continuando sem criar');
          console.log('[activate_plan_manual] ⚠️ Plano será ativado apenas pelo email (sem vínculo com patients.id)');
          
          // Criar objeto "virtual" para compatibilidade com o código seguinte
          patient = {
            id: null,
            user_id: null
          };
          patientLookupMethod = 'email_only_no_patient_record';
        }

        // Verificação final - agora permite patient.id = null
        // pois patient_plans pode ser criado apenas com email
        console.log('[activate_plan_manual] ✅ Paciente resolvido:', { 
          patient_id: patient?.id || '(nenhum - apenas email)', 
          user_id: patient?.user_id || '(nenhum)',
          method: patientLookupMethod
        });
        console.log('[activate_plan_manual] ========================================');

        // ✅ PASSO 5: Upsert plano no banco de PRODUÇÃO
        // CORRIGIDO: email é a chave de referência (NOT NULL) no banco de produção
        // O id é um UUID autônomo - NÃO é igual ao patients.id
        // Usar normalizedPatientEmail já definido no PASSO 4
        console.log('[activate_plan_manual] Verificando plano existente para email:', normalizedPatientEmail);
        
        // Verificar se já existe plano para esse email
        const { data: existingPlan } = await supabase
          .from('patient_plans')
          .select('id')
          .eq('email', normalizedPatientEmail)
          .maybeSingle();

        let planUpsertError = null;

        if (existingPlan) {
          // UPDATE do plano existente
          console.log('[activate_plan_manual] Atualizando plano existente:', existingPlan.id);
          const { error: updateErr } = await supabase
            .from('patient_plans')
            .update({
              plan_code: plan_code,
              status: 'active',
              plan_expires_at: expiresAtDate,
              user_id: patient.user_id || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPlan.id);
          
          planUpsertError = updateErr;
        } else {
          // INSERT de novo plano - email é obrigatório (NOT NULL)
          console.log('[activate_plan_manual] Inserindo novo plano para email:', normalizedPatientEmail);
          const { error: insertErr } = await supabase
            .from('patient_plans')
            .insert({
              email: normalizedPatientEmail,
              user_id: patient.user_id || null,
              plan_code: plan_code,
              status: 'active',
              plan_expires_at: expiresAtDate
            });
          
          planUpsertError = insertErr;
        }

        if (planUpsertError) {
          console.error('[activate_plan_manual] Erro no upsert:', planUpsertError.message);
          return new Response(
            JSON.stringify({ 
              success: false, 
              step: 'plan_upsert', 
              error: 'Failed to upsert plan',
              details: planUpsertError.message
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ✅ PASSO 6: Registrar métrica de auditoria
        try {
          await supabase.from('metrics').insert({
            metric_type: 'manual_plan_activation',
            metadata: {
              patient_email: patient_email,
              plan_code: plan_code,
              activated_by_admin: adminEmail,
              duration_days: duration_days,
              expires_at: expiresAtDate,
              timestamp: new Date().toISOString()
            }
          });
        } catch (metricErr) {
          console.warn('[activate_plan_manual] Erro ao gravar métrica (não crítico):', metricErr);
        }

        console.log('[activate_plan_manual] ✅ Plano ativado com sucesso:', {
          patient_email,
          plan_code,
          expires_at: expiresAtDate,
          activated_by: adminEmail
        });

        // ✅ PASSO 7: Cadastrar na ClickLife (opcional)
        const { data: patientFull } = await supabase
          .from('patients')
          .select('cpf, first_name, last_name, phone_e164, gender, birth_date')
          .eq('email', patient_email.toLowerCase().trim())
          .maybeSingle();

        if (patientFull?.cpf) {
          const clickLifePlanoId = plan_code.includes('COM_ESP') ? 864 : 
                                    plan_code.includes('SEM_ESP') ? 863 : 
                                    plan_code.startsWith('EMPRESA_') ? 864 : 864;
          
          try {
            const { error: clicklifeError } = await supabase.functions.invoke('activate-clicklife-manual', {
              body: { 
                email: patient_email,
                plan_id: clickLifePlanoId
              }
            });
            
            if (clicklifeError) {
              console.warn('[activate_plan_manual] ⚠️ ClickLife falhou (não crítico):', clicklifeError);
            } else {
              console.log('[activate_plan_manual] ✅ ClickLife OK, planoId:', clickLifePlanoId);
            }
          } catch (clicklifeErr) {
            console.warn('[activate_plan_manual] ⚠️ ClickLife exception (não crítico):', clicklifeErr);
          }
        }

        // TODO: Enviar email (opcional)
        if (send_email) {
          console.log('[activate_plan_manual] Email notification queued for:', patient_email);
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            step: 'complete',
            message: 'Plan activated successfully',
            expires_at: expiresAtDate,
            patient_id: patient.id
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'invite-familiar': {
        const token = authHeader!.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: 'Não autorizado' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { plan_id, email } = body as InviteFamiliarRequest;

        if (!plan_id || !email) {
          return new Response(
            JSON.stringify({ error: 'plan_id e email são obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!validateEmail(email)) {
          return new Response(
            JSON.stringify({ error: 'Email inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar se o plano pertence ao usuário e é familiar
        const { data: plan, error: planError } = await supabase
          .from('patient_plans')
          .select('id, plan_code, user_id, email')
          .eq('id', plan_id)
          .eq('status', 'active')
          .single();

        if (planError || !plan) {
          return new Response(
            JSON.stringify({ error: 'Plano não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (plan.user_id !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Você não tem permissão para gerenciar este plano' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!plan.plan_code?.startsWith('FAM_') && plan.plan_code !== 'FAMILY') {
          return new Response(
            JSON.stringify({ error: 'Este recurso é apenas para planos familiares' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar se já existe convite pendente ou completo para este email
        const { data: existingInvite } = await supabase
          .from('pending_family_invites')
          .select('id, status')
          .eq('titular_plan_id', plan_id)
          .eq('email', email.toLowerCase())
          .maybeSingle();

        if (existingInvite) {
          if (existingInvite.status === 'pending') {
            return new Response(
              JSON.stringify({ error: 'Já existe um convite pendente para este email' }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          if (existingInvite.status === 'completed') {
            return new Response(
              JSON.stringify({ error: 'Este familiar já está cadastrado no plano' }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Contar familiares existentes (máximo 3)
        const { count } = await supabase
          .from('pending_family_invites')
          .select('*', { count: 'exact', head: true })
          .eq('titular_plan_id', plan_id)
          .in('status', ['pending', 'completed']);

        if ((count || 0) >= 3) {
          return new Response(
            JSON.stringify({ error: 'Limite de 3 familiares atingido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Gerar token único
        const inviteToken = crypto.randomUUID();

        // Buscar patient_id do titular para a coluna titular_patient_id
        const { data: titularPatient } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!titularPatient?.id) {
          console.error('[invite-familiar] Titular patient not found for user:', user.id);
          return new Response(
            JSON.stringify({ error: 'Perfil do titular não encontrado' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Inserir convite com colunas CORRETAS: titular_patient_id e token
        const { error: insertError } = await supabase
          .from('pending_family_invites')
          .insert({
            titular_patient_id: titularPatient.id,
            titular_plan_id: plan_id,
            email: email.toLowerCase(),
            token: inviteToken,
            status: 'pending',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });

        if (insertError) {
          console.error('[invite-familiar] Insert error:', insertError);
          return new Response(
            JSON.stringify({ error: 'Erro ao criar convite' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Enviar email
        try {
          const inviteLink = `https://prontiasaude.com.br/completar-perfil?token_familiar=${inviteToken}`;
          
          // Buscar nome do titular
          const { data: titular } = await supabase
            .from('patients')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();

          const titularName = titular 
            ? `${titular.first_name || ''} ${titular.last_name || ''}`.trim()
            : 'Um membro';

          await supabase.functions.invoke('send-form-emails', {
            body: {
              type: 'family-invite',
              data: {
                email: email.toLowerCase(),
                titularName,
                inviteLink
              }
            }
          });
        } catch (emailError) {
          console.error('[invite-familiar] Email error:', emailError);
          // Não falhar se email não enviar
        }

        console.log('[invite-familiar] Invite created:', { plan_id, email });

        return new Response(
          JSON.stringify({ success: true, message: 'Convite enviado com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'resend-family-invite': {
        const token = authHeader!.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: 'Não autorizado' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { invite_id } = body as ResendFamilyInviteRequest;

        // Buscar patient_id do titular
        const { data: titularPatient } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!titularPatient?.id) {
          return new Response(
            JSON.stringify({ error: 'Perfil do titular não encontrado' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Buscar convite usando colunas CORRETAS: titular_patient_id e token
        const { data: invite, error: inviteError } = await supabase
          .from('pending_family_invites')
          .select('*, patient_plans(plan_code)')
          .eq('id', invite_id)
          .eq('titular_patient_id', titularPatient.id)
          .eq('status', 'pending')
          .single();

        if (inviteError || !invite) {
          return new Response(
            JSON.stringify({ error: 'Convite não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Gerar novo token e atualizar expiração
        const newToken = crypto.randomUUID();
        const newExpires = new Date();
        newExpires.setDate(newExpires.getDate() + 7);

        // Usar coluna CORRETA: token (não invite_token)
        await supabase
          .from('pending_family_invites')
          .update({
            token: newToken,
            expires_at: newExpires.toISOString()
          })
          .eq('id', invite_id);

        // Reenviar email
        try {
          const inviteLink = `https://prontiasaude.com.br/completar-perfil?token_familiar=${newToken}`;
          
          const { data: titular } = await supabase
            .from('patients')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();

          const titularName = titular 
            ? `${titular.first_name || ''} ${titular.last_name || ''}`.trim()
            : 'Um membro';

          await supabase.functions.invoke('send-form-emails', {
            body: {
              type: 'family-invite',
              data: {
                email: invite.email,
                titularName,
                inviteLink
              }
            }
          });
        } catch (emailError) {
          console.error('[resend-family-invite] Email error:', emailError);
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Convite reenviado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'activate-family-member': {
        // Este endpoint será chamado pelo CompletarPerfil quando um familiar completar cadastro
        const { invite_token, user_id: passedUserId } = body;

        if (!invite_token) {
          return new Response(
            JSON.stringify({ error: 'Token de convite é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Buscar convite válido usando coluna CORRETA: token (não invite_token)
        const { data: invite, error: inviteError } = await supabase
          .from('pending_family_invites')
          .select('*, patient_plans(plan_code, plan_expires_at)')
          .eq('token', invite_token)
          .eq('status', 'pending')
          .single();

        if (inviteError || !invite) {
          return new Response(
            JSON.stringify({ error: 'Convite inválido ou já utilizado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (new Date(invite.expires_at) < new Date()) {
          return new Response(
            JSON.stringify({ error: 'Convite expirado' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ✅ PRIORIZAR user_id passado pelo frontend (usuários existentes)
        let memberId = passedUserId;
        
        // Se não foi passado user_id, buscar por email
        if (!memberId) {
          const { data: authUser } = await supabase.auth.admin.getUserByEmail(invite.email);
          memberId = authUser?.user?.id;
        }

        console.log('[activate-family-member] Processing:', { 
          invite_email: invite.email, 
          passed_user_id: passedUserId,
          resolved_member_id: memberId 
        });

        // ✅ Garantir que existe registro em patients (upsert)
        if (memberId) {
          const { error: patientError } = await supabase
            .from('patients')
            .upsert({
              id: memberId,
              email: invite.email,
              profile_complete: false,
              updated_at: new Date().toISOString()
            }, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            });
          
          if (patientError) {
            console.error('[activate-family-member] Patient upsert error:', patientError);
            // Não bloquear - apenas logar
          }
        }

        // ✅ Verificar se já existe plano ativo para evitar duplicação
        const { data: existingPlan } = await supabase
          .from('patient_plans')
          .select('id, plan_code')
          .eq('email', invite.email)
          .eq('status', 'active')
          .maybeSingle();

        if (existingPlan) {
          console.log('[activate-family-member] User already has active plan:', existingPlan.plan_code);
          
          // Marcar convite como completo mesmo assim (usar accepted_at, não completed_at)
          await supabase
            .from('pending_family_invites')
            .update({
              status: 'completed',
              accepted_at: new Date().toISOString()
            })
            .eq('id', invite.id);

          return new Response(
            JSON.stringify({ 
              success: true, 
              plan_code: existingPlan.plan_code,
              message: 'Usuário já possui plano ativo'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Criar plano para o familiar
        const { error: planError } = await supabase
          .from('patient_plans')
          .insert({
            user_id: memberId,
            email: invite.email,
            plan_code: invite.patient_plans?.plan_code || 'FAM_BASIC',
            plan_expires_at: invite.patient_plans?.plan_expires_at,
            status: 'active'
          });

        if (planError) {
          console.error('[activate-family-member] Plan error:', planError);
          return new Response(
            JSON.stringify({ error: 'Erro ao ativar plano do familiar' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Marcar convite como completo (usar accepted_at, não completed_at)
        await supabase
          .from('pending_family_invites')
          .update({
            status: 'completed',
            accepted_at: new Date().toISOString()
          })
          .eq('id', invite.id);

        // ============================================================
        // ✅ NOVO: Sincronizar dependente na ClickLife
        // ============================================================
        let clicklife_sync: 'ok' | 'failed' | 'partial' | 'skipped' = 'skipped';
        let clicklife_error_message: string | undefined;
        let resolvedPlanCode: string | undefined;

        try {
          // Buscar dados completos do dependente
          const { data: dependenteData } = await supabase
            .from('patients')
            .select('cpf, first_name, last_name, phone_e164, gender, birth_date, cep, address_line, address_number, city, state')
            .eq('email', invite.email)
            .maybeSingle();

          // Buscar CPF do titular usando coluna CORRETA: titular_patient_id
          const { data: titularData } = await supabase
            .from('patients')
            .select('cpf')
            .eq('id', invite.titular_patient_id)
            .single();

          // Buscar plan_code REAL do plano do titular (não confiar no join)
          const { data: titularPlanData } = await supabase
            .from('patient_plans')
            .select('plan_code')
            .eq('id', invite.titular_plan_id)
            .maybeSingle();

          const planCode = titularPlanData?.plan_code || invite.patient_plans?.plan_code || 'FAMILY';
          resolvedPlanCode = planCode;

          if (dependenteData?.cpf && titularData?.cpf) {
            const planoid = getClickLifePlanIdForDependente(planCode);
            
            console.log('[activate-family-member] 🔄 Iniciando sync ClickLife');
            console.log('[activate-family-member] Plan code do titular:', planCode, '→ planoid:', planoid);

            const syncResult = await syncDependenteClickLife(
              {
                cpf: dependenteData.cpf,
                nome: `${dependenteData.first_name || ''} ${dependenteData.last_name || ''}`.trim() || 'Dependente',
                email: invite.email,
                telefone: dependenteData.phone_e164,
                sexo: dependenteData.gender,
                birthDate: dependenteData.birth_date,
                cep: dependenteData.cep,
                logradouro: dependenteData.address_line,
                numero: dependenteData.address_number,
                cidade: dependenteData.city,
                estado: dependenteData.state
              },
              titularData.cpf,
              planoid
            );

            clicklife_sync = syncResult.status;
            clicklife_error_message = syncResult.error_message;

            // Registrar métrica
            await supabase.from('metrics').insert({
              metric_type: 'clicklife_family_activation',
              status: syncResult.success ? 'success' : 'failed',
              patient_email: invite.email,
              plan_code: planCode,
              metadata: {
                planoid,
                titular_cpf_masked: titularData.cpf.substring(0, 3) + '***',
                dependente_cpf_masked: dependenteData.cpf.substring(0, 3) + '***',
                sync_status: syncResult.status,
                error: syncResult.error_message
              }
            });

            if (syncResult.success) {
              console.log('[activate-family-member] ✅ ClickLife sync OK');
            } else {
              console.warn('[activate-family-member] ⚠️ ClickLife sync:', syncResult.status, syncResult.error_message);
            }

          } else {
            console.warn('[activate-family-member] ⚠️ Dados insuficientes para sync ClickLife:', {
              tem_cpf_dependente: !!dependenteData?.cpf,
              tem_cpf_titular: !!titularData?.cpf
            });
            clicklife_sync = 'skipped';
            clicklife_error_message = 'Dados insuficientes (CPF dependente ou titular ausente)';
          }

        } catch (clicklifeError) {
          console.error('[activate-family-member] ❌ ClickLife sync error:', clicklifeError);
          clicklife_sync = 'failed';
          clicklife_error_message = clicklifeError instanceof Error ? clicklifeError.message : 'Exception during sync';
        }

        console.log('[activate-family-member] ✅ Family member activated:', invite.email);

        return new Response(
          JSON.stringify({ 
            success: true, 
            plan_code: resolvedPlanCode || invite.patient_plans?.plan_code,
            clicklife_sync,
            clicklife_error_message: clicklife_sync !== 'ok' ? clicklife_error_message : undefined
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ============================================================
      // ✅ ENSURE_PATIENT - Garantir que existe registro em patients (usando service_role, ignora RLS)
      // ============================================================
      case 'ensure_patient': {
        const { user_id, email } = body;
        
        console.log('[ensure_patient] 📥 Recebido:', { user_id, email });
        
        if (!user_id) {
          return new Response(
            JSON.stringify({ error: 'user_id é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Verificar se já existe registro
        const { data: existing, error: selectError } = await supabase
          .from('patients')
          .select('id, email, profile_complete')
          .eq('user_id', user_id)
          .maybeSingle();
        
        if (selectError) {
          console.error('[ensure_patient] ❌ Erro ao buscar:', selectError);
          return new Response(
            JSON.stringify({ error: selectError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (existing) {
          console.log('[ensure_patient] ✅ Registro já existe:', existing.id);
          return new Response(
            JSON.stringify({ 
              success: true, 
              patient_id: existing.id,
              profile_complete: existing.profile_complete,
              already_existed: true 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Criar novo registro (service_role ignora RLS)
        const { data: newPatient, error: insertError } = await supabase
          .from('patients')
          .insert({ 
            user_id, 
            email: email || null 
          })
          .select('id, profile_complete')
          .single();
        
        if (insertError) {
          // Ignorar conflito (registro pode ter sido criado por trigger em paralelo)
          if (insertError.code === '23505') {
            console.log('[ensure_patient] ⚠️ Conflito detectado, buscando registro existente');
            const { data: conflictPatient } = await supabase
              .from('patients')
              .select('id, profile_complete')
              .eq('user_id', user_id)
              .maybeSingle();
            
            return new Response(
              JSON.stringify({ 
                success: true, 
                patient_id: conflictPatient?.id,
                profile_complete: conflictPatient?.profile_complete,
                already_existed: true 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          console.error('[ensure_patient] ❌ Erro ao inserir:', insertError);
          return new Response(
            JSON.stringify({ error: insertError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('[ensure_patient] ✅ Novo registro criado:', newPatient?.id);
        return new Response(
          JSON.stringify({ 
            success: true, 
            patient_id: newPatient?.id,
            profile_complete: false,
            already_existed: false 
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
