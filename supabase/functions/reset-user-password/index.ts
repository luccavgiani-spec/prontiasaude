import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOUD_URL = "https://yrsjluhhnhxogdgnbnya.supabase.co";
const PRODUCTION_URL = "https://ploqujuhpwutpcibedbr.supabase.co";

/**
 * Busca usuário por email com paginação
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
    const { email, new_password } = await req.json();
    
    if (!email || !new_password) {
      return new Response(
        JSON.stringify({ success: false, error: "Email e nova senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[reset-user-password] Resetando senha para: ${email}`);

    // Criar clientes
    // SUPABASE_SERVICE_ROLE_KEY é auto-injetado para o projeto atual (produção)
    const prodServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // ORIGINAL_SUPABASE_SERVICE_ROLE_KEY = chave legada do Cloud (opcional)
    const cloudServiceKey = Deno.env.get("ORIGINAL_SUPABASE_SERVICE_ROLE_KEY") || prodServiceKey;

    const cloudClient = createClient(CLOUD_URL, cloudServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const prodClient = createClient(PRODUCTION_URL, prodServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Buscar e atualizar em ambos os ambientes
    const results = {
      cloudUpdated: false,
      prodUpdated: false,
      cloudError: null as string | null,
      prodError: null as string | null,
    };

    // Cloud
    try {
      const cloudUserId = await findUserByEmail(cloudClient, email);
      if (cloudUserId) {
        console.log(`[reset-user-password] Encontrado no Cloud: ${cloudUserId}`);
        const { error } = await cloudClient.auth.admin.updateUserById(cloudUserId, { 
          password: new_password 
        });
        if (error) {
          results.cloudError = error.message;
          console.error(`[reset-user-password] Erro ao atualizar no Cloud:`, error);
        } else {
          results.cloudUpdated = true;
          console.log(`[reset-user-password] ✅ Senha atualizada no Cloud`);
        }
      } else {
        console.log(`[reset-user-password] Não encontrado no Cloud`);
      }
    } catch (e: any) {
      results.cloudError = e.message;
    }

    // Produção
    try {
      const prodUserId = await findUserByEmail(prodClient, email);
      if (prodUserId) {
        console.log(`[reset-user-password] Encontrado na Produção: ${prodUserId}`);
        const { error } = await prodClient.auth.admin.updateUserById(prodUserId, { 
          password: new_password 
        });
        if (error) {
          results.prodError = error.message;
          console.error(`[reset-user-password] Erro ao atualizar na Produção:`, error);
        } else {
          results.prodUpdated = true;
          console.log(`[reset-user-password] ✅ Senha atualizada na Produção`);
        }
      } else {
        console.log(`[reset-user-password] Não encontrado na Produção`);
      }
    } catch (e: any) {
      results.prodError = e.message;
    }

    console.log(`[reset-user-password] Resultado:`, results);

    const success = results.cloudUpdated || results.prodUpdated;
    
    return new Response(
      JSON.stringify({ 
        success, 
        message: success 
          ? `Senha atualizada${results.cloudUpdated ? ' no Cloud' : ''}${results.cloudUpdated && results.prodUpdated ? ' e' : ''}${results.prodUpdated ? ' na Produção' : ''}`
          : 'Usuário não encontrado em nenhum ambiente',
        ...results 
      }),
      { status: success ? 200 : 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[reset-user-password] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
