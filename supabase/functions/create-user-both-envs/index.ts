import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// URLs fixas dos dois ambientes
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

/**
 * ✅ CORRIGIDO: Verifica existência de email via REST API direta do GoTrue
 * Resolve o bug de getUserByEmail não existir no SDK 2.49.1
 */
async function checkEmailExists(supabaseUrl: string, serviceKey: string, email: string, envName: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    let page = 1;
    const perPage = 50;
    const maxPages = 50;
    
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
        console.error(`[create-user-both-envs] ${envName}: REST API error ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      const users = data.users || data || [];
      
      if (!Array.isArray(users) || users.length === 0) {
        return false;
      }
      
      const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
      if (found) {
        console.log(`[create-user-both-envs] ${envName}: Email já existe! ID: ${found.id}`);
        return true;
      }
      
      if (users.length < perPage) {
        return false;
      }
      
      page++;
    }
    
    return false;
  } catch (err) {
    console.error(`[create-user-both-envs] ${envName}: Exceção ao verificar email:`, err);
    return false;
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[create-user-both-envs] ========================================");
    console.log("[create-user-both-envs] Iniciando criação de usuário em ambos ambientes...");
    
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
    
    // =============================================
    // OBTER SERVICE KEYS
    // =============================================
    const cloudServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const prodServiceKey = Deno.env.get("ORIGINAL_SUPABASE_SERVICE_ROLE_KEY");
    
    console.log("[create-user-both-envs] Cloud key exists:", !!cloudServiceKey);
    console.log("[create-user-both-envs] Prod key exists:", !!prodServiceKey);
    
    if (!cloudServiceKey) {
      console.error("[create-user-both-envs] ❌ SUPABASE_SERVICE_ROLE_KEY não disponível!");
      return new Response(
        JSON.stringify({ success: false, error: "Configuração de Cloud incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!prodServiceKey) {
      console.error("[create-user-both-envs] ❌ ORIGINAL_SUPABASE_SERVICE_ROLE_KEY não configurada!");
      return new Response(
        JSON.stringify({ success: false, error: "Configuração de Produção incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Criar clientes (usados para createUser e operações de banco)
    const cloudClient = createClient(CLOUD_URL, cloudServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const prodClient = createClient(PRODUCTION_URL, prodServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // =============================================
    // ✅ CORRIGIDO: Verificar existência via REST API direta
    // =============================================
    console.log("[create-user-both-envs] Verificando se email já existe...");
    
    const [existsInCloud, existsInProd] = await Promise.all([
      checkEmailExists(CLOUD_URL, cloudServiceKey, normalizedEmail, "Cloud"),
      checkEmailExists(PRODUCTION_URL, prodServiceKey, normalizedEmail, "Produção"),
    ]);
    
    // ✅ CORRIGIDO: Só bloquear se existe em AMBOS os ambientes
    if (existsInCloud && existsInProd) {
      console.log(`[create-user-both-envs] Email já existe em AMBOS os ambientes`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Este email já está cadastrado. Faça login ou recupere sua senha.",
          existsInCloud: true,
          existsInProd: true
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Se existe em apenas um, criar no outro
    if (existsInCloud || existsInProd) {
      console.log(`[create-user-both-envs] Existe parcialmente: Cloud=${existsInCloud}, Prod=${existsInProd}. Criando no ambiente faltante...`);
    }
    
    // =============================================
    // CRIAR USUÁRIO NA PRODUÇÃO (PRINCIPAL)
    // =============================================
    let prodUserId: string | null = null;
    
    if (!existsInProd) {
      console.log("[create-user-both-envs] Criando usuário na Produção...");
      try {
        const { data: prodData, error: prodError } = await prodClient.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: metadata,
        });
        
        if (prodError) {
          console.error("[create-user-both-envs] ❌ Erro ao criar em Produção:", prodError.message);
          // Só retornar erro fatal se Cloud também não existe (nenhum ambiente teria o user)
          if (!existsInCloud) {
            return new Response(
              JSON.stringify({ success: false, error: prodError.message }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          prodUserId = prodData.user?.id || null;
          console.log(`[create-user-both-envs] ✅ Usuário criado em Produção: ${prodUserId}`);
        }
      } catch (err: any) {
        console.error("[create-user-both-envs] ❌ Exceção ao criar em Produção:", err.message);
        if (!existsInCloud) {
          return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else {
      console.log("[create-user-both-envs] Usuário já existe na Produção, pulando criação");
      // Buscar o ID existente via REST API
      try {
        const url = `${PRODUCTION_URL}/auth/v1/admin/users?page=1&per_page=50`;
        let page = 1;
        while (page <= 50) {
          const resp = await fetch(`${PRODUCTION_URL}/auth/v1/admin/users?page=${page}&per_page=50`, {
            headers: { 'Authorization': `Bearer ${prodServiceKey}`, 'apikey': prodServiceKey, 'Content-Type': 'application/json' }
          });
          if (!resp.ok) break;
          const d = await resp.json();
          const users = d.users || d || [];
          const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
          if (found) { prodUserId = found.id; break; }
          if (users.length < 50) break;
          page++;
        }
        console.log(`[create-user-both-envs] ID existente na Produção: ${prodUserId}`);
      } catch (e: any) {
        console.error("[create-user-both-envs] Erro ao buscar ID existente na Produção:", e.message);
      }
    }
    
    // =============================================
    // CRIAR USUÁRIO NO CLOUD (SECUNDÁRIO)
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
          console.error("[create-user-both-envs] ⚠️ Erro ao criar no Cloud (não crítico):", cloudError.message);
        } else {
          cloudUserId = cloudData.user?.id || null;
          console.log(`[create-user-both-envs] ✅ Usuário criado no Cloud: ${cloudUserId}`);
        }
      } catch (err: any) {
        console.error("[create-user-both-envs] ⚠️ Exceção ao criar no Cloud (não crítico):", err.message);
      }
    } else {
      console.log("[create-user-both-envs] Usuário já existe no Cloud, pulando criação");
      // Buscar o ID existente
      try {
        let page = 1;
        while (page <= 50) {
          const resp = await fetch(`${CLOUD_URL}/auth/v1/admin/users?page=${page}&per_page=50`, {
            headers: { 'Authorization': `Bearer ${cloudServiceKey}`, 'apikey': cloudServiceKey, 'Content-Type': 'application/json' }
          });
          if (!resp.ok) break;
          const d = await resp.json();
          const users = d.users || d || [];
          const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
          if (found) { cloudUserId = found.id; break; }
          if (users.length < 50) break;
          page++;
        }
        console.log(`[create-user-both-envs] ID existente no Cloud: ${cloudUserId}`);
      } catch (e: any) {
        console.error("[create-user-both-envs] Erro ao buscar ID existente no Cloud:", e.message);
      }
    }
    
    // =============================================
    // SINCRONIZAR TABELA PATIENTS EM AMBOS
    // =============================================
    console.log("[create-user-both-envs] Sincronizando tabela patients...");
    
    const patientCoreData = {
      user_id: prodUserId,
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
    
    // Inserir na Produção
    try {
      const { data: existingProd } = await prodClient
        .from('patients')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
      if (existingProd) {
        const { error: updateError } = await prodClient
          .from('patients')
          .update({ ...patientCoreData, user_id: prodUserId })
          .eq('id', existingProd.id);
        
        if (updateError) {
          console.error("[create-user-both-envs] Erro ao atualizar patient em Produção:", updateError.message);
        } else {
          console.log("[create-user-both-envs] ✅ Patient atualizado em Produção (id:", existingProd.id, ")");
        }
      } else {
        const { error: insertError } = await prodClient
          .from('patients')
          .insert(patientCoreData);
        
        if (insertError) {
          console.error("[create-user-both-envs] Erro ao inserir patient em Produção:", insertError.message);
        } else {
          console.log("[create-user-both-envs] ✅ Patient criado em Produção");
        }
      }
    } catch (err: any) {
      console.error("[create-user-both-envs] Exceção ao criar patient em Produção:", err.message);
    }
    
    // Inserir no Cloud
    if (cloudUserId) {
      try {
        const cloudPatientData = { ...patientCoreData, user_id: cloudUserId };
        
        const { data: existingCloud } = await cloudClient
          .from('patients')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle();
        
        if (existingCloud) {
          const { error: updateError } = await cloudClient
            .from('patients')
            .update(cloudPatientData)
            .eq('id', existingCloud.id);
          
          if (updateError) {
            console.error("[create-user-both-envs] Erro ao atualizar patient no Cloud:", updateError.message);
          } else {
            console.log("[create-user-both-envs] ✅ Patient atualizado no Cloud (id:", existingCloud.id, ")");
          }
        } else {
          const { error: insertError } = await cloudClient
            .from('patients')
            .insert(cloudPatientData);
          
          if (insertError) {
            console.error("[create-user-both-envs] Erro ao inserir patient no Cloud:", insertError.message);
          } else {
            console.log("[create-user-both-envs] ✅ Patient criado no Cloud");
          }
        }
      } catch (err: any) {
        console.error("[create-user-both-envs] Exceção ao criar patient no Cloud:", err.message);
      }
    }
    
    console.log("[create-user-both-envs] ========================================");
    console.log(`[create-user-both-envs] RESULTADO: Produção=${!!prodUserId}, Cloud=${!!cloudUserId}`);
    console.log("[create-user-both-envs] ========================================");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        prodUserId,
        cloudUserId,
        message: "Usuário criado com sucesso em ambos os ambientes"
      }),
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
