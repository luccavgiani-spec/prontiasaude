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

/**
 * ✅ OTIMIZADO: Busca usuário por email usando getUserByEmail (instantâneo)
 * Antes: listUsers com paginação (lento, até 10 páginas x 1000 users)
 * Agora: getUserByEmail direto (uma chamada, resposta imediata)
 */
async function findUserByEmail(client: ReturnType<typeof createClient>, email: string, envName: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    console.log(`[check-user-exists] ${envName}: buscando email ${normalizedEmail.substring(0, 5)}***`);
    
    // ✅ getUserByEmail é muito mais rápido que listUsers
    const { data, error } = await client.auth.admin.getUserByEmail(normalizedEmail);
    
    if (error) {
      // "User not found" não é erro, significa que não existe
      if (error.message?.includes('not found') || error.message?.includes('User not found')) {
        console.log(`[check-user-exists] ${envName}: NÃO encontrado`);
        return false;
      }
      console.error(`[check-user-exists] ${envName} erro:`, error.message);
      return false;
    }
    
    if (data?.user) {
      console.log(`[check-user-exists] ${envName}: ENCONTRADO! ID: ${data.user.id}`);
      return true;
    }
    
    console.log(`[check-user-exists] ${envName}: NÃO encontrado`);
    return false;
    
  } catch (e) {
    console.error(`[check-user-exists] ${envName} exceção:`, e);
    return false;
  }
}

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
    console.log('[check-user-exists] ====================================');
    console.log('[check-user-exists] Verificando email:', normalizedEmail);

    // Criar clientes para ambos ambientes
    const cloudClient = createClient(CLOUD_URL, CLOUD_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const productionClient = createClient(PRODUCTION_URL, PRODUCTION_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // ✅ Buscar em paralelo usando getUserByEmail (muito mais rápido)
    const [existsInCloud, existsInProduction] = await Promise.all([
      findUserByEmail(cloudClient, normalizedEmail, 'Cloud'),
      findUserByEmail(productionClient, normalizedEmail, 'Produção'),
    ]);

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
    console.log('[check-user-exists] ====================================');

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
