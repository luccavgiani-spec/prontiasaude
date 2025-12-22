import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://deno.land/x/jose@v5.2.0/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-signature',
};

interface SSORequest {
  cpf: string;
  email: string;
  nome: string;
  telefone: string;
  sexo?: string;
  birth_date?: string;
  planoid: number;
  redirect_to?: string;
  request_id?: string;
}

function validateAndNormalizeCPF(cpf: string): string | null {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return null;
  return digits;
}

function validateBirthDate(dateStr: string): string | null {
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  const brRegex = /^\d{2}-\d{2}-\d{4}$/;
  
  // Aceita YYYY-MM-DD ou DD-MM-YYYY
  if (!isoRegex.test(dateStr) && !brRegex.test(dateStr)) return null;
  
  let date: Date;
  if (isoRegex.test(dateStr)) {
    date = new Date(dateStr);
  } else {
    // DD-MM-YYYY -> YYYY-MM-DD para validação
    const [day, month, year] = dateStr.split('-');
    date = new Date(`${year}-${month}-${day}`);
  }
  
  if (isNaN(date.getTime())) return null;
  
  const now = new Date();
  const minDate = new Date('1900-01-01');
  if (date >= now || date < minDate) return null;
  
  return dateStr;
}

function convertToClickLifeDate(dateStr: string): string {
  // Se já está em DD-MM-YYYY, retorna
  const brRegex = /^\d{2}-\d{2}-\d{4}$/;
  if (brRegex.test(dateStr)) return dateStr;
  
  // Se está em YYYY-MM-DD, converte
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoRegex.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  }
  
  return dateStr;
}

async function validateHMAC(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  
  const encoder = new TextEncoder();
  const key = encoder.encode(secret);
  const data = encoder.encode(body);
  
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return signatureHex === signature;
  } catch {
    return false;
  }
}

