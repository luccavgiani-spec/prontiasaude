import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLOUD_URL = "https://yrsjluhhnhxogdgnbnya.supabase.co";
const PRODUCTION_URL = "https://ploqujuhpwutpcibedbr.supabase.co";

interface CreateUserRequest {
  email: string;
  password: string;
  metadata?: {
    first_name?: string;
    last_name?: string;
    cpf?: string;
    phone_e164?: string;
    birth_date?: string;
    gender?: string;
    cep?: string;
    address_line?: string;
    address_number?: string;
    complement?: string;
    city?: string;
    state?: string;
    terms_accepted_at?: string;
    marketing_opt_in?: boolean;
  };
}

async function checkEmailExists(supabaseUrl: string, serviceKey: string, email: string, envName: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  try {
    let page = 1;
    const perPage = 50;
    const maxPages = 50;
    while (page <= maxPages) {
      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        console.error(`[create-user-both-envs] ${envName}: REST API error ${response.status}`);
        return false;
      }
      const data = await response.json();
      const users = data.users || data || [];
      if (!Array.isArray(users) || users.length === 0) return false;
      const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
      if (found) {
        console.log(`[create-user-both-envs] ${envName}: Email já existe! ID: ${found.id}`);
        return true;
      }
      if (users.length < perPage) return false;
      page++;
    }
    return false;
  } catch (err) {
    console.error(`[create-user-both-envs] ${envName}: Exceção ao verificar email:`, err);
    return false;
  }
}

