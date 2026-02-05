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
    // No Lovable Cloud:
    //   - SUPABASE_SERVICE_ROLE_KEY = chave do Cloud (automático)
    //   - ORIGINAL_SUPABASE_SERVICE_ROLE_KEY = chave da Produção (manual)
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
    
    // Criar clientes
    const cloudClient = createClient(CLOUD_URL, cloudServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const prodClient = createClient(PRODUCTION_URL, prodServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // =============================================
    // VERIFICAR SE EMAIL JÁ EXISTE EM QUALQUER AMBIENTE
    // ✅ OTIMIZADO: Usar getUserByEmail ao invés de listUsers (muito mais rápido)
    // =============================================
    console.log("[create-user-both-envs] Verificando se email já existe...");
    
    // Buscar em ambos os ambientes usando getUserByEmail (instantâneo)
    let existsInCloud = false;
    let existsInProd = false;
    
    try {
      const { data: cloudUser, error: cloudErr } = await cloudClient.auth.admin.getUserByEmail(normalizedEmail);
      // Se não há erro e retornou user, então existe
      existsInCloud = !cloudErr && !!cloudUser?.user;
      if (cloudErr && !cloudErr.message?.includes('not found')) {
        console.warn("[create-user-both-envs] Erro ao verificar Cloud:", cloudErr.message);
      }
    } catch (err) {
      console.error("[create-user-both-envs] Exceção ao verificar Cloud:", err);
    }
    
    try {
      const { data: prodUser, error: prodErr } = await prodClient.auth.admin.getUserByEmail(normalizedEmail);
      existsInProd = !prodErr && !!prodUser?.user;
      if (prodErr && !prodErr.message?.includes('not found')) {
        console.warn("[create-user-both-envs] Erro ao verificar Produção:", prodErr.message);
      }
    } catch (err) {
      console.error("[create-user-both-envs] Exceção ao verificar Produção:", err);
    }
    
    if (existsInCloud || existsInProd) {
      console.log(`[create-user-both-envs] Email já existe: Cloud=${existsInCloud}, Prod=${existsInProd}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Este email já está cadastrado. Faça login ou recupere sua senha.",
          existsInCloud,
          existsInProd
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // =============================================
    // CRIAR USUÁRIO NA PRODUÇÃO (PRINCIPAL)
    // =============================================
    console.log("[create-user-both-envs] Criando usuário na Produção...");
    
    let prodUserId: string | null = null;
    
    try {
      const { data: prodData, error: prodError } = await prodClient.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true, // Auto-confirmar email
        user_metadata: metadata,
      });
      
      if (prodError) {
        console.error("[create-user-both-envs] ❌ Erro ao criar em Produção:", prodError.message);
        return new Response(
          JSON.stringify({ success: false, error: prodError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      prodUserId = prodData.user?.id || null;
      console.log(`[create-user-both-envs] ✅ Usuário criado em Produção: ${prodUserId}`);
    } catch (err: any) {
      console.error("[create-user-both-envs] ❌ Exceção ao criar em Produção:", err.message);
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // =============================================
    // CRIAR USUÁRIO NO CLOUD (SECUNDÁRIO)
    // =============================================
    console.log("[create-user-both-envs] Criando usuário no Cloud...");
    
    let cloudUserId: string | null = null;
    
    try {
      const { data: cloudData, error: cloudError } = await cloudClient.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true, // Auto-confirmar email
        user_metadata: metadata,
      });
      
      if (cloudError) {
        console.error("[create-user-both-envs] ⚠️ Erro ao criar no Cloud (não crítico):", cloudError.message);
        // Não falhar - o usuário principal já foi criado na Produção
      } else {
        cloudUserId = cloudData.user?.id || null;
        console.log(`[create-user-both-envs] ✅ Usuário criado no Cloud: ${cloudUserId}`);
      }
    } catch (err: any) {
      console.error("[create-user-both-envs] ⚠️ Exceção ao criar no Cloud (não crítico):", err.message);
    }
    
    // =============================================
    // SINCRONIZAR TABELA PATIENTS EM AMBOS
    // =============================================
    console.log("[create-user-both-envs] Sincronizando tabela patients...");
    
    // Dados base SEM colunas problemáticas (complement causa erro de schema cache)
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
    
    // Inserir na Produção - usar INSERT direto (não upsert) com verificação prévia
    try {
      // Verificar se já existe patient com este email
      const { data: existingProd } = await prodClient
        .from('patients')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
      if (existingProd) {
        // Atualizar registro existente
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
        // Inserir novo registro
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
    
    // Inserir no Cloud (com user_id do Cloud) - mesma lógica
    if (cloudUserId) {
      try {
        const cloudPatientData = { ...patientCoreData, user_id: cloudUserId };
        
        // Verificar se já existe patient com este email no Cloud
        const { data: existingCloud } = await cloudClient
          .from('patients')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle();
        
        if (existingCloud) {
          // Atualizar registro existente
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
          // Inserir novo registro
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
