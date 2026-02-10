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
 * ✅ CORRIGIDO: Busca usuário por email via REST API direta do GoTrue
 * Método único e confiável: GET /auth/v1/admin/users com paginação segura (perPage: 50)
 * Resolve o bug onde listUsers com perPage:1000 era ignorado pelo GoTrue
 */
async function findUserByEmail(supabaseUrl: string, serviceKey: string, email: string, envName: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    console.log(`[check-user-exists] ${envName}: buscando email ${normalizedEmail.substring(0, 5)}***`);
    
    // ✅ MÉTODO DIRETO: Chamar GoTrue REST API com paginação segura
    let page = 1;
    const perPage = 50; // Valor que o GoTrue RESPEITA
    const maxPages = 50; // Suporta até 2500 usuários
    
    while (page <= maxPages) {
      const url = `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error(`[check-user-exists] ${envName}: REST API error ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      const users = data.users || data || [];
      
      if (!Array.isArray(users) || users.length === 0) {
        console.log(`[check-user-exists] ${envName}: NÃO encontrado após ${page} páginas`);
        return false;
      }
      
      const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
      if (found) {
        console.log(`[check-user-exists] ${envName}: ENCONTRADO! ID: ${found.id}`);
        return true;
      }
      
      // Se retornou menos que perPage, é a última página
      if (users.length < perPage) {
        console.log(`[check-user-exists] ${envName}: NÃO encontrado (fim da lista, ${page} páginas, total ~${(page-1)*perPage + users.length} users)`);
        return false;
      }
      
      page++;
    }
    
    console.log(`[check-user-exists] ${envName}: NÃO encontrado (limite de ${maxPages} páginas atingido)`);
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

    // ✅ Buscar em paralelo usando REST API direta
    const [existsInCloud, existsInProduction] = await Promise.all([
      findUserByEmail(CLOUD_URL, CLOUD_SERVICE_KEY, normalizedEmail, 'Cloud'),
      findUserByEmail(PRODUCTION_URL, PRODUCTION_SERVICE_KEY, normalizedEmail, 'Produção'),
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
