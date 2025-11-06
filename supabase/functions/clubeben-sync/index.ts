import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { create } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

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

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  return await create(
    { alg: "HS256", typ: "JWT" },
    { ...payload, exp: Math.floor(Date.now() / 1000) + 600 },
    key
  );
}

async function syncWithClubeBen(jwt: string): Promise<{ success: boolean; error?: string }> {
  const baseUrl = Deno.env.get('CLUBEBEN_BASE_URL');
  if (!baseUrl) throw new Error('CLUBEBEN_BASE_URL not configured');

  try {
    const response = await fetch(`${baseUrl}/auth/general/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: jwt }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[ClubeBen Sync] API Error:', response.status, text);
      return { success: false, error: `API returned ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error('[ClubeBen Sync] Network error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_email, user_id, trigger_source } = await req.json();
    console.log('[ClubeBen Sync] Starting sync:', { user_email, user_id, trigger_source });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar dados do paciente
    const { data: patient, error: fetchError } = await supabase
      .from('patients')
      .select('*')
      .or(user_email ? `email.eq.${user_email}` : `id.eq.${user_id}`)
      .single();

    if (fetchError || !patient) {
      console.error('[ClubeBen Sync] Patient not found:', fetchError);
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
      .or(`user_id.eq.${patient.id},email.eq.${patient.email}`)
      .order('plan_expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activePlan || planError) {
      console.warn('[ClubeBen Sync] No active plan found for patient:', patient.id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'plan_required',
          message: 'Plano ativo é necessário para sincronizar com o Clube de Benefícios.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ClubeBen Sync] Active plan verified:', activePlan.plan_code);

    // Validar campos obrigatórios
    if (!patient.cpf || !patient.birth_date || !patient.email || !patient.first_name) {
      console.warn('[ClubeBen Sync] Missing required fields:', patient.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar limite de retry
    if (patient.clubeben_retry_count >= 3) {
      console.warn('[ClubeBen Sync] Max retries reached:', patient.id);
      await supabase
        .from('patients')
        .update({ clubeben_status: 'error' })
        .eq('id', patient.id);
      
      return new Response(
        JSON.stringify({ success: false, error: 'Max retries reached' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar payload ClubeBen
    const clubebenPayload: ClubeBenPayload = {
      id: patient.id,
      nome: `${patient.first_name} ${patient.last_name || ''}`.trim(),
      email: patient.email,
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

    // Sincronizar com ClubeBen
    const syncResult = await syncWithClubeBen(jwt);

    // Atualizar status no banco
    const updateData = syncResult.success
      ? {
          clubeben_status: 'active',
          clubeben_last_sync: new Date().toISOString(),
          clubeben_retry_count: 0,
        }
      : {
          clubeben_status: 'pending',
          clubeben_last_sync: new Date().toISOString(),
          clubeben_retry_count: (patient.clubeben_retry_count || 0) + 1,
        };

    await supabase.from('patients').update(updateData).eq('id', patient.id);

    console.log('[ClubeBen Sync] Result:', {
      patient_id: patient.id,
      success: syncResult.success,
      retry_count: updateData.clubeben_retry_count,
    });

    return new Response(
      JSON.stringify({ success: syncResult.success, error: syncResult.error }),
      { status: syncResult.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ClubeBen Sync] Exception:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
