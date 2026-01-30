import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * sync-google-user
 * 
 * Esta função é chamada após login Google OAuth para garantir que o usuário
 * exista em AMBOS os ambientes (Cloud + Produção).
 * 
 * Diferente de create-user-both-envs:
 * - Não falha se o usuário já existe no Cloud (é esperado)
 * - Cria apenas na Produção se não existir lá
 * - Usa senha aleatória (usuário usa Google para login)
 * - Sincroniza tabela patients em ambos os ambientes
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Gera senha aleatória forte (nunca será usada - login é via Google)
function generateRandomPassword(length: number = 24): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, cloudUserId, metadata } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-google-user] Sincronizando usuário Google: ${email}`);

    // URLs e chaves dos ambientes
    const CLOUD_URL = Deno.env.get('SUPABASE_URL')!;
    const CLOUD_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const PROD_URL = Deno.env.get('ORIGINAL_SUPABASE_URL') || 'https://ploqujuhpwutpcibedbr.supabase.co';
    const PROD_SRK = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY')!;

    if (!PROD_SRK) {
      console.error('[sync-google-user] ORIGINAL_SUPABASE_SERVICE_ROLE_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'Configuração de produção ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar clientes admin para ambos os ambientes
    const cloudAdmin = createClient(CLOUD_URL, CLOUD_SRK, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const prodAdmin = createClient(PROD_URL, PROD_SRK, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Verificar se já existe na Produção auth.users
    const { data: prodUsers } = await prodAdmin.auth.admin.listUsers();
    const existsInProd = prodUsers?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());

    let prodUserId: string | null = null;
    let createdInProd = false;

    if (existsInProd) {
      console.log(`[sync-google-user] Usuário já existe na Produção: ${email}`);
      const existingUser = prodUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      prodUserId = existingUser?.id || null;
    } else {
      // 2. Criar usuário na Produção com senha aleatória
      console.log(`[sync-google-user] Criando usuário na Produção: ${email}`);
      
      const randomPassword = generateRandomPassword();
      
      const { data: newUser, error: createError } = await prodAdmin.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true, // Já confirma o email (veio do Google)
        user_metadata: {
          first_name: metadata?.first_name || null,
          last_name: metadata?.last_name || null,
          provider: 'google',
          synced_from_cloud: true,
          cloud_user_id: cloudUserId,
        }
      });

      if (createError) {
        console.error('[sync-google-user] Erro ao criar usuário na Produção:', createError.message);
        // Não falhar - pode ser race condition
        if (!createError.message.includes('already been registered')) {
          return new Response(
            JSON.stringify({ error: `Erro ao criar usuário: ${createError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        prodUserId = newUser?.user?.id || null;
        createdInProd = true;
        console.log(`[sync-google-user] ✅ Usuário criado na Produção: ${prodUserId}`);
      }
    }

    // 3. Sincronizar tabela patients em ambos os ambientes
    const patientData = {
      email: email.toLowerCase(),
      first_name: metadata?.first_name || null,
      last_name: metadata?.last_name || null,
      source: 'google_oauth',
    };

    // 3a. Garantir patient no Cloud (com user_id do Cloud)
    if (cloudUserId) {
      const { data: cloudPatient } = await cloudAdmin
        .from('patients')
        .select('id')
        .eq('user_id', cloudUserId)
        .maybeSingle();

      if (!cloudPatient) {
        // Verificar se existe por email
        const { data: cloudPatientByEmail } = await cloudAdmin
          .from('patients')
          .select('id')
          .eq('email', email.toLowerCase())
          .maybeSingle();

        if (cloudPatientByEmail) {
          // Atualizar user_id
          await cloudAdmin
            .from('patients')
            .update({ user_id: cloudUserId, ...patientData })
            .eq('id', cloudPatientByEmail.id);
          console.log(`[sync-google-user] Patient Cloud atualizado: ${cloudPatientByEmail.id}`);
        } else {
          // Criar novo
          const { error: insertCloudError } = await cloudAdmin
            .from('patients')
            .insert({ user_id: cloudUserId, ...patientData });
          
          if (insertCloudError && !insertCloudError.message.includes('duplicate')) {
            console.warn('[sync-google-user] Erro ao criar patient Cloud:', insertCloudError.message);
          } else {
            console.log(`[sync-google-user] ✅ Patient Cloud criado para: ${email}`);
          }
        }
      }
    }

    // 3b. Garantir patient na Produção (com user_id da Produção)
    if (prodUserId) {
      const { data: prodPatient } = await prodAdmin
        .from('patients')
        .select('id')
        .eq('user_id', prodUserId)
        .maybeSingle();

      if (!prodPatient) {
        // Verificar se existe por email
        const { data: prodPatientByEmail } = await prodAdmin
          .from('patients')
          .select('id')
          .eq('email', email.toLowerCase())
          .maybeSingle();

        if (prodPatientByEmail) {
          // Atualizar user_id
          await prodAdmin
            .from('patients')
            .update({ user_id: prodUserId, ...patientData })
            .eq('id', prodPatientByEmail.id);
          console.log(`[sync-google-user] Patient Produção atualizado: ${prodPatientByEmail.id}`);
        } else {
          // Criar novo
          const { error: insertProdError } = await prodAdmin
            .from('patients')
            .insert({ user_id: prodUserId, ...patientData });
          
          if (insertProdError && !insertProdError.message.includes('duplicate')) {
            console.warn('[sync-google-user] Erro ao criar patient Produção:', insertProdError.message);
          } else {
            console.log(`[sync-google-user] ✅ Patient Produção criado para: ${email}`);
          }
        }
      }
    }

    console.log(`[sync-google-user] ✅ Sincronização concluída para: ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        email,
        cloudUserId,
        prodUserId,
        createdInProd,
        message: createdInProd 
          ? 'Usuário sincronizado com Produção' 
          : 'Usuário já existia em ambos os ambientes'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-google-user] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
