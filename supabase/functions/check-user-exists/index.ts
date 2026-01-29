import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// URLs de ambos os ambientes
const CLOUD_URL = Deno.env.get('SUPABASE_URL')!;
const CLOUD_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PRODUCTION_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const PRODUCTION_SERVICE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('[check-user-exists] Verificando email:', normalizedEmail);

    // Criar clientes para ambos ambientes
    const cloudClient = createClient(CLOUD_URL, CLOUD_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const productionClient = createClient(PRODUCTION_URL, PRODUCTION_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Verificar no Cloud (Lovable Cloud)
    let existsInCloud = false;
    try {
      const { data: cloudUsers, error: cloudError } = await cloudClient.auth.admin.listUsers({
        filter: `email.eq.${normalizedEmail}`
      } as any);
      
      if (!cloudError && cloudUsers?.users) {
        existsInCloud = cloudUsers.users.some(u => u.email?.toLowerCase() === normalizedEmail);
      }
      console.log('[check-user-exists] Cloud:', existsInCloud);
    } catch (e) {
      console.error('[check-user-exists] Erro ao verificar Cloud:', e);
    }

    // Verificar na Produção (Supabase original)
    let existsInProduction = false;
    try {
      const { data: prodUsers, error: prodError } = await productionClient.auth.admin.listUsers({
        filter: `email.eq.${normalizedEmail}`
      } as any);
      
      if (!prodError && prodUsers?.users) {
        existsInProduction = prodUsers.users.some(u => u.email?.toLowerCase() === normalizedEmail);
      }
      console.log('[check-user-exists] Produção:', existsInProduction);
    } catch (e) {
      console.error('[check-user-exists] Erro ao verificar Produção:', e);
    }

    // Determinar qual ambiente usar para login
    let loginEnvironment: 'cloud' | 'production' | 'none' = 'none';
    
    if (existsInCloud) {
      loginEnvironment = 'cloud';
    } else if (existsInProduction) {
      loginEnvironment = 'production';
    }

    // Para cadastro: bloquear se existir em qualquer ambiente
    const canRegister = !existsInCloud && !existsInProduction;

    console.log('[check-user-exists] Resultado:', {
      email: normalizedEmail,
      existsInCloud,
      existsInProduction,
      loginEnvironment,
      canRegister
    });

    return new Response(
      JSON.stringify({
        existsInCloud,
        existsInProduction,
        loginEnvironment,
        canRegister
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-user-exists] Exception:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
