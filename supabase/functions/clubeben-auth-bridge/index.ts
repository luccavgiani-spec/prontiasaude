import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClubeBenPayload {
  id: string;
  nome: string;
  email: string;
  sexo: 'M' | 'F';
  nascimento: string;
  clube_id: number;
  cpf: string;
  utm_source: string;
  status_email: 0 | 1;
  status_sms: 0 | 1;
  uf: string;
}

async function generateClubeBenJWT(payload: ClubeBenPayload): Promise<string> {
  const secret = Deno.env.get('CLUBEBEN_JWT_SECRET');
  if (!secret) throw new Error('CLUBEBEN_JWT_SECRET not configured');

  // Helper: Base64URL encode (padrão JWT)
  const base64url = (data: Uint8Array): string => {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  // 1. Header JWT padrão
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));

  // 2. Payload com expiração (10 minutos)
  const payloadWithExp = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 600
  };
  const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payloadWithExp)));

  // 3. Dados a assinar: header.payload
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  // 4. Importar chave HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // 5. Assinar com HMAC-SHA256
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(dataToSign)
  );

  // 6. Codificar assinatura em Base64URL
  const encodedSignature = base64url(new Uint8Array(signature));

  // 7. Retornar JWT completo
  return `${dataToSign}.${encodedSignature}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    console.log('[ClubeBen Auth Bridge] Generating access for user:', user_id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar dados do paciente
    const { data: patient, error: fetchError } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (fetchError || !patient) {
      console.error('[ClubeBen Auth Bridge] Patient not found:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Patient not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ VALIDAÇÃO OBRIGATÓRIA: Verificar plano ativo
    const { data: activePlan, error: planError } = await supabase
      .from('patient_plans')
      .select('plan_code, plan_expires_at, status')
      .eq('status', 'active')
      .gte('plan_expires_at', new Date().toISOString())
      .or(`user_id.eq.${user_id},email.eq.${patient.email}`)
      .order('plan_expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activePlan || planError) {
      console.warn('[ClubeBen Auth Bridge] No active plan found for user:', user_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'plan_required',
          message: 'Plano ativo é necessário para acessar o Clube de Benefícios.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ClubeBen Auth Bridge] Active plan verified:', activePlan.plan_code);

    // Validar campos obrigatórios
    if (!patient.cpf || !patient.birth_date) {
      console.warn('[ClubeBen Auth Bridge] Missing CPF or birth_date:', user_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields',
          needs_completion: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar payload ClubeBen
    const clubebenPayload: ClubeBenPayload = {
      id: patient.id,
      nome: `${patient.first_name} ${patient.last_name || ''}`.trim(),
      email: patient.email!,
      sexo: patient.gender?.toUpperCase().startsWith('M') ? 'M' : 'F',
      nascimento: patient.birth_date,
      clube_id: parseInt(Deno.env.get('CLUBEBEN_CLUBE_ID') || '269'),
      cpf: patient.cpf.replace(/\D/g, ''),
      utm_source: Deno.env.get('CLUBEBEN_UTM_SOURCE') || 'prontiasaude_site',
      status_email: patient.status_email || 1,
      status_sms: patient.status_sms || 1,
      uf: patient.state || 'SP',
    };

    // Gerar JWT
    const jwt = await generateClubeBenJWT(clubebenPayload);

    // Gerar URL de redirecionamento
    const baseUrl = Deno.env.get('CLUBEBEN_BASE_URL');
    const redirectUrl = `${baseUrl}/auth/general/?token=${encodeURIComponent(jwt)}`;

    console.log('[ClubeBen Auth Bridge] JWT generated successfully for:', user_id);

    return new Response(
      JSON.stringify({ success: true, redirect_url: redirectUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ClubeBen Auth Bridge] Exception:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
