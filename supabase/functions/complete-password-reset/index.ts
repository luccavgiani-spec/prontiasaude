import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// URLs dos dois ambientes
const CLOUD_URL = Deno.env.get("SUPABASE_URL")!;
const PRODUCTION_URL = "https://ploqujuhpwutpcibedbr.supabase.co";

interface CompleteResetRequest {
  token: string;
  new_password: string;
}

/**
 * Busca usuário por email com paginação em um ambiente
 */
async function findUserByEmail(client: ReturnType<typeof createClient>, email: string): Promise<string | null> {
  const normalizedEmail = email.toLowerCase();
  let page = 1;
  const perPage = 1000;
  
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage,
    });
    
    if (error || !data?.users?.length) {
      break;
    }
    
    const found = data.users.find(u => u.email?.toLowerCase() === normalizedEmail);
    if (found) {
      return found.id;
    }
    
    if (data.users.length < perPage) {
      break;
    }
    
    page++;
  }
  
  return null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, new_password }: CompleteResetRequest = await req.json();
    
    if (!token || !new_password) {
      return new Response(
        JSON.stringify({ success: false, error: "Token e nova senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar força da senha
    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: "A senha deve ter no mínimo 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[complete-password-reset] Processando reset para token: ${token.substring(0, 8)}...`);

    // Criar clientes
    const cloudServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const prodServiceKey = Deno.env.get("ORIGINAL_SUPABASE_SERVICE_ROLE_KEY") || cloudServiceKey;

    const cloudClient = createClient(CLOUD_URL, cloudServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Buscar e validar token (sempre no Cloud)
    const { data: tokenData, error: tokenError } = await cloudClient
      .from("password_reset_tokens")
      .select("*")
      .eq("token", token)
      .is("used_at", null)
      .single();

    if (tokenError || !tokenData) {
      console.log(`[complete-password-reset] Token não encontrado ou já usado`);
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido ou já utilizado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar expiração
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      console.log(`[complete-password-reset] Token expirado`);
      return new Response(
        JSON.stringify({ success: false, error: "Token expirado. Solicite uma nova recuperação de senha." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ Determinar qual ambiente usar
    const environment = tokenData.environment || 'production';
    console.log(`[complete-password-reset] Ambiente do token: ${environment}`);

    // Criar cliente do ambiente correto
    const targetClient = environment === 'cloud'
      ? cloudClient
      : createClient(PRODUCTION_URL, prodServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

    // Buscar usuário por email no ambiente correto
    const userId = await findUserByEmail(targetClient, tokenData.email);
    
    if (!userId) {
      console.log(`[complete-password-reset] Usuário não encontrado em ${environment}: ${tokenData.email}`);
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[complete-password-reset] Usuário encontrado em ${environment}: ${userId}`);

    // Atualizar senha no ambiente correto
    const { error: updateError } = await targetClient.auth.admin.updateUserById(userId, {
      password: new_password
    });

    if (updateError) {
      console.error("[complete-password-reset] Erro ao atualizar senha:", updateError);
      throw new Error("Erro ao atualizar senha");
    }

    // Invalidar token (sempre no Cloud)
    await cloudClient
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    console.log(`[complete-password-reset] Senha atualizada com sucesso em ${environment} para: ${tokenData.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Senha atualizada com sucesso!" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[complete-password-reset] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
