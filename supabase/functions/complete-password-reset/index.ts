import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ✅ CORREÇÃO: CORS headers completos
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ✅ CORREÇÃO: URL fixa de PRODUÇÃO
const ORIGINAL_SUPABASE_URL = "https://ploqujuhpwutpcibedbr.supabase.co";

interface CompleteResetRequest {
  token: string;
  new_password: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
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

    // ✅ CORREÇÃO: Usar URL de produção + chave de serviço correta
    const supabaseServiceKey = Deno.env.get("ORIGINAL_SUPABASE_SERVICE_ROLE_KEY") 
      || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(ORIGINAL_SUPABASE_URL, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Buscar e validar token
    const { data: tokenData, error: tokenError } = await supabase
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

    // Buscar usuário pelo email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error("[complete-password-reset] Erro ao buscar usuários:", userError);
      throw new Error("Erro ao buscar usuário");
    }

    const user = users.users.find(u => u.email?.toLowerCase() === tokenData.email.toLowerCase());
    
    if (!user) {
      console.log(`[complete-password-reset] Usuário não encontrado: ${tokenData.email}`);
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar senha
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: new_password
    });

    if (updateError) {
      console.error("[complete-password-reset] Erro ao atualizar senha:", updateError);
      throw new Error("Erro ao atualizar senha");
    }

    // Invalidar token
    await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    console.log(`[complete-password-reset] Senha atualizada com sucesso para: ${tokenData.email}`);

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
