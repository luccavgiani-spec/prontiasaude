// [schedule-redirect] VERSION: 2026-01-28T-v3-communicare-auto-register
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../common/cors.ts';

// ✅ ETAPA 4: Função de retry para operações críticas
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`[Retry:${operationName}] Tentativa ${attempt}/${maxAttempts} falhou:`, error);
      
      if (attempt < maxAttempts) {
        const waitTime = delayMs * attempt;
        console.log(`[Retry:${operationName}] Aguardando ${waitTime}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.error(`[Retry:${operationName}] ❌ Todas as ${maxAttempts} tentativas falharam`);
  throw lastError;
}

// Mapeamento SKU → especialidadeId ClickLife (padrão: 8 para todos)
const SKU_TO_CLICKLIFE_ID: Record<string, number> = {
  'ITC6534': 8, // Clínico Geral
  'ZXW2165': 8, // Psicólogo 1 sessão
  'HXR8516': 8, // Psicólogo 4 sessões
  'YME9025': 8, // Psicólogo 8 sessões
  'BIR7668': 8, // Personal Trainer
  'VPN5132': 8, // Nutricionista
  'TQP5720': 8, // Cardiologista
  'HGG3503': 8, // Dermatologista
  'VHH8883': 8, // Endocrinologista
  'TSB0751': 8, // Gastroenterologista
  'CCP1566': 8, // Ginecologista
  'FKS5964': 8, // Oftalmologista
  'TVQ5046': 8, // Ortopedista
  'HMG9544': 8, // Pediatra
  'HME8366': 8, // Otorrinolaringologista
  'DYY8522': 8, // Médico da Família
  'QOP1101': 8, // Psiquiatra
  'LZF3879': 8, // Nutrólogo
  'YZD9932': 8, // Geriatria
  'UDH3250': 8, // Reumatologista
  'PKS9388': 8, // Neurologista
  'MYX5186': 8, // Infectologista
  'OVM9892': 8, // Laudos Psicológicos
  'RZP5755': 8, // Renovação de Receitas
  'ULT3571': 8, // Solicitação de Exames
};

// SKUs que requerem plano 864 (especialistas)
const ESPECIALISTA_SKUS = [
  'BIR7668', 'VPN5132', 'TQP5720', 'HGG3503', 'VHH8883', 'TSB0751',
  'CCP1566', 'FKS5964', 'TVQ5046', 'HMG9544', 'HME8366', 'DYY8522',
  'QOP1101', 'LZF3879', 'YZD9932', 'UDH3250', 'PKS9388', 'MYX5186'
];

// SKUs de Psicólogo (combos)
const PSICOLOGO_SKUS = [
  'ZXW2165', // Psicólogo 1 sessão
  'HXR8516', // Psicólogo 4 sessões
  'YME9025'  // Psicólogo 8 sessões
];

// ✅ Mapeamento SKU → Nome da Especialidade para mensagens WhatsApp
const SKU_TO_SPECIALIST_NAME: Record<string, string> = {
  'BIR7668': 'Personal Trainer',
  'VPN5132': 'Nutricionista',
  'TQP5720': 'Cardiologista',
  'HGG3503': 'Dermatologista',
  'VHH8883': 'Endocrinologista',
  'TSB0751': 'Gastroenterologista',
  'CCP1566': 'Ginecologista',
  'FKS5964': 'Oftalmologista',
  'TVQ5046': 'Ortopedista',
  'HMG9544': 'Pediatra',
  'HME8366': 'Otorrinolaringologista',
  'DYY8522': 'Médico da Família',
  'QOP1101': 'Psiquiatra',
  'LZF3879': 'Nutrólogo',
  'YZD9932': 'Geriatra',
  'UDH3250': 'Reumatologista',
  'PKS9388': 'Neurologista',
  'MYX5186': 'Infectologista',
  'ZXW2165': 'Psicólogo',
  'HXR8516': 'Psicólogo',
  'YME9025': 'Psicólogo',
};

// ✅ Planos que incluem consultas com especialistas → plano_id 864 na ClickLife
const PLANOS_COM_ESPECIALISTAS = [
  'IND_COM_ESP_1M',   // Individual Completo com Especialistas - 1 Mês
  'IND_COM_ESP_3M',   // Individual Completo com Especialistas - 3 Meses
  'IND_COM_ESP_6M',   // Individual Completo com Especialistas - 6 Meses
  'IND_COM_ESP_12M',  // Individual Completo com Especialistas - 12 Meses
  'FAM_COM_ESP_1M',   // Família Completo com Especialistas - 1 Mês
  'FAM_COM_ESP_3M',   // Família Completo com Especialistas - 3 Meses
  'FAM_COM_ESP_6M',   // Família Completo com Especialistas - 6 Meses
  'FAM_COM_ESP_12M',  // Família Completo com Especialistas - 12 Meses
];

// Planos empresariais também têm acesso a especialistas
const isPlanoEmpresarial = (planCode: string | undefined) => planCode?.startsWith('EMPRESA_') ?? false;

/**
 * Normaliza strings removendo acentos, convertendo para lowercase e trim
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Mapeia valores de gênero para formato ClickLife ('M' ou 'F')
 */
function mapGender(value: string | undefined): 'M' | 'F' | null {
  if (!value) return null;
  
  const normalized = normalize(value);
  
  // Masculino
  if (['m', 'masculino', 'male', 'masc', 'homem'].includes(normalized)) {
    return 'M';
  }
  
  // Feminino
  if (['f', 'feminino', 'female', 'fem', 'mulher'].includes(normalized)) {
    return 'F';
  }
  
  return null;
}

/**
 * Mapa de nomes "pretty" para slugs (após normalização)
 */
const DISPLAY_TO_SLUG: Record<string, string> = {
  'clinico geral': 'clinico-geral',
  'psicologo - 1 sessao': 'psicologo',
  'psicologo - 4 sessoes': 'psicologo',
  'psicologo - 8 sessoes': 'psicologo',
  'psicologo 1 sessao': 'psicologo',
  'psicologo 4 sessoes': 'psicologo',
  'psicologo 8 sessoes': 'psicologo',
  'nutricionista': 'nutricionista',
  'personal trainer': 'personal-trainer',
  'geriatria': 'geriatria',
  'nutrologo': 'nutrologo',
  'infectologista': 'infectologista',
  'neurologista': 'neurologista',
  'reumatologista': 'reumatologista',
  'solicitacao de exames': 'solicitacao-exames',
  'renovacao de receitas': 'renovacao-receitas',
  'laudos psicologicos': 'laudos'
};

/**
 * Busca especialidades Communicare do banco de dados
 */
async function getCommunicareSpecialties(supabase: any): Promise<string[]> {
  const { data } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'communicare_specialties')
    .maybeSingle();

  if (data?.value) {
    try {
      const specialties = JSON.parse(data.value);
      if (Array.isArray(specialties)) {
        // ✅ Retornar RAW (sem normalize)
        console.log('[schedule-redirect] Especialidades Communicare (RAW):', specialties);
        return specialties;
      }
    } catch (e) {
      console.error('[schedule-redirect] Erro ao parsear especialidades:', e);
    }
  }

  // Fallback em formato Communicare (nomes "pretty")
  const fallback = [
    'Clínico Geral',
    'Psicólogo - 1 sessão',
    'Psicólogo - 4 sessões',
    'Psicólogo - 8 sessões',
    'Nutricionista'
  ];
  console.log('[schedule-redirect] Usando especialidades fallback');
  return fallback;
}

interface SchedulePayload {
  cpf: string;
  email: string;
  nome: string;
  telefone: string;
  especialidade?: string;
  sku: string;
  horario_iso?: string;
  plano_ativo: boolean;
  sexo?: string;
  birth_date?: string; // ✅ NOVO: Data de nascimento (formato YYYY-MM-DD)
  order_id?: string;
  payment_id?: string;
  force_provider?: 'clicklife' | 'communicare'; // ✅ NOVO: Forçar provedor (admin)
  skip_registration?: boolean; // ✅ NOVO: Pular cadastro/ativação, ir direto para atendimento (admin)
}

// Função loginClickLifePatient removida - ClickLife não suporta login via API
// O cadastro via /usuarios/usuarios já retorna o authtoken diretamente

/**
 * Registra paciente na ClickLife
 * Status 200 ou 409 (já cadastrado) são considerados sucesso
 */
async function registerClickLifePatient(
  cpf: string,
  nome: string,
  email: string,
  telefone: string,
  planoId: number,
  sexo: string,
  birthDate?: string // ✅ NOVO: Data de nascimento opcional (formato YYYY-MM-DD)
): Promise<{ success: boolean; error?: string }> {
  const CLICKLIFE_API = Deno.env.get('CLICKLIFE_API_BASE')!;
  
  const cpfClean = cpf.replace(/\D/g, '');
  const phoneClean = telefone.replace(/\D/g, '').replace(/^\+55/, '');
  
  // ✅ Converter YYYY-MM-DD para DD-MM-YYYY (formato ClickLife)
  let datanascimento = "01-01-1990"; // Fallback
  let usedFallback = true;
  
  console.log('[ClickLife] birth_date recebido:', birthDate || 'NULL');
  
  if (birthDate && birthDate !== '1990-01-01') {
    try {
      const [year, month, day] = birthDate.split('-');
      // Validar que não é data genérica
      if (year && month && day && (year !== '1990' || month !== '01' || day !== '01')) {
        datanascimento = `${day}-${month}-${year}`;
        usedFallback = false;
        console.log('[ClickLife] ✅ Data de nascimento REAL convertida:', birthDate, '→', datanascimento);
      }
    } catch (e) {
      console.warn('[ClickLife] Erro ao converter birth_date:', e);
    }
  }
  
  if (usedFallback) {
    console.warn('[ClickLife] ⚠️ FALLBACK: Usando data genérica 01-01-1990 (birth_date original:', birthDate, ')');
  }
  
  const PATIENT_PASSWORD = Deno.env.get('CLICKLIFE_PATIENT_DEFAULT_PASSWORD');
  if (!PATIENT_PASSWORD) {
    console.error('[ClickLife] ❌ CLICKLIFE_PATIENT_DEFAULT_PASSWORD não configurado');
    return { success: false, error: 'Variável de ambiente CLICKLIFE_PATIENT_DEFAULT_PASSWORD não configurada' };
  }
  
  const payload = {
    nome,
    cpf: cpfClean,
    email,
    senha: PATIENT_PASSWORD,
    datanascimento, // ✅ Agora usa valor real ou fallback
    sexo,
    telefone: phoneClean,
    logradouro: "Rua Exemplo",
    numero: "123",
    bairro: "Centro",
    cep: "01000000",
    cidade: "São Paulo",
    estado: "SP",
    empresaid: 9083,
    planoid: planoId
  };
  
  console.log('[ClickLife] Cadastrando paciente:', { cpf: cpfClean, planoId });
  
  const INTEGRATOR_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN')!;
  
  const res = await fetch(`${CLICKLIFE_API}/usuarios/usuarios`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'authtoken': INTEGRATOR_TOKEN
    },
    body: JSON.stringify(payload)
  });
  
  const resText = await res.text();
  console.log('[ClickLife] Response status:', res.status);
  
  // ✅ ETAPA 1: Detectar duplicate key mesmo em HTTP 500
  const isDuplicateKey = resText.includes('duplicate key') || 
                         resText.includes('Unique violation') ||
                         resText.includes('usuarios_email_key') ||
                         resText.includes('already exists');
  
  // 200 = atualizado, 201 = criado, 409 = já existe
  // ✅ NOVO: 500 com duplicate key também é tratado como "já existe"
  if (res.status === 200 || res.status === 201 || res.status === 409 || 
      (res.status === 500 && isDuplicateKey)) {
    
    if (res.status === 500 && isDuplicateKey) {
      console.log('[ClickLife] ⚠️ HTTP 500 com duplicate key - tratando como usuário existente');
    } else {
  console.log('[ClickLife] ✓ Paciente cadastrado ou já existente');
    }
    // ✅ SAFE PARSING: Evitar crash se resposta não for JSON
    try {
      const data = JSON.parse(resText);
      console.log('[ClickLife] Resposta cadastro:', JSON.stringify(data).substring(0, 200));
    } catch (e) {
      console.warn('[ClickLife] Resposta de cadastro não é JSON (ok se já existente):', resText.substring(0, 200));
    }
    
    // ✅ PASSO 2: Ativar o usuário usando token do integrador
    console.log('[ClickLife] Ativando usuário:', cpfClean);
    
    const activationPayload = {
      authtoken: INTEGRATOR_TOKEN,
      cpf: cpfClean,
      empresaid: 9083,
      planoid: planoId,
      proposito: "Ativar"
    };
    
    console.log('[ClickLife] Payload de ativação:', JSON.stringify({
      ...activationPayload,
      authtoken: INTEGRATOR_TOKEN.substring(0, 20) + '...' // Mascarar token nos logs
    }));
    
    const activationRes = await fetch(`${CLICKLIFE_API}/usuarios/ativacao`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'authtoken': INTEGRATOR_TOKEN
      },
      body: JSON.stringify(activationPayload)
    });
    
    // ✅ BEST-EFFORT: Ativação não bloqueia - paciente pode já estar ativo
    if (!activationRes.ok) {
      const activationError = await activationRes.text();
      console.warn('[ClickLife] ⚠️ Erro na ativação (não fatal):', activationRes.status, activationError.substring(0, 200));
      console.log('[ClickLife] Continuando mesmo assim - paciente pode já estar ativo');
      // ✅ NÃO RETORNAR ERRO - permitir criação de atendimento
    } else {
      // ✅ SAFE PARSING: Evitar crash se ClickLife retornar HTML
      const activationText = await activationRes.text();
      let activationData;
      try {
        activationData = JSON.parse(activationText);
        console.log('[ClickLife] ✓ Usuário ativado com sucesso:', JSON.stringify(activationData).substring(0, 200));
      } catch (parseError) {
        console.warn('[ClickLife] ⚠️ Resposta de ativação não é JSON válido (ok se já ativo):', activationText.substring(0, 200));
        // ✅ NÃO RETORNAR ERRO - tratado como "já ativo"
      }
    }
    
    // ✅ PASSO 3: Fazer login para obter token do usuário
    console.log('[ClickLife] Fazendo login do usuário:', cpfClean);
    
    const loginPayload = {
      cpf: cpfClean,
      senha: PATIENT_PASSWORD
    };
    
    const loginRes = await fetch(`${CLICKLIFE_API}/auth/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginPayload)
    });
    
    // ✅ BEST-EFFORT: Login não bloqueia - atendimento usa token do integrador
    if (!loginRes.ok) {
      const loginError = await loginRes.text();
      console.warn('[ClickLife] ⚠️ Erro no login (não fatal):', loginRes.status, loginError.substring(0, 200));
      console.log('[ClickLife] Continuando mesmo assim - atendimento usará token do integrador');
      // ✅ NÃO RETORNAR ERRO - atendimento pode ser criado com token do integrador
      return { success: true }; // Retornar true para não bloquear
    }
    
    // ✅ SAFE PARSING: Evitar crash se ClickLife retornar HTML
    const loginText = await loginRes.text();
    let loginData;
    try {
      loginData = JSON.parse(loginText);
    } catch (parseError) {
      console.warn('[ClickLife] ⚠️ Resposta de login não é JSON válido (ok):', loginText.substring(0, 200));
      // ✅ NÃO RETORNAR ERRO - tratado como sucesso pois atendimento usa token do integrador
      return { success: true };
    }
    const userToken = loginData.authtoken || loginData.token;
    
    if (!userToken) {
      console.warn('[ClickLife] Login sem token (ok, atendimento usará integrador):', JSON.stringify(loginData).substring(0, 100));
      // ✅ NÃO RETORNAR ERRO
      return { success: true };
    }
    
    console.log('[ClickLife] ✓ Login bem-sucedido, token obtido');
    console.log('[ClickLife] Token do usuário (primeiros 20 chars):', userToken.substring(0, 20) + '...');
    
    return { success: true };
  }
  
  console.error('[ClickLife] Erro no cadastro:', res.status, resText);
  return { success: false, error: `HTTP ${res.status}: ${resText}` };
}