async function findUserIdByEmail(supabaseUrl: string, serviceKey: string, email: string): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();
  try {
    let page = 1;
    while (page <= 50) {
      const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=50`, {
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey, 'Content-Type': 'application/json' }
      });
      if (!resp.ok) break;
      const d = await resp.json();
      const users = d.users || d || [];
      const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
      if (found) return found.id;
      if (users.length < 50) break;
      page++;
    }
  } catch (e: any) {
    console.error(`[create-user-both-envs] Erro ao buscar ID:`, e.message);
  }
  return null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[create-user-both-envs] ========================================");
    console.log("[create-user-both-envs] Iniciando criação (Cloud primeiro, Prod depois)...");

    const body: CreateUserRequest = await req.json();
    const { email, password, metadata } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Email e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[create-user-both-envs] Email: ${normalizedEmail}`);

    const cloudServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const prodServiceKey = Deno.env.get("ORIGINAL_SUPABASE_SERVICE_ROLE_KEY");

    if (!cloudServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Configuração de Cloud incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!prodServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Configuração de Produção incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cloudClient = createClient(CLOUD_URL, cloudServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const prodClient = createClient(PRODUCTION_URL, prodServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar existência em paralelo
    const [existsInCloud, existsInProd] = await Promise.all([
      checkEmailExists(CLOUD_URL, cloudServiceKey, normalizedEmail, "Cloud"),
      checkEmailExists(PRODUCTION_URL, prodServiceKey, normalizedEmail, "Produção"),
    ]);

    if (existsInCloud && existsInProd) {
      return new Response(
        JSON.stringify({ success: false, error: "Este email já está cadastrado. Faça login ou recupere sua senha.", existsInCloud: true, existsInProd: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // 1) CRIAR NO CLOUD PRIMEIRO (principal)
    // =============================================
    let cloudUserId: string | null = null;

    if (!existsInCloud) {
      console.log("[create-user-both-envs] Criando usuário no Cloud...");
      try {
        const { data: cloudData, error: cloudError } = await cloudClient.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: metadata,
        });
        if (cloudError) {
          console.error("[create-user-both-envs] ❌ Erro ao criar no Cloud:", cloudError.message);
          // Cloud é o ambiente principal - se falhar E não existe em prod, é erro fatal
          if (!existsInProd) {
            return new Response(
              JSON.stringify({ success: false, error: cloudError.message }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          cloudUserId = cloudData.user?.id || null;
          console.log(`[create-user-both-envs] ✅ Usuário criado no Cloud: ${cloudUserId}`);
        }
      } catch (err: any) {
        console.error("[create-user-both-envs] ❌ Exceção ao criar no Cloud:", err.message);
        if (!existsInProd) {
          return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      console.log("[create-user-both-envs] Usuário já existe no Cloud, buscando ID...");
      cloudUserId = await findUserIdByEmail(CLOUD_URL, cloudServiceKey, normalizedEmail);
    }

    // =============================================
    // 2) CRIAR NA PRODUÇÃO (secundário, não-fatal)
    // =============================================
    let prodUserId: string | null = null;

    if (!existsInProd) {
      console.log("[create-user-both-envs] Criando usuário na Produção via REST API direta...");
      try {
        const prodResponse = await fetch(`${PRODUCTION_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${prodServiceKey}`,
            'apikey': prodServiceKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            email_confirm: true,
            user_metadata: metadata,
          }),
        });

        const prodResponseBody = await prodResponse.text();
        console.log(`[create-user-both-envs] Produção GoTrue response: ${prodResponse.status} ${prodResponseBody}`);

        if (!prodResponse.ok) {
          console.error("[create-user-both-envs] ⚠️ Erro COMPLETO Produção (não-fatal):", prodResponseBody);
        } else {
          const prodUserData = JSON.parse(prodResponseBody);
          prodUserId = prodUserData.id || null;
          console.log(`[create-user-both-envs] ✅ Usuário criado em Produção: ${prodUserId}`);
        }
      } catch (err: any) {
        console.error("[create-user-both-envs] ⚠️ Exceção ao criar em Produção (não-fatal):", err.message);
      }
    } else {
      console.log("[create-user-both-envs] Usuário já existe na Produção, buscando ID...");
      prodUserId = await findUserIdByEmail(PRODUCTION_URL, prodServiceKey, normalizedEmail);
    }

    // =============================================
    // SINCRONIZAR TABELA PATIENTS EM AMBOS
    // =============================================
    console.log("[create-user-both-envs] Sincronizando tabela patients...");

    const patientCoreData = {
      email: normalizedEmail,
      first_name: metadata?.first_name || null,
      last_name: metadata?.last_name || null,
      cpf: metadata?.cpf || null,
      phone_e164: metadata?.phone_e164 || null,
      birth_date: metadata?.birth_date || null,
      gender: metadata?.gender || null,
      cep: metadata?.cep || null,
      address_line: metadata?.address_line || null,
      address_number: metadata?.address_number || null,
      city: metadata?.city || null,
      state: metadata?.state || null,
      terms_accepted_at: metadata?.terms_accepted_at || new Date().toISOString(),
      marketing_opt_in: metadata?.marketing_opt_in || false,
      profile_complete: !!(metadata?.cpf && metadata?.phone_e164 && metadata?.birth_date),
    };

    // Sync Cloud patients
    if (cloudUserId) {
      try {
        const cloudPatientData = { ...patientCoreData, user_id: cloudUserId };
        const { data: existing } = await cloudClient.from('patients').select('id').eq('email', normalizedEmail).maybeSingle();
        if (existing) {
          await cloudClient.from('patients').update(cloudPatientData).eq('id', existing.id);
          console.log("[create-user-both-envs] ✅ Patient atualizado no Cloud");
        } else {
          await cloudClient.from('patients').insert(cloudPatientData);
          console.log("[create-user-both-envs] ✅ Patient criado no Cloud");
        }
      } catch (err: any) {
        console.error("[create-user-both-envs] Erro patient Cloud:", err.message);
      }
    }

    // Sync Prod patients (não-fatal)
    if (prodUserId) {
      try {
        const prodPatientData = { ...patientCoreData, user_id: prodUserId };
        const { data: existing } = await prodClient.from('patients').select('id').eq('email', normalizedEmail).maybeSingle();
        if (existing) {
          await prodClient.from('patients').update(prodPatientData).eq('id', existing.id);
          console.log("[create-user-both-envs] ✅ Patient atualizado em Produção");
        } else {
          await prodClient.from('patients').insert(prodPatientData);
          console.log("[create-user-both-envs] ✅ Patient criado em Produção");
        }
      } catch (err: any) {
        console.error("[create-user-both-envs] ⚠️ Erro patient Produção (não-fatal):", err.message);
      }
    }

    // =============================================
    // RESULTADO: sucesso se pelo menos Cloud OK
    // =============================================
    const success = !!(cloudUserId || existsInCloud);

    console.log("[create-user-both-envs] ========================================");
    console.log(`[create-user-both-envs] RESULTADO: Cloud=${!!cloudUserId}, Prod=${!!prodUserId}, success=${success}`);

    if (!success) {
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao criar usuário em ambos os ambientes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, prodUserId, cloudUserId, message: "Usuário criado com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[create-user-both-envs] Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
