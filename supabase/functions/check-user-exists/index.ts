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
 * Busca usuário por email usando paginação (o filtro email.eq não funciona corretamente)
 */
async function findUserByEmail(client: ReturnType<typeof createClient>, email: string, envName: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  let page = 1;
  const perPage = 1000;
  
  try {
    while (true) {
      console.log(`[check-user-exists] ${envName}: buscando página ${page}...`);
      
      const { data, error } = await client.auth.admin.listUsers({
        page,
        perPage,
      });
      
      if (error) {
        console.error(`[check-user-exists] ${envName} erro na página ${page}:`, error.message);
        return false;
      }
      
      if (!data?.users?.length) {
        console.log(`[check-user-exists] ${envName}: nenhum usuário na página ${page}, encerrando`);
        break;
      }
      
      console.log(`[check-user-exists] ${envName}: ${data.users.length} usuários na página ${page}`);
      
      // Buscar correspondência exata por email
      const match = data.users.find(u => u.email?.toLowerCase() === normalizedEmail);
      
      if (match) {
        console.log(`[check-user-exists] ${envName}: ENCONTRADO! ID: ${match.id}`);
        return true;
      }
      
      // Se retornou menos que o limite, não há mais páginas
      if (data.users.length < perPage) {
        console.log(`[check-user-exists] ${envName}: última página alcançada`);
        break;
      }
      
      page++;
      
      // Limite de segurança para evitar loop infinito
      if (page > 10) {
        console.log(`[check-user-exists] ${envName}: limite de páginas alcançado (10)`);
        break;
      }
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

    // Buscar em paralelo nos dois ambientes usando paginação
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