// Função removida: getOrCreateCommunicarePatient
// A Communicare cria o paciente automaticamente ao enfileirar

/**
 * Salva o appointment no banco de dados Supabase
 */
async function saveAppointment(
  payload: SchedulePayload,
  provider: string,
  redirectUrl: string,
  supabase: any
): Promise<{ appointment_id: string; redirect_url: string; existing?: boolean }> {
  try {
    // ✅ VERIFICAÇÃO DE DUPLICAÇÃO: Se já existe appointment com este order_id, retornar existente
    if (payload.order_id) {
      const { data: existingAppointment } = await supabase
        .from('appointments')
        .select('appointment_id, redirect_url')
        .eq('order_id', payload.order_id)
        .maybeSingle();
      
      if (existingAppointment) {
        console.log('[saveAppointment] ⚠️ Appointment já existe para order_id:', payload.order_id);
        console.log('[saveAppointment] Retornando appointment existente:', existingAppointment.appointment_id);
        return { 
          appointment_id: existingAppointment.appointment_id, 
          redirect_url: existingAppointment.redirect_url || redirectUrl,
          existing: true 
        };
      }
    }
    
    // ✅ ETAPA 3: Sincronizar email no Supabase antes de salvar
    if (payload.email && payload.cpf) {
      console.log('[saveAppointment] 🔄 Sincronizando email no Supabase:', payload.email);
      
      const { error: updateError } = await supabase
        .from('patients')
        .update({ email: payload.email, updated_at: new Date().toISOString() })
        .eq('cpf', payload.cpf.replace(/\D/g, ''));
      
      if (updateError) {
        console.error('[saveAppointment] ⚠️ Erro ao atualizar email:', updateError);
      } else {
        console.log('[saveAppointment] ✓ Email sincronizado com sucesso');
      }
    }
    
    const appointmentId = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('[saveAppointment] 💾 Salvando appointment no banco de dados...');
    console.log('[saveAppointment] Provider:', provider);
    console.log('[saveAppointment] Redirect URL:', redirectUrl);
    console.log('[saveAppointment] Order ID:', payload.order_id || 'N/A');
    
    // Mapeamento de SKU para nome do serviço
    const SERVICE_NAMES: Record<string, string> = {
      'ITC6534': 'Clínico Geral',
      'ZXW2165': 'Psicólogo - 1 sessão',
      'HXR8516': 'Psicólogo - 4 sessões',
      'YME9025': 'Psicólogo - 8 sessões',
      'BIR7668': 'Personal Trainer',
      'VPN5132': 'Nutricionista',
      'TQP5720': 'Cardiologista',
      'HGG3503': 'Dermatologista',
      'VHH8883': 'Endocrinologista',
      'TSB0751': 'Gastroenterologista',
      'CCP1566': 'Ginecologista',
      'FKS5964': 'Oftalmologista',
      'TVQ5046': 'Ortopedista',
      'HMG9544': 'Pediatra',
      'HME8366': 'Otorrinolaringologista',
      'DYY8522': 'Médico da Família',
      'QOP1101': 'Psiquiatra',
      'LZF3879': 'Nutrólogo',
      'YZD9932': 'Geriatria',
      'UDH3250': 'Reumatologista',
      'PKS9388': 'Neurologista',
      'MYX5186': 'Infectologista',
      'OVM9892': 'Laudos Psicológicos',
      'RZP5755': 'Renovação de Receitas',
      'ULT3571': 'Solicitação de Exames',
    };
    
    const serviceName = SERVICE_NAMES[payload.sku] || payload.sku;
    const startAt = payload.horario_iso || new Date().toISOString();
    
    const appointmentData = {
      appointment_id: appointmentId,
      email: payload.email,
      service_code: payload.sku,
      service_name: serviceName,
      start_at_local: startAt,
      duration_min: 30,
      status: 'confirmed',
      provider: provider,
      redirect_url: redirectUrl,
      // meeting_url removido - coluna não existe no projeto original
      order_id: payload.order_id
    };
    
    // ✅ CORREÇÃO RACE CONDITION: Tentar INSERT e capturar erro de unique violation
    // Se outra requisição já criou o appointment, retornamos o existente em vez de falhar
    const { data: insertedData, error } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select()
      .maybeSingle();
    
    // ✅ Tratar erro de unique violation (código 23505)
    if (error) {
      // Se for erro de duplicação (race condition), buscar o existente
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
        console.log('[saveAppointment] ⚠️ Duplicado detectado via constraint 23505');
        console.log('[saveAppointment] Order ID duplicado:', payload.order_id);
        
        // Buscar o appointment que já foi criado pela outra requisição
        const { data: existing } = await supabase
          .from('appointments')
          .select('appointment_id, redirect_url')
          .eq('order_id', payload.order_id)
          .maybeSingle();
        
        if (existing) {
          console.log('[saveAppointment] ✅ Retornando appointment existente:', existing.appointment_id);
          return { 
            appointment_id: existing.appointment_id, 
            redirect_url: existing.redirect_url || redirectUrl,
            existing: true 
          };
        }
        
        // Se não encontrou (improvável), lançar erro original
        console.error('[saveAppointment] ❌ Erro 23505 mas appointment não encontrado');
      }
      
      console.error('[saveAppointment] ❌ ERRO ao salvar appointment:', error);
      throw error;
    }
    
    console.log('[saveAppointment] ✅ APPOINTMENT SALVO COM SUCESSO!');
    console.log('[saveAppointment] Appointment ID:', appointmentId);
    console.log('[saveAppointment] Email:', payload.email);
    console.log('[saveAppointment] Redirect URL:', redirectUrl);
    
    return { appointment_id: appointmentId, redirect_url: redirectUrl, existing: false };
  } catch (error) {
    // ✅ Também tratar exceção de unique violation que pode vir como exceção
    const errorStr = String(error);
    if (errorStr.includes('23505') || errorStr.includes('duplicate key') || errorStr.includes('unique constraint')) {
      console.log('[saveAppointment] ⚠️ Exceção de duplicação capturada, buscando existente...');
      
      if (payload.order_id) {
        const { data: existing } = await supabase
          .from('appointments')
          .select('appointment_id, redirect_url')
          .eq('order_id', payload.order_id)
          .maybeSingle();
        
        if (existing) {
          console.log('[saveAppointment] ✅ Retornando appointment existente após exceção:', existing.appointment_id);
          return { 
            appointment_id: existing.appointment_id, 
            redirect_url: existing.redirect_url || redirectUrl,
            existing: true 
          };
        }
      }
    }
    
    console.error('[saveAppointment] ❌ EXCEÇÃO ao salvar appointment:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  // 📝 Log inicial com headers para diagnóstico
  console.log(`[schedule-redirect] ======== ${requestId} ========`);
  console.log('[schedule-redirect] Method:', req.method);
  console.log('[schedule-redirect] Origin:', req.headers.get('origin') || 'N/A');
  console.log('[schedule-redirect] Content-Type:', req.headers.get('content-type') || 'N/A');
  console.log('[schedule-redirect] Content-Length:', req.headers.get('content-length') || 'N/A');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ✅ PASSO 1: Parsing SEGURO do body (evita 500 "Unexpected end of JSON")
    const rawBody = await req.text();
    
    if (!rawBody || rawBody.trim() === '') {
      console.error(`[schedule-redirect] ❌ Body vazio! Request ID: ${requestId}`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Payload ausente',
          error_code: 'EMPTY_BODY',
          debug_hint: 'O corpo da requisição chegou vazio. Verifique se o frontend está enviando o JSON corretamente.',
          request_id: requestId
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    let payload: SchedulePayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error(`[schedule-redirect] ❌ JSON inválido! Request ID: ${requestId}`);
      console.error('[schedule-redirect] Raw body (primeiros 500 chars):', rawBody.substring(0, 500));
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'JSON inválido',
          error_code: 'INVALID_JSON',
          debug_hint: `Erro ao fazer parse do JSON: ${parseErr}`,
          request_id: requestId
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // ✅ PASSO 2: Validação de campos obrigatórios
    const missingFields: string[] = [];
    if (!payload.cpf) missingFields.push('cpf');
    if (!payload.email) missingFields.push('email');
    if (!payload.nome) missingFields.push('nome');
    if (!payload.telefone) missingFields.push('telefone');
    if (!payload.sku) missingFields.push('sku');
    
    if (missingFields.length > 0) {
      console.error(`[schedule-redirect] ❌ Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
      console.error(`[schedule-redirect] Request ID: ${requestId}`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Campos obrigatórios ausentes: ${missingFields.join(', ')}`,
          error_code: 'MISSING_FIELDS',
          debug_hint: `Os seguintes campos são obrigatórios: ${missingFields.join(', ')}`,
          request_id: requestId,
          received_fields: Object.keys(payload)
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('[schedule-redirect] ========================================');
    console.log('[schedule-redirect] 🚀 INICIANDO AGENDAMENTO:', new Date().toISOString());
    console.log('[schedule-redirect] Request ID:', requestId);
    console.log('[schedule-redirect] SKU:', payload.sku);
    console.log('[schedule-redirect] Email:', payload.email);
    console.log('[schedule-redirect] Order ID:', payload.order_id || 'N/A');
    console.log('[schedule-redirect] Payment ID:', payload.payment_id || 'N/A');
    console.log('[schedule-redirect] Plano Ativo:', payload.plano_ativo);
    console.log('[schedule-redirect] ========================================');

    // ✅ URL FIXA do projeto original onde admin_settings está configurado
    // NÃO usar Deno.env.get('SUPABASE_URL') pois pode apontar para projeto errado (Lovable Cloud)
    const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
    
    // ✅ CORREÇÃO: Usar Service Role Key do projeto ORIGINAL (não do Lovable Cloud)
    // A key do Lovable Cloud (SUPABASE_SERVICE_ROLE_KEY) não funciona no projeto original
    const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // ✅ Inicializar cliente Supabase ANTES de qualquer uso
    const supabase = createClient(
      ORIGINAL_SUPABASE_URL,
      ORIGINAL_SERVICE_ROLE_KEY
    );
    
    // ✅ ADMIN FORCE PROVIDER: Permitir admin forçar ClickLife ou Communicare (via payload)
    if (payload.force_provider) {
      console.log(`[schedule-redirect] 🚨 ADMIN FORCE: Forçando ${payload.force_provider}`);
      
      if (payload.force_provider === 'clicklife') {
        return await redirectClickLife(payload, 'Admin forçou ClickLife', corsHeaders);
      } else if (payload.force_provider === 'communicare') {
        return await redirectCommunicare(payload, supabase, corsHeaders);
      }
    }
    
    // ============================================================
    // HIERARQUIA DE ROTEAMENTO CORRETA (v2 - CORRIGIDA)
    // ============================================================
    // ORDEM:
    // 0. ADMIN FORCE PROVIDER (payload) - já verificado acima
    // 1. EXCEÇÕES FIXAS (Laudos, Psicólogos sem plano, Especialistas, WhatsApp)
    // 2. PLANO ATIVO → ClickLife (ignora overrides e horário)
    // 3. OVERRIDES ADMIN (force_clicklife, force_clicklife_pronto_atendimento, force_communicare_clinico)
    // 4. HORÁRIO (7h-19h BRT dias úteis = Communicare, fora = ClickLife)
    // 5. ESPECIALIDADE (aceita Communicare ou ClickLife)
    // 6. FALLBACK → Communicare
    // ============================================================

    // ✅ GUARD: Nunca processar SKUs de PLANO (assinaturas)
    if (payload.sku?.match(/^(IND_|FAM_)/)) {
      console.error('[schedule-redirect] ❌ SKU de PLANO detectado - não deve chamar schedule-redirect');
      console.error('[schedule-redirect] SKU recebido:', payload.sku);
      console.error('[schedule-redirect] Este endpoint é apenas para SERVIÇOS, não PLANOS');
      
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Planos não devem ser agendados via schedule-redirect',
          redirect_url: '/area-do-paciente',
          details: {
            sku: payload.sku,
            reason: 'Este endpoint processa apenas serviços (consultas avulsas), não planos de assinatura'
          }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ✅ EXCEÇÃO PRIORITÁRIA: LAUDOS PSICOLÓGICOS → SEMPRE WhatsApp (independente de plano/horário)
    if (payload.sku === 'OVM9892') {
      console.log('[schedule-redirect] ✓ LAUDOS PSICOLÓGICOS detectado → WhatsApp dedicado (SEMPRE)');
      
      // Criar URL do WhatsApp com mensagem padrão
      const mensagem = 'Olá! Gostaria de agendar uma consulta para emissão de laudo psicológico.';
      const mensagemEncoded = encodeURIComponent(mensagem);
      const whatsappUrl = `https://wa.me/5511933359187?text=${mensagemEncoded}`;
      
      console.log('[schedule-redirect] WhatsApp URL gerada:', whatsappUrl);
      console.log('[schedule-redirect] Mensagem:', mensagem);
      
      // Salvar appointment no banco
      await saveAppointment(payload, 'whatsapp_laudos', whatsappUrl, supabase);
      console.log('[schedule-redirect] ✅ Appointment salvo para Laudos Psicológicos');
      
      return new Response(
        JSON.stringify({
          ok: true,
          url: whatsappUrl,
          provider: 'whatsapp_laudos',
          message: mensagem
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // ✅ BYPASS: Renovação de Receitas e Solicitação de Exames → WhatsApp (SOMENTE SEM PLANO)
    const WHATSAPP_REDIRECT_SKUS: Record<string, string> = {
      'RZP5755': 'https://wa.me/5511933359187?text=Quero%20renovar%20minha%20receita!',
      'ULT3571': 'https://wa.me/5511933359187?text=Quero%20agendar%20um%20exame!'
    };

    if (WHATSAPP_REDIRECT_SKUS[payload.sku] && !payload.plano_ativo) {
      console.log(`[schedule-redirect] ✓ SKU ${payload.sku} SEM plano ativo → WhatsApp`);
      
      const whatsappUrl = WHATSAPP_REDIRECT_SKUS[payload.sku];
      
      // ✅ CRÍTICO: Salvar appointment ANTES de retornar para permitir polling do frontend
      await saveAppointment(payload, 'whatsapp', whatsappUrl, supabase);
      console.log('[schedule-redirect] ✅ Appointment salvo no banco antes de redirecionar');
      
      return new Response(
        JSON.stringify({
          ok: true,
          url: whatsappUrl,
          provider: 'whatsapp'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // ✅ EXCEÇÃO: Receitas/Exames COM PLANO ATIVO → ClickLife (como Pronto Atendimento)
    if ((payload.sku === 'RZP5755' || payload.sku === 'ULT3571') && payload.plano_ativo) {
      console.log(`[schedule-redirect] ✓ SKU ${payload.sku} COM plano ativo → ClickLife`);
      // Continuar fluxo normal para ClickLife (não retornar aqui)
    }

    // ✅ EXCEÇÃO: Psicólogos SEM plano ativo → Agenda Online da Psicóloga
    const isPsicologoSemPlano = PSICOLOGO_SKUS.includes(payload.sku) && !payload.plano_ativo;

    if (isPsicologoSemPlano) {
      console.log(`[schedule-redirect] ✓ Psicólogo SEM plano ativo (${payload.sku}) → Agenda Online da Psicóloga`);
      
      const agendaUrl = 'https://prontiasaude.agendar.cc/#/perfil/264663';
      
      // Salvar appointment no banco com provider Communicare
      await saveAppointment(payload, 'Communicare', agendaUrl, supabase);
      console.log('[schedule-redirect] ✅ Appointment salvo para Agenda Online da Psicóloga');
      
      return new Response(
        JSON.stringify({
          ok: true,
          url: agendaUrl,
          provider: 'Communicare'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // ✅ EXCEÇÃO: Médicos Especialistas OU Psicólogos com Plano Ativo → WhatsApp 0800
    const isEspecialista = ESPECIALISTA_SKUS.includes(payload.sku);
    const isPsicologoComPlano = PSICOLOGO_SKUS.includes(payload.sku) && payload.plano_ativo;

    if (isEspecialista || isPsicologoComPlano) {
      const motivo = isEspecialista 
        ? `Médico especialista (${payload.sku})` 
        : `Psicólogo COM plano ativo (${payload.sku})`;
      
      console.log(`[schedule-redirect] ✓ ${motivo} → WhatsApp Suporte 0800`);
      
      // ✅ CORREÇÃO: Usar nome da especialidade na mensagem do WhatsApp
      const especialidadeNome = payload.especialidade || SKU_TO_SPECIALIST_NAME[payload.sku] || 'médico especialista';
      const mensagemWhatsApp = `Olá! Acabei de comprar uma consulta de ${especialidadeNome} e gostaria de agendar.`;
      const whatsappUrl = `https://wa.me/5511933359187?text=${encodeURIComponent(mensagemWhatsApp)}`;
      
      console.log(`[schedule-redirect] Mensagem WhatsApp: "${mensagemWhatsApp}"`);
      
      // ✅ CORREÇÃO: Salvar appointment ANTES de retornar para permitir polling do frontend
      try {
        await saveAppointment(payload, 'whatsapp_specialist', whatsappUrl, supabase);
        console.log('[schedule-redirect] ✅ Appointment salvo para especialista/psicólogo com plano');
      } catch (saveError) {
        console.error('[schedule-redirect] ⚠️ Erro ao salvar appointment (continuando):', saveError);
      }
      
      return new Response(
        JSON.stringify({
          ok: true,
          url: whatsappUrl,
          provider: 'whatsapp_specialist'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 1. Normalizar campos (remover caracteres especiais/espaços)
    payload.cpf = (payload.cpf || '').replace(/\D/g, '').trim();
    payload.telefone = (payload.telefone || '').replace(/\D/g, '').trim();
    payload.nome = (payload.nome || '').trim();

    console.log('[schedule-redirect] Dados após normalização:', {
      cpf: payload.cpf ? `${payload.cpf.substring(0, 3)}***` : 'vazio',
      telefone: payload.telefone ? `${payload.telefone.substring(0, 4)}***` : 'vazio',
      nome: payload.nome || 'vazio'
    });

    // 2. Enriquecer payload se campos estiverem vazios após normalização
    // ✅ CORRIGIDO: Agora busca birth_date SEMPRE que ausente, independente dos outros campos
    const needsBasicEnrichment = !payload.cpf || !payload.nome || !payload.telefone || !payload.sexo;
    const needsBirthDateEnrichment = !payload.birth_date;
    
    if (needsBasicEnrichment || needsBirthDateEnrichment) {
      console.log('[schedule-redirect] Buscando dados na tabela patients...', {
        reason: needsBasicEnrichment ? 'campos_incompletos' : 'birth_date_ausente',
        has_cpf: !!payload.cpf,
        has_nome: !!payload.nome,
        has_telefone: !!payload.telefone,
        has_sexo: !!payload.sexo,
        has_birth_date: !!payload.birth_date
      });
      
      try {
        // Buscar patient pelo user_id primeiro
        let patientData = null;
        const { data: userData } = await supabase.auth.getUser();
        
        if (userData?.user?.id) {
          const { data: patientByUserId } = await supabase
            .from('patients')
            .select('id, cpf, first_name, last_name, phone_e164, gender, birth_date')
            .eq('user_id', userData.user.id)
            .maybeSingle();
          
          if (patientByUserId) {
            patientData = patientByUserId;
            console.log('[schedule-redirect] ✓ Paciente encontrado por user_id');
          }
        }
        
        // Fallback: buscar por email se não encontrou por user_id
        if (!patientData && payload.email) {
          const { data: patientByEmail } = await supabase
            .from('patients')
            .select('id, cpf, first_name, last_name, phone_e164, gender, birth_date')
            .eq('email', payload.email)
            .maybeSingle();
          
          if (patientByEmail) {
            patientData = patientByEmail;
            console.log('[schedule-redirect] ✓ Paciente encontrado por email');
          }
        }
        
        // Fallback: buscar por CPF se não encontrou pelos métodos anteriores
        if (!patientData && payload.cpf) {
          const { data: patientByCpf } = await supabase
            .from('patients')
            .select('id, cpf, first_name, last_name, phone_e164, gender, birth_date')
            .eq('cpf', payload.cpf)
            .maybeSingle();
          
          if (patientByCpf) {
            patientData = patientByCpf;
            console.log('[schedule-redirect] ✓ Paciente encontrado por CPF');
          }
        }
        
        if (patientData) {
          // Enriquecer campos básicos apenas se necessário
          if (needsBasicEnrichment) {
            payload.cpf = payload.cpf || (patientData.cpf || '').replace(/\D/g, '');
            payload.nome = payload.nome || `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim();
            payload.telefone = payload.telefone || (patientData.phone_e164 || '').replace(/\D/g, '');
            
            // ✅ Enriquecer gênero se ausente
            if (!payload.sexo && patientData.gender) {
              const mappedGender = mapGender(patientData.gender);
              if (mappedGender) {
                payload.sexo = mappedGender;
                console.log('[schedule-redirect] ✓ Gênero obtido de patients:', {
                  raw: patientData.gender,
                  normalized: mappedGender,
                  fonte: 'patients_table'
                });
              }
            }
          }
          
          // ✅ SEMPRE enriquecer birth_date se ausente (independente dos outros campos)
          if (!payload.birth_date && patientData.birth_date) {
            payload.birth_date = patientData.birth_date;
            console.log('[schedule-redirect] ✓ birth_date obtido de patients:', patientData.birth_date);
          } else if (!payload.birth_date && !patientData.birth_date) {
            console.warn('[schedule-redirect] ⚠️ birth_date ausente no payload E no banco para:', payload.email?.substring(0, 3) + '***');
          }
          
          console.log('[schedule-redirect] ✓ Dados enriquecidos via patients table');
          
          // ✅ Buscar plan_code do plano ativo se ainda não temos
          if (payload.plano_ativo && !payload.plan_code) {
            try {
              const { data: activePlan } = await supabase
                .from('patient_plans')
                .select('plan_code')
                .eq('email', payload.email)
                .eq('status', 'active')
                .gte('plan_expires_at', new Date().toISOString())
                .order('plan_expires_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (activePlan?.plan_code) {
                payload.plan_code = activePlan.plan_code;
                console.log('[schedule-redirect] ✓ plan_code obtido:', activePlan.plan_code);
              }
            } catch (planError) {
              console.warn('[schedule-redirect] Erro ao buscar plan_code:', planError);
            }
          }
        } else {
          console.warn('[schedule-redirect] Paciente não encontrado na tabela patients');
        }
      } catch (enrichError) {
        console.error('[schedule-redirect] Erro ao enriquecer dados:', enrichError);
      }
    }
    
    // ✅ Normalizar gênero do payload se presente
    if (payload.sexo) {
      const originalSexo = payload.sexo;
      const mappedSexo = mapGender(payload.sexo);
      
      if (mappedSexo) {
        payload.sexo = mappedSexo;
        console.log('[schedule-redirect] ✓ Gênero normalizado:', {
          raw: originalSexo,
          normalized: mappedSexo,
          fonte: 'payload'
        });
      } else {
        console.warn('[schedule-redirect] ⚠️ Gênero inválido no payload:', originalSexo);
      }
    }
    
    // ✅ Aplicar fallback se gênero ainda ausente
    if (!payload.sexo) {
      payload.sexo = 'F';
      console.warn('[schedule-redirect] ⚠️ Gênero ausente - usando fallback "F":', {
        order_id: payload.order_id || 'N/A',
        email: payload.email?.substring(0, 3) + '***',
        fonte: 'default_fallback'
      });
    }

    // 3. Validar se dados essenciais estão presentes após normalização e enriquecimento
    if (!payload.cpf || !payload.nome || !payload.telefone) {
      console.error('[schedule-redirect] Dados ainda incompletos:', {
        cpf: !!payload.cpf,
        nome: !!payload.nome,
        telefone: !!payload.telefone
      });
      
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Complete seu cadastro antes de agendar',
          missing: {
            cpf: !payload.cpf,
            nome: !payload.nome,
            telefone: !payload.telefone
          }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ========================================
    // HIERARQUIA DE ROTEAMENTO (v3 - force_provider prioridade máxima)
    // ========================================
    // 0. FORCE_PROVIDER (admin) → Prioridade máxima, ignora tudo
    // 1. PLANO ATIVO → ClickLife (ignora overrides e horário)
    // 2. OVERRIDES ADMIN (force_clicklife, force_clicklife_pronto_atendimento, force_communicare_clinico)
    // 3. HORÁRIO (7h-19h BRT dias úteis = Communicare, fora = ClickLife)
    // 4. ESPECIALIDADE (aceita Communicare ou ClickLife)
    // 5. FALLBACK → Communicare
    // ========================================

    // ========================================
    // ETAPA 0: FORCE_PROVIDER (PRIORIDADE ABSOLUTA - Admin)
    // ========================================
    // Quando admin seleciona manualmente o provedor no modal "Criar Consulta",
    // essa escolha sobrescreve TODAS as outras regras (plano, overrides, horário)
    if (payload.force_provider) {
      console.log(`[schedule-redirect] 🎯 FORCE_PROVIDER ATIVO: ${payload.force_provider} (prioridade absoluta)`);
      console.log(`[schedule-redirect] skip_registration=${payload.skip_registration}, plano_ativo=${payload.plano_ativo}`);
      
      if (payload.force_provider === 'clicklife') {
        return await redirectClickLife(payload, 'force_provider_admin', corsHeaders);
      } else if (payload.force_provider === 'communicare') {
        return await redirectCommunicare(payload, supabase, corsHeaders);
      }
    }

    // ========================================
    // ETAPA 1: VERIFICAR PLANO ATIVO (PRIORIDADE MÁXIMA após force_provider)
    // ========================================

    // 1.1 ✅ Verificar se é funcionário de empresa com plano ativo → ClickLife
    const cpfClean = payload.cpf.replace(/\D/g, '');
    const { data: employeeData } = await supabase
      .from('company_employees')
      .select('has_active_plan, empresa_id_externo, plano_id_externo')
      .eq('cpf', cpfClean)
      .maybeSingle();

    if (employeeData?.has_active_plan) {
      console.log('[schedule-redirect] ✓ Funcionário com plano ATIVO → ClickLife (PRIORIDADE MÁXIMA)');
      payload.plano_ativo = true;
      return await redirectClickLife(payload, 'employee_with_plan', corsHeaders);
    }

    // 1.2 ✅ Verificar plano ativo no banco de dados → ClickLife
    const { data: patientPlan } = await supabase
      .from('patient_plans')
      .select('plan_code, plan_expires_at, status')
      .eq('email', payload.email)
      .eq('status', 'active')
      .gte('plan_expires_at', new Date().toISOString().split('T')[0])
      .maybeSingle();

    if (patientPlan) {
      console.log('[schedule-redirect] ✓ Plano ATIVO no banco → ClickLife (PRIORIDADE MÁXIMA):', {
        email: payload.email,
        plan_code: patientPlan.plan_code,
        expires_at: patientPlan.plan_expires_at
      });
      payload.plano_ativo = true;
      payload.plan_code = patientPlan.plan_code;
      return await redirectClickLife(payload, 'active_plan_db', corsHeaders);
    }

    // 1.3 ✅ Verificar plano ativo do payload (fallback) → ClickLife
    if (payload.plano_ativo) {
      console.log('[schedule-redirect] ✓ Plano ATIVO (payload) → ClickLife (PRIORIDADE MÁXIMA)', {
        sku: payload.sku,
        email: payload.email,
        cpf: payload.cpf?.substring(0, 3) + '***'
      });
      return await redirectClickLife(payload, 'active_plan_payload', corsHeaders);
    }

    // ========================================
    // A PARTIR DAQUI: APENAS USUÁRIOS SEM PLANO ATIVO
    // ========================================

    // ========================================
    // ETAPA 2: OVERRIDES ADMIN
    // ========================================

    // 2.1 ✅ Override EMERGÊNCIA: Forçar ClickLife para TUDO
    const { data: forceData } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'force_clicklife')
      .maybeSingle();

    if (forceData?.value === true || forceData?.value === 'true') {
      console.log('[schedule-redirect] 🚨 OVERRIDE EMERGÊNCIA: Forçando ClickLife para TODOS');
      return await redirectClickLife(payload, 'admin_override_emergency', corsHeaders);
    }

    // 2.2 ✅ Override ClickLife para Pronto Atendimento (SKU ITC6534)
    const { data: overrideClickLifePA, error: overrideError } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'force_clicklife_pronto_atendimento')
      .maybeSingle();

    console.log('[schedule-redirect] 🔍 Override ClickLife PA:', {
      value: overrideClickLifePA?.value,
      valueType: typeof overrideClickLifePA?.value,
      error: overrideError?.message || null,
      sku: payload.sku,
      match: (overrideClickLifePA?.value === true || overrideClickLifePA?.value === 'true') && payload.sku === 'ITC6534'
    });

    if ((overrideClickLifePA?.value === true || overrideClickLifePA?.value === 'true') && payload.sku === 'ITC6534') {
      console.log('[schedule-redirect] 🚨 OVERRIDE ClickLife PA ATIVO: Forçando ClickLife para Pronto Atendimento (ITC6534)');
      return await redirectClickLife(payload, 'override_clicklife_pronto_atendimento', corsHeaders);
    }

    // 2.3 ✅ Override Communicare para Clínico Geral (SKU ITC6534)
    const { data: forceCommData } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'force_communicare_clinico')
      .maybeSingle();

    console.log('[schedule-redirect] 🔍 Override Communicare Clínico:', {
      value: forceCommData?.value,
      valueType: typeof forceCommData?.value,
      sku: payload.sku,
      match: (forceCommData?.value === true || forceCommData?.value === 'true') && payload.sku === 'ITC6534'
    });

    if ((forceCommData?.value === true || forceCommData?.value === 'true') && payload.sku === 'ITC6534') {
      console.log('[schedule-redirect] Override Communicare ativo (usuário SEM plano) → Communicare');
      return await redirectCommunicare(payload, supabase, corsHeaders);
    }

    // ========================================
    // ETAPA 3: VERIFICAR HORÁRIO
    // ========================================

    const horario = payload.horario_iso ? new Date(payload.horario_iso) : new Date();

    const isWeekend = horario.getDay() === 0 || horario.getDay() === 6;
    const hour = horario.getUTCHours() - 3; // Ajustar para horário de Brasília (UTC-3)
    const isNighttime = hour < 7 || hour >= 19;

    console.log('[schedule-redirect] 🕐 Verificação de horário:', {
      horario_iso: payload.horario_iso || 'NOW',
      utc_hour: horario.getUTCHours(),
      brt_hour: hour,
      is_weekend: isWeekend,
      is_nighttime: isNighttime,
      day_of_week: horario.getDay()
    });

    if (isWeekend) {
      console.log('[schedule-redirect] Fim de semana → ClickLife');
      return await redirectClickLife(payload, 'weekend', corsHeaders);
    }

    if (isNighttime) {
      console.log('[schedule-redirect] Horário noturno (fora de 7h-19h BRT) → ClickLife');
      return await redirectClickLife(payload, 'nighttime', corsHeaders);
    }

    // ========================================
    // ETAPA 4: VERIFICAR ESPECIALIDADE
    // ========================================

    const communicareSpecialties = await getCommunicareSpecialties(supabase);
    
    // ✅ Mapeamento de sinônimos: nome comercial → nome técnico do provider
    const SPECIALTY_SYNONYMS: Record<string, string> = {
      'pronto atendimento': 'clinico geral',  // SKU ITC6534 - nome do site vs nome Communicare
    };
    
    // ✅ Normalizar payload.especialidade
    let especialidadeNormalized = normalize(payload.especialidade || '');
    
    // ✅ Aplicar mapeamento de sinônimo se existir
    if (SPECIALTY_SYNONYMS[especialidadeNormalized]) {
      const mapped = SPECIALTY_SYNONYMS[especialidadeNormalized];
      console.log('[schedule-redirect] Especialidade mapeada:', especialidadeNormalized, '→', mapped);
      especialidadeNormalized = mapped;
    }
    
    // ✅ Normalizar TODAS as especialidades Communicare
    const communicareNormalized = communicareSpecialties.map(s => normalize(s));
    
    console.log('[schedule-redirect] Comparando:', {
      payload_original: payload.especialidade,
      payload_normalized: especialidadeNormalized,
      communicare_raw: communicareSpecialties,
      communicare_normalized: communicareNormalized
    });
    
    // ✅ Comparar normalizados
    if (!communicareNormalized.includes(especialidadeNormalized)) {
      console.log('[schedule-redirect] Especialidade indisponível na Communicare → ClickLife');
      return await redirectClickLife(payload, 'specialty_unavailable', corsHeaders);
    }

    // ========================================
    // ETAPA 5: FALLBACK → Communicare
    // ========================================
    console.log('[schedule-redirect] ✅ Todas as condições atendidas → Communicare');
    return await redirectCommunicare(payload, supabase, corsHeaders);

  } catch (error) {
    console.error('[schedule-redirect] Error:', error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Internal error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function redirectClickLife(payload: SchedulePayload, reason: string, corsHeaders: Record<string, string>) {
  console.log(`[ClickLife] Motivo: ${reason}`);

  const API_BASE = Deno.env.get('CLICKLIFE_API_BASE')!;
  const REDIRECT_URL = Deno.env.get('CLICKLIFE_REDIRECT_URL')!

  // ✅ Determinar plano_id baseado no PLANO do paciente (não no SKU da consulta)
  // 864 = Plano com especialistas | 863 = Plano sem especialistas
  let planoId = 863; // Default: sem especialistas

  if (payload.plano_ativo && payload.plan_code) {
    const planoIncluiEspecialistas = 
      PLANOS_COM_ESPECIALISTAS.includes(payload.plan_code) || 
      isPlanoEmpresarial(payload.plan_code);
    
    planoId = planoIncluiEspecialistas ? 864 : 863;
    
    console.log(`[ClickLife] Plano do paciente: ${payload.plan_code}`);
    console.log(`[ClickLife] Inclui especialistas: ${planoIncluiEspecialistas}`);
  }

  console.log(`[ClickLife] plano_id selecionado: ${planoId} (plan_code: ${payload.plan_code}, plano_ativo: ${payload.plano_ativo})`);

  // ✅ Garantir que sexo seja 'M' ou 'F'
  const sexoFinal = payload.sexo && (payload.sexo === 'M' || payload.sexo === 'F') 
    ? payload.sexo 
    : 'F';
    
  if (sexoFinal !== payload.sexo) {
    console.warn('[ClickLife] ⚠️ Sexo corrigido:', {
      original: payload.sexo,
      corrigido: sexoFinal,
      cpf: payload.cpf?.substring(0, 3) + '***'
    });
  }

  console.log('[ClickLife] Sexo enviado para cadastro:', sexoFinal);

  // 1. CADASTRAR PACIENTE (ou pular se skip_registration)
  if (payload.skip_registration) {
    console.log('[ClickLife] ⏭️ skip_registration=true, pulando cadastro/ativação - indo direto para criação de atendimento');
  } else {
    const registration = await registerClickLifePatient(
      payload.cpf,
      payload.nome,
      payload.email,
      payload.telefone,
      planoId,
      sexoFinal,
      payload.birth_date // ✅ NOVO: Passar data de nascimento
    );

    // ✅ ETAPA 2: Se falhar, tentar apenas ativar sem re-cadastrar
    if (!registration.success) {
      console.warn('[ClickLife] Cadastro falhou, tentando apenas ativar:', registration.error);
      
      // Tentar ativação direta (assume que usuário já existe)
      const cpfClean = payload.cpf.replace(/\D/g, '');
      const INTEGRATOR_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN')!;
      
      const activationPayload = {
        authtoken: INTEGRATOR_TOKEN,
        cpf: cpfClean,
        empresaid: 9083,
        planoid: planoId,
        proposito: "Ativar"
      };
      
      try {
        const activationRes = await fetch(`${API_BASE}/usuarios/ativacao`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'authtoken': INTEGRATOR_TOKEN
          },
          body: JSON.stringify(activationPayload)
        });
        
        if (!activationRes.ok) {
          const errorText = await activationRes.text();
          console.warn('[ClickLife] ⚠️ Ativação também falhou (paciente pode já estar ativo):', activationRes.status, errorText.substring(0, 200));
          // ✅ NÃO RETORNAR ERRO - continuar para criar atendimento (paciente já ativo é OK)
          console.log('[ClickLife] Prosseguindo mesmo com erro de ativação - paciente pode já estar ativo');
        } else {
          console.log('[ClickLife] ✓ Usuário ativado diretamente (fallback)');
        }
      } catch (error) {
        console.warn('[ClickLife] Exceção na ativação direta (continuando mesmo assim):', error);
        // ✅ NÃO RETORNAR ERRO - continuar para criar atendimento
      }
    }
  }

  console.log('[ClickLife] ✓ Prosseguindo com criação de atendimento');

  // 2. OBTER TOKEN DO INTEGRADOR
  const INTEGRATOR_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN');
  if (!INTEGRATOR_TOKEN) {
    console.error('[ClickLife] ❌ CLICKLIFE_AUTH_TOKEN não configurado');
    return new Response(
      JSON.stringify({ 
        ok: false, 
        provider: 'clicklife',
        error: 'Token de integração não configurado',
        details: {
          reason: 'CLICKLIFE_AUTH_TOKEN não encontrado no ambiente',
          endpoint: 'N/A'
        }
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // 3. CRIAR AGENDAMENTO USANDO AUTHTOKEN DO INTEGRADOR (não depende da senha do paciente)
  const requestBody: any = {
    cpf: payload.cpf.replace(/\D/g, ''),
    authtoken: INTEGRATOR_TOKEN, // ✅ Token do integrador no body (conforme documentação ClickLife)
    especialidadeid: SKU_TO_CLICKLIFE_ID[payload.sku] || 8,
  };

  console.log('[ClickLife] Request body (usando authtoken):', {
    cpf: requestBody.cpf,
    authtoken: `${INTEGRATOR_TOKEN.substring(0, 10)}...`, // Mascarar token no log
    especialidadeid: requestBody.especialidadeid
  });

  const response = await fetch(
    `${API_BASE}/atendimentos/atendimentos`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ClickLife] HTTP ${response.status}:`, errorText);
    
    let errorReason = 'Erro na API ClickLife';
    if (response.status === 401) {
      console.error('[ClickLife] ⚠️ Token inválido - Verifique CLICKLIFE_AUTH_TOKEN no ambiente');
      errorReason = 'Token inválido ou usuário não encontrado';
    } else if (response.status === 403) {
      console.error('[ClickLife] ⚠️ Acesso negado - Verifique se o cadastro está ativo na plataforma');
      errorReason = 'Cadastro inativo';
    }
    
    // Retornar erro estruturado
    return new Response(
      JSON.stringify({
        ok: false,
        provider: 'clicklife',
        error: `ClickLife API error: ${response.status} - ${errorText}`,
        details: {
          status_code: response.status,
          response_body: errorText,
          reason: errorReason,
          endpoint: '/atendimentos/atendimentos'
        }
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
  
  // ✅ SAFE PARSING: Evitar crash se ClickLife retornar HTML ao invés de JSON
  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error('[ClickLife] ❌ Resposta de scheduling não é JSON válido:', responseText.substring(0, 500));
    return new Response(
      JSON.stringify({
        ok: false,
        provider: 'clicklife',
        error: 'ClickLife retornou resposta inválida',
        debug_hint: 'API retornou HTML ao invés de JSON. Possível erro no backend da ClickLife.',
        response_preview: responseText.substring(0, 200)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  console.log('[ClickLife] Response:', data);

  // ✅ Usar URL retornada pela API (com token JWT de login automático)
  const redirectUrl = data.url || REDIRECT_URL;
  console.log('[ClickLife] Redirect URL:', redirectUrl);

  // ✅ Salvar appointment no banco - usando URL e KEY fixa do projeto original
  const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
  const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseInstance = createClient(
    ORIGINAL_SUPABASE_URL,
    ORIGINAL_SERVICE_ROLE_KEY
  );
  await saveAppointment(payload, 'clicklife', redirectUrl, supabaseInstance);

  // ✅ Gravar métrica de agendamento
  try {
    await supabaseInstance
      .from('metrics')
      .insert({
        metric_type: 'appointment',
        plan_code: planoId.toString(),
        specialty: payload.especialidade || 'clinico-geral',
        platform: 'clicklife',
        status: 'scheduled',
        patient_email: payload.email,
        metadata: { cpf: payload.cpf.slice(0, 3) + '***', atendimento_id: data.atendimento }
      });
    console.log('[ClickLife] ✅ Métrica de agendamento gravada');
  } catch (metricError) {
    console.error('[ClickLife] Erro ao gravar métrica:', metricError);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      url: redirectUrl,
      provider: 'clicklife',
      reason,
      plano_id: planoId
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Cria paciente na Communicare via API Patients
 * POST /v1/patient
 */
async function createCommunicarePatient(
  payload: SchedulePayload,
  jwt: string
): Promise<{ success: boolean; patientId?: number; error?: string }> {
  const PATIENTS_BASE = Deno.env.get('COMMUNICARE_PATIENTS_BASE') || 
                        'https://api-patients-production.communicare.com.br';
  
  const cpfClean = payload.cpf.replace(/\D/g, '');
  const phoneClean = payload.telefone.replace(/\D/g, '');
  
  // Extrair DDI e número (ex: +5511999999999 → ddi: 55, mobile: 11999999999)
  const ddi = phoneClean.startsWith('55') ? '55' : '55';
  const mobileNumber = phoneClean.replace(/^55/, '');
  
  // Converter birth_date de YYYY-MM-DD para DDMMYYYY (formato Communicare)
  let birthDateFormatted = "01011990"; // Fallback
  let usedBirthDateFallback = true;
  
  if (payload.birth_date && payload.birth_date !== '1990-01-01') {
    try {
      const parts = payload.birth_date.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        // Verificar se não é a data genérica
        if (!(year === '1990' && month === '01' && day === '01')) {
          birthDateFormatted = `${day}${month}${year}`;
          usedBirthDateFallback = false;
          console.log('[Communicare Patients] ✅ Data de nascimento REAL:', payload.birth_date, '→', birthDateFormatted);
        }
      }
    } catch (e) {
      console.warn('[Communicare Patients] Erro ao converter birth_date:', e);
    }
  }
  
  if (usedBirthDateFallback) {
    console.warn('[Communicare Patients] ⚠️ FALLBACK: Usando data genérica 01011990 (birth_date recebido:', payload.birth_date || 'NULO', ')');
  }

  // Mapear gênero (já vem normalizado como 'M' ou 'F')
  const genderFormatted = (payload.sexo === 'M' || payload.sexo === 'F') ? payload.sexo : 'M';
  console.log('[Communicare Patients] Gênero:', payload.sexo, '→', genderFormatted);

  const patientPayload = {
    name: payload.nome,
    cpf: cpfClean,
    mobileNumber: mobileNumber,
    email: payload.email,
    ddi: ddi,
    birthDate: birthDateFormatted,
    gender: genderFormatted,
    workingArea: "Outro",
    jogPosition: "Outro",
  };
  
  console.log('[Communicare Patients] Criando paciente CPF:', cpfClean);
  console.log('[Communicare Patients] Payload:', JSON.stringify(patientPayload, null, 2));
  
  const API_TOKEN = Deno.env.get('COMMUNICARE_API_TOKEN')!;
  
  const res = await fetch(`${PATIENTS_BASE}/v1/patient`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_token': API_TOKEN,
    },
    body: JSON.stringify(patientPayload)
  });
  
  const resText = await res.text();
  console.log('[Communicare Patients] Response status:', res.status);
  console.log('[Communicare Patients] Response body:', resText);
  
  // 201 = criado, 409 = já existe (ambos são sucesso)
  if (res.status === 201 || res.status === 409) {
    console.log('[Communicare Patients] ✓ Paciente criado ou já existente');
    
    // ✅ Tentar extrair patientId do POST response primeiro
    let patientId: number | undefined;
    
    try {
      const postData = JSON.parse(resText);
      patientId = postData.id || postData.patientId;
      
      if (patientId) {
        console.log('[Communicare Patients] ✓ patientId obtido do POST:', patientId);
        return { success: true, patientId };
      }
    } catch (e) {
      console.log('[Communicare Patients] POST response não contém ID, consultando via GET...');
    }
    
    // ✅ Se não tiver ID no POST, fazer GET
    console.log('[Communicare Patients] Consultando patientId via GET...');
    const getRes = await fetch(`${PATIENTS_BASE}/v1/patient?cpf=${cpfClean}`, {
      method: 'GET',
      headers: { 'api_token': API_TOKEN }
    });
    
    if (getRes.ok) {
      const getBody = await getRes.text();
      console.log('[Communicare Patients] GET Response body:', getBody);
      
      try {
        const getData = JSON.parse(getBody);
        // Pode ser array ou objeto
        if (Array.isArray(getData)) {
          patientId = getData[0]?.id;
        } else {
          patientId = getData.id;
        }
        
        if (patientId) {
          console.log('[Communicare Patients] ✓ patientId obtido via GET:', patientId);
          return { success: true, patientId };
        }
      } catch (e) {
        console.error('[Communicare Patients] Erro ao parsear GET response:', e);
      }
    }
    
    console.warn('[Communicare Patients] ⚠️ Não foi possível obter patientId');
    return { success: false, error: 'Paciente criado mas ID não obtido' };
  }
  
  console.error('[Communicare Patients] ⚠️ Erro ao criar paciente');
  return { 
    success: false, 
    error: `HTTP ${res.status}: ${resText}` 
  };
}

async function redirectCommunicare(payload: SchedulePayload, supabase: any, corsHeaders: Record<string, string>) {
  console.log('[Communicare] Iniciando redirecionamento');

  const INTEGRATIONS_BASE = Deno.env.get('COMMUNICARE_INTEGRATIONS_BASE')!;
  const SSO_API_KEY = Deno.env.get('COMMUNICARE_SSO_API_KEY')!;
  const SSO_CPF = Deno.env.get('COMMUNICARE_SSO_CPF')!;
  const QUEUE_UUID = Deno.env.get('COMMUNICARE_QUEUE_UUID')!;
  const API_TOKEN = Deno.env.get('COMMUNICARE_API_TOKEN')!;
  
  if (!API_TOKEN) {
    console.error('[Communicare] ⚠️ COMMUNICARE_API_TOKEN não configurado');
    return new Response(
      JSON.stringify({
        ok: false,
        provider: 'communicare',
        error: 'Token da API Communicare não configurado'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
  
  console.log('[Communicare] API Token (primeiros 20 chars):', API_TOKEN.substring(0, 20));

  // 1. OBTER JWT DINÂMICO (com cache de 20h)
  let jwt = await getCachedJWT(supabase);

  if (!jwt) {
    console.log('[Communicare] Cache vazio, gerando novo JWT via SSO...');
    console.log(`[Communicare] GET ${INTEGRATIONS_BASE}/sso/${SSO_CPF}`);
    
    const ssoResponse = await fetch(
      `${INTEGRATIONS_BASE}/sso/${SSO_CPF}`,
      {
        method: 'GET',
        headers: {
          'x-sso-api-key': SSO_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!ssoResponse.ok) {
      const errorText = await ssoResponse.text();
      console.error(`[Communicare] SSO failed: ${ssoResponse.status}`, errorText);
      
      // Log CURL para debug
      const curlSSO = `curl -X GET '${INTEGRATIONS_BASE}/sso/${SSO_CPF}' \\
  -H 'x-sso-api-key: ${SSO_API_KEY.substring(0, 20)}...' \\
  -H 'Content-Type: application/json'`;
      console.log('[Communicare] CURL SSO:', curlSSO);
      
      return new Response(
        JSON.stringify({
          ok: false,
          provider: 'communicare',
          error: `SSO authentication failed: ${ssoResponse.status}`,
          details: {
            status_code: ssoResponse.status,
            response_body: errorText,
            reason: 'Falha na autenticação SSO',
            endpoint: '/sso',
            curl: curlSSO
          }
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ✅ SAFE PARSING: Evitar crash se Communicare retornar HTML ao invés de JSON
    const ssoText = await ssoResponse.text();
    let ssoData;
    try {
      ssoData = JSON.parse(ssoText);
    } catch (parseError) {
      console.error('[Communicare] ❌ Resposta SSO não é JSON válido:', ssoText.substring(0, 500));
      return new Response(
        JSON.stringify({
          ok: false,
          provider: 'communicare',
          error: 'Communicare SSO retornou resposta inválida',
          debug_hint: 'API retornou HTML ao invés de JSON. Possível erro no backend da Communicare.',
          response_preview: ssoText.substring(0, 200)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    jwt = ssoData.token;
    console.log('[Communicare] ✓ JWT gerado com sucesso');
    console.log('[Communicare] JWT (primeiros 30 chars):', jwt.substring(0, 30));
    await cacheJWT(jwt, supabase);
  } else {
    console.log('[Communicare] Usando JWT do cache');
    console.log('[Communicare] JWT (primeiros 30 chars):', jwt.substring(0, 30));
  }

  // 2. CRIAR PACIENTE (se não existir) ou buscar existente
  // ✅ CORRIGIDO: Primeiro buscar por CPF, depois criar se não existir (mesmo com skip_registration)
  let patientId: number | undefined;
  
  const PATIENTS_BASE = Deno.env.get('COMMUNICARE_PATIENTS_BASE') || 
                        'https://api-patients-production.communicare.com.br';
  const cpfClean = payload.cpf.replace(/\D/g, '');
  
  // ✅ PASSO 1: Sempre tentar buscar paciente existente por CPF primeiro
  console.log('[Communicare] 🔍 Buscando paciente existente por CPF:', cpfClean.substring(0, 3) + '***');
  
  try {
    const getRes = await fetch(`${PATIENTS_BASE}/v1/patient?cpf=${cpfClean}`, {
      method: 'GET',
      headers: { 'api_token': API_TOKEN }
    });
    
    if (getRes.ok) {
      const getDataText = await getRes.text();
      try {
        const getData = JSON.parse(getDataText);
        patientId = Array.isArray(getData) ? getData[0]?.id : getData?.id;
        
        if (patientId) {
          console.log('[Communicare] ✓ Paciente encontrado por CPF:', patientId);
        } else {
          console.log('[Communicare] Paciente não encontrado na busca por CPF (resposta vazia)');
        }
      } catch (parseErr) {
        console.warn('[Communicare] Resposta de busca não é JSON válido:', getDataText.substring(0, 200));
      }
    } else {
      console.warn('[Communicare] Busca por CPF retornou status:', getRes.status);
    }
  } catch (fetchError) {
    console.warn('[Communicare] Erro ao buscar paciente por CPF:', fetchError);
  }
  
  // ✅ PASSO 2: Se não encontrou, criar automaticamente (MESMO com skip_registration=true)
  // A Communicare REQUER um patientId para enfileirar, diferente da ClickLife
  if (!patientId) {
    if (payload.skip_registration) {
      console.log('[Communicare] ⚠️ skip_registration=true, mas paciente não existe. Criando automaticamente...');
    } else {
      console.log('[Communicare] Paciente não encontrado, criando...');
    }
    
    const patientResult = await createCommunicarePatient(payload, API_TOKEN);
    
    if (patientResult.success && patientResult.patientId) {
      patientId = patientResult.patientId;
      console.log('[Communicare] ✓ Paciente criado via API:', patientId);
    } else {
      console.warn('[Communicare] Criação de paciente falhou:', patientResult.error);
      
      // ✅ PASSO 2b: Retry - buscar novamente por CPF (pode ter sido criado por outro processo)
      console.log('[Communicare] 🔄 Tentando buscar novamente por CPF após falha de criação...');
      
      try {
        const retryRes = await fetch(`${PATIENTS_BASE}/v1/patient?cpf=${cpfClean}`, {
          method: 'GET',
          headers: { 'api_token': API_TOKEN }
        });
        
        if (retryRes.ok) {
          const retryDataText = await retryRes.text();
          try {
            const retryData = JSON.parse(retryDataText);
            patientId = Array.isArray(retryData) ? retryData[0]?.id : retryData?.id;
            
            if (patientId) {
              console.log('[Communicare] ✓ Paciente encontrado no retry:', patientId);
            }
          } catch (parseErr) {
            console.warn('[Communicare] Resposta do retry não é JSON válido');
          }
        }
      } catch (retryError) {
        console.warn('[Communicare] Erro no retry:', retryError);
      }
    }
  }
  
  // ✅ PASSO 3: Se AINDA não tem patientId, retornar erro estruturado
  if (!patientId) {
    console.error('[Communicare] ❌ Não foi possível criar nem encontrar paciente');
    return new Response(
      JSON.stringify({
        ok: false,
        provider: 'communicare',
        error: 'Não foi possível cadastrar paciente na Communicare. Verifique os dados (nome, CPF, telefone, email) e tente novamente.',
        details: { 
          cpf: cpfClean.substring(0, 3) + '***', 
          reason: 'create_patient_failed',
          hint: 'Verifique se o telefone está no formato +5511999999999 e se todos os campos obrigatórios estão preenchidos.'
        }
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
  console.log('[Communicare] ✓ Usando patientId:', patientId);

  // 3. ENFILEIRAR PACIENTE
  const queuePayload = {
    queueUUID: QUEUE_UUID,
    patientId: patientId, // ✅ ID numérico (não CPF)
  };

  console.log('[Communicare] Enfileirando paciente CPF:', payload.cpf);
  console.log('[Communicare] Payload:', JSON.stringify(queuePayload, null, 2));
  console.log(`[Communicare] POST ${INTEGRATIONS_BASE}/v1/queue`);
  console.log('[Communicare] JWT usado (primeiros 50 chars):', jwt.substring(0, 50) + '...');

  const queueResponse = await fetch(
    `${INTEGRATIONS_BASE}/v1/queue`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_token': jwt, // ✅ JWT do SSO
      },
      body: JSON.stringify(queuePayload)
    }
  );

  const queueText = await queueResponse.text();
  console.log('[Communicare] Response status:', queueResponse.status);
  console.log('[Communicare] Response body:', queueText);

  if (!queueResponse.ok) {
    console.error(`[Communicare] Erro ao enfileirar:`, queueResponse.status);
    
    // Log CURL para debug
    const curlQueue = `curl -X POST '${INTEGRATIONS_BASE}/v1/queue' \\
  -H 'Content-Type: application/json' \\
  -H 'api_token: ${jwt.substring(0, 20)}...' \\
  -d '${JSON.stringify(queuePayload)}'`;
    console.log('[Communicare] CURL Queue:', curlQueue);
    
    return new Response(
      JSON.stringify({
        ok: false,
        provider: 'communicare',
        error: `Falha ao enfileirar paciente: ${queueResponse.status}`,
        details: {
          status_code: queueResponse.status,
          response_body: queueText,
          reason: 'Erro ao adicionar paciente na fila',
          endpoint: '/v1/queue',
          cpf: payload.cpf,
          curl: curlQueue
        }
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  let queueData;
  try {
    queueData = JSON.parse(queueText);
  } catch {
    queueData = { raw: queueText };
  }

  console.log('[Communicare] ✓ Paciente enfileirado com sucesso');

  const finalUrl = queueData.queueURL || `https://communicare.com.br/queue/${QUEUE_UUID}`;

  // ✅ Salvar appointment no banco
  await saveAppointment(payload, 'communicare', finalUrl, supabase);

  return new Response(
    JSON.stringify({
      ok: true,
      url: finalUrl,
      provider: 'communicare',
      reason: 'commercial_hours', // ✅ Adicionar reason para testes
      queuePatientUUID: queueData.queuePatientUUID,
      queueData
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

async function getCachedJWT(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'communicare_jwt')
    .maybeSingle();

  if (!data?.value) {
    console.log('[JWT Cache] Cache vazio');
    return null;
  }

  // Decodificar payload do JWT para verificar expiração
  const payload = JSON.parse(atob(data.value.split('.')[1]));
  const expMs = payload.exp * 1000;
  const nowMs = Date.now();

  if (nowMs >= expMs) {
    console.log('[JWT Cache] JWT expirado');
    return null;
  }

  console.log('[JWT Cache] JWT válido encontrado, expira em:', new Date(expMs).toISOString());
  return data.value;
}

async function cacheJWT(jwt: string, supabase: any): Promise<void> {
  const payload = JSON.parse(atob(jwt.split('.')[1]));
  const expiresAt = new Date(payload.exp * 1000);

  await supabase.from('admin_settings').upsert({
    key: 'communicare_jwt',
    value: jwt,
  });

  console.log('[JWT Cache] Cacheado até', expiresAt.toISOString());
}
