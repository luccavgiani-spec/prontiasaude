import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Especialidades disponíveis na Communicare
const COMMUNICARE_SPECIALTIES = [
  'clinico geral', 'consulta', 'laudos', 'psicologo_8', 'psicologo_4',
  'psicologo_1', 'geriatria', 'nutrologo', 'infectologista', 'neurologista',
  'reumatologista', 'nutricionista', 'personal trainer', 'solicitacao_exames',
  'renovacao_receitas'
];

interface SchedulePayload {
  cpf: string;
  email: string;
  nome: string;
  telefone: string;
  especialidade?: string;
  sku: string;
  horario_iso?: string;
  plano_ativo: boolean;
}

/**
 * Registra paciente na ClickLife antes de criar agendamento
 */
async function registerClickLifePatient(
  cpf: string,
  nome: string,
  email: string,
  telefone: string,
  planoId: number
): Promise<{ success: boolean; error?: string; authtoken?: string }> {
  const CLICKLIFE_API = Deno.env.get('CLICKLIFE_API_BASE')!;
  
  const cpfClean = cpf.replace(/\D/g, '');
  const phoneClean = telefone.replace(/\D/g, '').replace(/^\+55/, '');
  
  const payload = {
    nome,
    cpf: cpfClean,
    email,
    senha: "Pr0ntia!2025",
    datanascimento: "01-01-1990",
    sexo: "O",
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
  
  const res = await fetch(`${CLICKLIFE_API}/usuarios/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const resText = await res.text();
  
  if (!res.ok) {
    if (res.status === 409) {
      console.log('[ClickLife] Paciente já cadastrado (409), prosseguindo...');
      return { success: true };
    }
    
    console.error('[ClickLife] Erro no cadastro:', res.status, resText);
    return { success: false, error: `HTTP ${res.status}: ${resText}` };
  }
  
  // Investigar se retorna authtoken
  try {
    const data = JSON.parse(resText);
    console.log('[ClickLife] Resposta do cadastro:', JSON.stringify(data));
    if (data.authtoken || data.auth_token) {
      console.log('[ClickLife] ✓ authtoken encontrado na resposta do cadastro');
      return { 
        success: true, 
        authtoken: data.authtoken || data.auth_token 
      };
    }
  } catch (e) {
    console.log('[ClickLife] Resposta não é JSON válido');
  }
  
  console.log('[ClickLife] Paciente cadastrado com sucesso');
  return { success: true };
}


// Função removida: getOrCreateCommunicarePatient
// A Communicare cria o paciente automaticamente ao enfileirar

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: SchedulePayload = await req.json();
    console.log('[schedule-redirect] Request:', payload);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Verificar override do admin
    const { data: forceData } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'force_clicklife')
      .maybeSingle();

    if (forceData?.value === 'true') {
      console.log('[schedule-redirect] Admin override: Forçando ClickLife');
      return await redirectClickLife(payload, 'admin_override');
    }

    // 2. Verificar plano ativo
    if (payload.plano_ativo) {
      console.log('[schedule-redirect] Plano ativo detectado → ClickLife');
      return await redirectClickLife(payload, 'active_plan');
    }

    // 3. Verificar horário e especialidade
    const horario = payload.horario_iso ? new Date(payload.horario_iso) : new Date();
    const especialidadeNorm = payload.especialidade?.toLowerCase() || '';

    const isWeekend = horario.getDay() === 0 || horario.getDay() === 6;
    const hour = horario.getUTCHours() - 3; // Ajustar para horário de Brasília (UTC-3)
    const isNighttime = hour < 7 || hour >= 19;

    if (isWeekend) {
      console.log('[schedule-redirect] Fim de semana → ClickLife');
      return await redirectClickLife(payload, 'weekend');
    }

    if (isNighttime) {
      console.log('[schedule-redirect] Horário noturno → ClickLife');
      return await redirectClickLife(payload, 'nighttime');
    }

    // 4. Verificar disponibilidade na Communicare
    if (!COMMUNICARE_SPECIALTIES.includes(especialidadeNorm)) {
      console.log('[schedule-redirect] Especialidade indisponível na Communicare → ClickLife');
      return await redirectClickLife(payload, 'specialty_unavailable');
    }

    // 5. Redirecionar para Communicare
    console.log('[schedule-redirect] Condições atendidas → Communicare');
    return await redirectCommunicare(payload, supabase);

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

async function redirectClickLife(payload: SchedulePayload, reason: string) {
  console.log(`[ClickLife] Motivo: ${reason}`);

  const API_BASE = Deno.env.get('CLICKLIFE_API_BASE')!;
  const AUTH_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN')!;
  const REDIRECT_URL = Deno.env.get('CLICKLIFE_REDIRECT_URL')!;
  const CUPOM_DEFAULT = Deno.env.get('CLICKLIFE_CUPOM_DEFAULT');

  // Determinar plano_id: 864 se plano ativo + especialista, senão 863
  const planoId = (payload.plano_ativo && ESPECIALISTA_SKUS.includes(payload.sku)) ? 864 : 863;
  
  console.log(`[ClickLife] plano_id selecionado: ${planoId} (SKU: ${payload.sku}, plano_ativo: ${payload.plano_ativo})`);

  // Tentar cadastrar paciente antes de agendar
  const registration = await registerClickLifePatient(
    payload.cpf,
    payload.nome,
    payload.email,
    payload.telefone,
    planoId
  );

  if (!registration.success && registration.error) {
    console.warn('[ClickLife] Cadastro falhou, tentando agendar mesmo assim:', registration.error);
  }

  // Usar token de integrador (cadastro não retorna authtoken acessível ainda)
  const requestBody: any = {
    cpf: payload.cpf.replace(/\D/g, ''),
    authtoken: AUTH_TOKEN,
    especialidadeid: SKU_TO_CLICKLIFE_ID[payload.sku] || 8,
  };

  // Adicionar cupom se NÃO tiver plano ativo
  if (!payload.plano_ativo && CUPOM_DEFAULT) {
    requestBody.cupom = CUPOM_DEFAULT;
    console.log(`[ClickLife] Cupom adicionado: ${CUPOM_DEFAULT}`);
  }

  console.log('[ClickLife] Request body:', requestBody);

  const response = await fetch(
    `${API_BASE}/atendimentos/atendimentos`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
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
  
  const data = await response.json();
  console.log('[ClickLife] Response:', data);

  return new Response(
    JSON.stringify({
      ok: true,
      url: REDIRECT_URL,
      provider: 'clicklife',
      reason,
      plano_id: planoId
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

async function redirectCommunicare(payload: SchedulePayload, supabase: any) {
  console.log('[Communicare] Iniciando redirecionamento');

  const INTEGRATIONS_BASE = Deno.env.get('COMMUNICARE_INTEGRATIONS_BASE')!;
  const SSO_API_KEY = Deno.env.get('COMMUNICARE_SSO_API_KEY')!;
  const SSO_CPF = Deno.env.get('COMMUNICARE_SSO_CPF')!;
  const QUEUE_UUID = Deno.env.get('COMMUNICARE_QUEUE_UUID')!;

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

    const ssoData = await ssoResponse.json();
    jwt = ssoData.token;
    console.log('[Communicare] ✓ JWT gerado com sucesso');
    console.log('[Communicare] JWT (primeiros 30 chars):', jwt.substring(0, 30));
    await cacheJWT(jwt, supabase);
  } else {
    console.log('[Communicare] Usando JWT do cache');
    console.log('[Communicare] JWT (primeiros 30 chars):', jwt.substring(0, 30));
  }

  // 2. ENFILEIRAR PACIENTE (Communicare cria paciente automaticamente)
  const cpfClean = payload.cpf.replace(/\D/g, '');
  
  const queuePayload = {
    queueUUID: QUEUE_UUID,
    patientId: cpfClean, // Usar CPF como patientId
  };

  console.log('[Communicare] Enfileirando paciente CPF:', payload.cpf);
  console.log('[Communicare] Payload:', JSON.stringify(queuePayload, null, 2));
  console.log(`[Communicare] POST ${INTEGRATIONS_BASE}/v1/queue`);

  const queueResponse = await fetch(
    `${INTEGRATIONS_BASE}/v1/queue`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_token': jwt, // ✅ JWT DINÂMICO (não token fixo)
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
  -H 'api_token: ${jwt.substring(0, 30)}...' \\
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

  return new Response(
    JSON.stringify({
      ok: true,
      url: queueData.queueURL || `https://communicare.com.br/queue/${QUEUE_UUID}`,
      provider: 'communicare',
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
    .eq('key', 'communicare_jwt_cache')
    .maybeSingle();

  if (!data?.value) return null;

  const { data: expiresData } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'communicare_jwt_expires_at')
    .maybeSingle();

  const expiresAt = new Date(expiresData?.value || 0);
  if (expiresAt < new Date()) {
    console.log('[JWT Cache] Expirado');
    return null;
  }

  console.log('[JWT Cache] JWT válido encontrado');
  return data.value;
}

async function cacheJWT(jwt: string, supabase: any): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 20); // ✅ 20 horas (renovação diária)

  await supabase.from('admin_settings').upsert([
    { key: 'communicare_jwt_cache', value: jwt },
    { key: 'communicare_jwt_expires_at', value: expiresAt.toISOString() }
  ]);

  console.log(`[JWT Cache] Cacheado até ${expiresAt.toISOString()}`);
}
