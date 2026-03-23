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
 * ✅ CORRIGIDO: Busca usuário por email via REST API direta do GoTrue
 * Retorna o ID do usuário se encontrado, null caso contrário
 */
async function findUserByEmail(supabaseUrl: string, serviceKey: string, email: string): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();
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
      console.error(`[complete-password-reset] REST API error ${response.status} para ${supabaseUrl}`);
      return null;
    }
    
    const data = await response.json();
    const users = data.users || data || [];
    
    if (!Array.isArray(users) || users.length === 0) return null;
    
    const found = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
    if (found) return found.id;
    
    if (users.length < perPage) return null;
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
    const prodServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cloudServiceKey = Deno.env.get("ORIGINAL_SUPABASE_SERVICE_ROLE_KEY") || prodServiceKey;

    const cloudClient = createClient(CLOUD_URL, cloudServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const prodClient = createClient(PRODUCTION_URL, prodServiceKey, {
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

    console.log(`[complete-password-reset] Buscando usuário em AMBOS os ambientes: ${tokenData.email}`);

    // ✅ CORREÇÃO: Buscar via REST API direta com paginação segura
    const [cloudUserId, prodUserId] = await Promise.all([
      findUserByEmail(CLOUD_URL, cloudServiceKey, tokenData.email),
      findUserByEmail(PRODUCTION_URL, prodServiceKey, tokenData.email)
    ]);

    console.log(`[complete-password-reset] Cloud: ${cloudUserId || 'não encontrado'}, Prod: ${prodUserId || 'não encontrado'}`);

    if (!cloudUserId && !prodUserId) {
      console.log(`[complete-password-reset] Usuário não encontrado em nenhum ambiente: ${tokenData.email}`);
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ CORREÇÃO: Atualizar senha em TODOS os ambientes onde o usuário existe
    const updateResults: string[] = [];
    const errors: string[] = [];

    if (cloudUserId) {
      try {
        const { error: cloudError } = await cloudClient.auth.admin.updateUserById(cloudUserId, {
          password: new_password
        });
        if (cloudError) {
          console.error("[complete-password-reset] Erro ao atualizar no Cloud:", cloudError);
          errors.push(`Cloud: ${cloudError.message}`);
        } else {
          updateResults.push('cloud');
          console.log(`[complete-password-reset] ✅ Senha atualizada no Cloud`);
        }
      } catch (e: any) {
        console.error("[complete-password-reset] Exceção ao atualizar no Cloud:", e);
        errors.push(`Cloud: ${e.message}`);
      }
    }

    if (prodUserId) {
      try {
        const { error: prodError } = await prodClient.auth.admin.updateUserById(prodUserId, {
          password: new_password
        });
        if (prodError) {
          console.error("[complete-password-reset] Erro ao atualizar em Produção:", prodError);
          errors.push(`Produção: ${prodError.message}`);
        } else {
          updateResults.push('production');
          console.log(`[complete-password-reset] ✅ Senha atualizada em Produção`);
        }
      } catch (e: any) {
        console.error("[complete-password-reset] Exceção ao atualizar em Produção:", e);
        errors.push(`Produção: ${e.message}`);
      }
    }

    // Se nenhuma atualização foi bem-sucedida, retornar erro
    if (updateResults.length === 0) {
      console.error("[complete-password-reset] Falha ao atualizar senha em todos os ambientes");
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao atualizar senha: " + errors.join("; ") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalidar token (sempre no Cloud)
    await cloudClient
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    console.log(`[complete-password-reset] ✅ Senha atualizada com sucesso em: ${updateResults.join(', ')} para: ${tokenData.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Senha atualizada com sucesso!",
        environments: updateResults
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
