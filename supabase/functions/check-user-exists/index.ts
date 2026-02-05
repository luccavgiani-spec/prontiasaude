import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

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
 * ✅ ROBUSTO: Busca usuário por email com fallback
 * Método primário: getUserByEmail (rápido, direto)
 * Fallback: listUsers com paginação (lento, mas funciona sempre)
 */
async function findUserByEmail(client: ReturnType<typeof createClient>, email: string, envName: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    console.log(`[check-user-exists] ${envName}: buscando email ${normalizedEmail.substring(0, 5)}***`);
    
    // ✅ Tentar getUserByEmail primeiro (mais rápido)
    if (client.auth.admin?.getUserByEmail) {
      try {
        const { data, error } = await client.auth.admin.getUserByEmail(normalizedEmail);
        
        if (error) {
          // "User not found" não é erro, significa que não existe
          if (error.message?.includes('not found') || error.message?.includes('User not found')) {
            console.log(`[check-user-exists] ${envName}: NÃO encontrado (getUserByEmail)`);
            return false;
          }
          // Outro erro - tentar fallback
          console.warn(`[check-user-exists] ${envName} getUserByEmail error, tentando fallback:`, error.message);
        } else if (data?.user) {
          console.log(`[check-user-exists] ${envName}: ENCONTRADO! ID: ${data.user.id}`);
          return true;
        } else {
          console.log(`[check-user-exists] ${envName}: NÃO encontrado (getUserByEmail)`);
          return false;
        }
      } catch (methodError) {
        console.warn(`[check-user-exists] ${envName}: getUserByEmail não disponível, usando fallback`);
      }
    }
    
    // ✅ FALLBACK: listUsers com paginação (compatível com todas as versões)
    console.log(`[check-user-exists] ${envName}: usando fallback listUsers...`);
    let page = 1;
    const perPage = 1000;
    const maxPages = 10;
    
    while (page <= maxPages) {
      const { data: listData, error: listError } = await client.auth.admin.listUsers({
        page,
        perPage,
      });
      
      if (listError) {
        console.error(`[check-user-exists] ${envName} listUsers error:`, listError.message);
        return false;
      }
      
      const users = listData?.users || [];
      if (users.length === 0) {
        console.log(`[check-user-exists] ${envName}: NÃO encontrado após ${page} páginas`);
        return false;
      }
      
      const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
      if (found) {
        console.log(`[check-user-exists] ${envName}: ENCONTRADO! ID: ${found.id}`);
        return true;
      }
      
      if (users.length < perPage) {
        console.log(`[check-user-exists] ${envName}: NÃO encontrado (fim da lista)`);
        return false;
      }
      
      page++;
    }
    
    console.log(`[check-user-exists] ${envName}: NÃO encontrado (limite de páginas atingido)`);
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

    // ✅ Buscar em paralelo com fallback robusto
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