async function createPhoneHash(phone: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(phone);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    const payload: SSORequest = JSON.parse(bodyText);
    
    const requestId = payload.request_id || `req-${Date.now()}`;
    
    console.log(JSON.stringify({
      request_id: requestId,
      function: 'clicklife-sso',
      event: 'request_received',
      cpf_masked: payload.cpf.substring(0, 3) + '***',
      planoid: payload.planoid
    }));

    // HMAC validation
    const MC_HMAC_SECRET = Deno.env.get('MC_HMAC_SECRET');
    if (MC_HMAC_SECRET) {
      const signature = req.headers.get('x-client-signature');
      const isValid = await validateHMAC(bodyText, signature, MC_HMAC_SECRET);
      if (!isValid) {
        console.error('[clicklife-sso] Invalid HMAC signature');
        return new Response(
          JSON.stringify({ ok: false, error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!payload.cpf || !payload.email || !payload.nome || !payload.telefone) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Campos obrigatórios: cpf, email, nome, telefone',
          stage: 'validation'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const CLICKLIFE_API = Deno.env.get('CLICKLIFE_API_BASE') || 'https://erpapp.sistemaclicklife.com.br/api';
    const INTEGRATOR_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN');
    const PATIENT_PASSWORD = Deno.env.get('CLICKLIFE_PATIENT_DEFAULT_PASSWORD');
    const JWT_SECRET = Deno.env.get('AUTH_JWT_SECRET');
    const BASE_URL = Deno.env.get('BASE_CONSULTAS_URL') || 'https://prontiasaude.com.br';

    if (!INTEGRATOR_TOKEN || !JWT_SECRET || !PATIENT_PASSWORD) {
      console.error('[clicklife-sso] Variáveis de ambiente ausentes:', {
        hasIntegratorToken: !!INTEGRATOR_TOKEN,
        hasJwtSecret: !!JWT_SECRET,
        hasPatientPassword: !!PATIENT_PASSWORD
      });
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Configuração incompleta',
          stage: 'config'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cpfClean = validateAndNormalizeCPF(payload.cpf);
    if (!cpfClean) {
      return new Response(
        JSON.stringify({ ok: false, error: 'CPF inválido', stage: 'validation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalização de telefone com validação
    let phoneClean = (payload.telefone ?? '').toString().replace(/\D/g, '');
    if (phoneClean.startsWith('55')) phoneClean = phoneClean.slice(2);
    if (phoneClean.length < 10 || phoneClean.length > 11) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Telefone inválido (10-11 dígitos)', stage: 'validation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let birthDate = '01-01-1990';
    if (payload.birth_date) {
      const validDate = validateBirthDate(payload.birth_date);
      if (!validDate) {
        return new Response(
          JSON.stringify({ ok: false, error: 'birth_date inválido (formato: YYYY-MM-DD ou DD-MM-YYYY)', stage: 'validation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      birthDate = convertToClickLifeDate(validDate);
    }
    
    const gender = (payload.sexo === 'M' || payload.sexo === 'F') ? payload.sexo : 'M';

    const patientPayload = {
      nome: payload.nome,
      cpf: cpfClean,
      email: payload.email,
      senha: PATIENT_PASSWORD,
      datanascimento: birthDate,
      sexo: gender,
      telefone: phoneClean,
      logradouro: 'Rua Principal',
      numero: '0',
      bairro: 'Centro',
      cep: '00000000',
      cidade: 'São Paulo',
      estado: 'SP',
      empresaid: 9083,
      planoid: payload.planoid
    };

    console.log(JSON.stringify({
      request_id: requestId,
      event: 'registering_patient'
    }));

    const registerRes = await fetch(`${CLICKLIFE_API}/usuarios/usuarios`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'authtoken': INTEGRATOR_TOKEN
      },
      body: JSON.stringify(patientPayload)
    });

    const registerText = await registerRes.text();
    let alreadyExists = false;

    if (![200, 201, 409].includes(registerRes.status)) {
      // Plano A (pragmático): qualquer 400 = soft fail → prossegue para login
      if (registerRes.status === 400) {
        console.warn(JSON.stringify({
          request_id: requestId,
          event: 'registration_soft_fail_400',
          vendor_status: registerRes.status,
          vendor_body: registerText.substring(0, 800),
          note: 'Prosseguindo para login (usuário já existe no funil)'
        }));
        alreadyExists = true;
      } 
      // 422 com mensagens específicas também tolera (mantém compatibilidade)
      else if (registerRes.status === 422) {
        const lowerText = registerText.toLowerCase();
        if (lowerText.includes('já cadastrado') || 
            lowerText.includes('ja cadastrado') ||
            lowerText.includes('already exists') ||
            lowerText.includes('cpf já existe') ||
            lowerText.includes('email já existe')) {
          console.log(JSON.stringify({
            request_id: requestId,
            event: 'patient_already_exists',
            status: registerRes.status
          }));
          alreadyExists = true;
        } else {
          // 422 sem mensagem conhecida → erro
          console.error(JSON.stringify({
            request_id: requestId,
            event: 'registration_failed_422',
            status: registerRes.status,
            response: registerText.substring(0, 500)
          }));
          return new Response(
            JSON.stringify({ 
              ok: false, 
              error: `Cadastro falhou: HTTP ${registerRes.status}`,
              stage: 'registration',
              vendor_status: registerRes.status,
              vendor_body: registerText.substring(0, 500)
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      // Outros status (5xx, 403, etc.) → erro fatal
      else {
        console.error(JSON.stringify({
          request_id: requestId,
          event: 'registration_failed_other',
          status: registerRes.status,
          response: registerText.substring(0, 500)
        }));
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: `Cadastro falhou: HTTP ${registerRes.status}`,
            stage: 'registration',
            vendor_status: registerRes.status,
            vendor_body: registerText.substring(0, 500)
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const activationPayload = {
      authtoken: INTEGRATOR_TOKEN,
      cpf: cpfClean,
      empresaid: 9083,
      planoid: payload.planoid,
      proposito: "Ativar"
    };

    console.log(JSON.stringify({
      request_id: requestId,
      event: 'activating_patient'
    }));

    const activationRes = await fetch(`${CLICKLIFE_API}/usuarios/ativacao`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authtoken': INTEGRATOR_TOKEN
      },
      body: JSON.stringify(activationPayload)
    });

    if (!activationRes.ok) {
      const activationError = await activationRes.text();
      console.error(JSON.stringify({
        request_id: requestId,
        event: 'activation_failed',
        status: activationRes.status,
        response: activationError.substring(0, 500)
      }));
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: `Ativação falhou: HTTP ${activationRes.status}`,
          stage: 'activation',
          vendor_status: activationRes.status,
          vendor_body: activationError.substring(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(JSON.stringify({
      request_id: requestId,
      event: 'logging_in'
    }));

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

    if (!loginRes.ok) {
      const loginError = await loginRes.text();
      console.error(JSON.stringify({
        request_id: requestId,
        event: 'login_failed',
        status: loginRes.status,
        response: loginError.substring(0, 500)
      }));
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: `Login falhou: HTTP ${loginRes.status}`,
          stage: 'login',
          vendor_status: loginRes.status,
          vendor_body: loginError.substring(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const loginData = await loginRes.json();
    const clicklifeToken = loginData.authtoken || loginData.token;

    if (!clicklifeToken) {
      console.error('[clicklife-sso] Login não retornou token');
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Login não retornou authtoken',
          stage: 'login',
          vendor_status: loginRes.status
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get patient_id
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('cpf', cpfClean)
      .maybeSingle();

    const patientId = patient?.id || crypto.randomUUID();
    const phoneHash = await createPhoneHash(payload.telefone);
    const jti = `sso-${Date.now()}-${crypto.randomUUID()}`;

    const jwtPayload = {
      cpf: cpfClean,
      clicklife_token: clicklifeToken,
      planoid: payload.planoid,
      redirect_to: payload.redirect_to || '/especialidades',
      jti: jti,
      patient_id: patientId,
      phone_hash: phoneHash,
      aud: 'CLICKLIFE',
      exp: Math.floor(Date.now() / 1000) + (5 * 60)
    };

    const { error: insertError } = await supabase
      .from('sso_tokens')
      .insert({
        jti: jti,
        patient_id: patientId,
        phone_hash: phoneHash,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      });

    if (insertError) {
      console.error(JSON.stringify({
        request_id: requestId,
        event: 'sso_token_insert_failed',
        error: insertError.message
      }));
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Erro ao gerar link SSO',
          stage: 'sso_token_creation',
          details: insertError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const secret = new TextEncoder().encode(JWT_SECRET);
    const jwt = await new jose.SignJWT(jwtPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(secret);

    const ssoUrl = `${BASE_URL}/sso?token=${jwt}`;

    await supabase
      .from('metrics')
      .insert({
        metric_type: 'sso_link_issued',
        platform: 'clicklife',
        status: 'generated',
        patient_email: payload.email,
        metadata: {
          request_id: requestId,
          cpf: cpfClean.substring(0, 3) + '***',
          planoid: payload.planoid,
          jti: jti,
          expires_in_sec: 300,
          timestamp: new Date().toISOString()
        }
      });

    console.log(JSON.stringify({
      request_id: requestId,
      event: 'sso_link_generated',
      jti: jti
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        sso_url: ssoUrl,
        expires_in_sec: 300
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[clicklife-sso] Exception:', error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error.message || 'Internal error',
        stage: 'exception'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
