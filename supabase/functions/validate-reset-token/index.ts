import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// URLs - usar Cloud para ler tokens (onde são salvos)
const CLOUD_URL = Deno.env.get("SUPABASE_URL")!;

interface ValidateTokenRequest {
  token: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token }: ValidateTokenRequest = await req.json();
    
    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: "Token é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[validate-reset-token] Validando token: ${token.substring(0, 8)}...`);

    // Usar Cloud para ler tokens (onde foram salvos)
    const cloudServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(CLOUD_URL, cloudServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Buscar token
    const { data: tokenData, error: tokenError } = await supabase
      .from("password_reset_tokens")
      .select("*")
      .eq("token", token)
      .is("used_at", null)
      .single();

    if (tokenError || !tokenData) {
      console.log(`[validate-reset-token] Token não encontrado ou já usado`);
      return new Response(
        JSON.stringify({ valid: false, error: "Token inválido ou já utilizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar expiração
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      console.log(`[validate-reset-token] Token expirado`);
      return new Response(
        JSON.stringify({ valid: false, error: "Token expirado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[validate-reset-token] Token válido para: ${tokenData.email}, ambiente: ${tokenData.environment || 'production'}`);

    return new Response(
      JSON.stringify({ 
        valid: true, 
        email: tokenData.email,
        environment: tokenData.environment || 'production', // ✅ Retornar ambiente
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[validate-reset-token] Erro:", error);
    return new Response(
      JSON.stringify({ valid: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
