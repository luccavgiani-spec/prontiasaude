import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// URLs fixas dos dois ambientes
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
    const { email } = await req.json();
    
    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-user-by-email] Deletando usuário: ${email}`);

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

    // Buscar e deletar em ambos os ambientes
    const results = {
      cloudDeleted: false,
      prodDeleted: false,
      cloudError: null as string | null,
      prodError: null as string | null,
    };

    // Cloud
    try {
      const cloudUserId = await findUserByEmail(cloudClient, email);
      if (cloudUserId) {
        console.log(`[delete-user-by-email] Encontrado no Cloud: ${cloudUserId}`);
        const { error } = await cloudClient.auth.admin.deleteUser(cloudUserId);
        if (error) {
          results.cloudError = error.message;
          console.error(`[delete-user-by-email] Erro ao deletar do Cloud:`, error);
        } else {
          results.cloudDeleted = true;
          console.log(`[delete-user-by-email] ✅ Deletado do Cloud`);
        }
      } else {
        console.log(`[delete-user-by-email] Não encontrado no Cloud`);
      }
    } catch (e: any) {
      results.cloudError = e.message;
    }

    // Produção
    try {
      const prodUserId = await findUserByEmail(prodClient, email);
      if (prodUserId) {
        console.log(`[delete-user-by-email] Encontrado na Produção: ${prodUserId}`);
        const { error } = await prodClient.auth.admin.deleteUser(prodUserId);
        if (error) {
          results.prodError = error.message;
          console.error(`[delete-user-by-email] Erro ao deletar da Produção:`, error);
        } else {
          results.prodDeleted = true;
          console.log(`[delete-user-by-email] ✅ Deletado da Produção`);
        }
      } else {
        console.log(`[delete-user-by-email] Não encontrado na Produção`);
      }
    } catch (e: any) {
      results.prodError = e.message;
    }

    // Deletar da tabela patients também
    try {
      await cloudClient.from('patients').delete().eq('email', email);
      await cloudClient.from('patient_plans').delete().eq('email', email);
      console.log(`[delete-user-by-email] ✅ Removido de patients/plans (Cloud)`);
    } catch (e: any) {
      console.log(`[delete-user-by-email] Erro ao limpar patients Cloud:`, e.message);
    }

    try {
      await prodClient.from('patients').delete().eq('email', email);
      await prodClient.from('patient_plans').delete().eq('email', email);
      console.log(`[delete-user-by-email] ✅ Removido de patients/plans (Produção)`);
    } catch (e: any) {
      console.log(`[delete-user-by-email] Erro ao limpar patients Produção:`, e.message);
    }

    console.log(`[delete-user-by-email] Resultado:`, results);

    return new Response(
      JSON.stringify({ 
        success: results.cloudDeleted || results.prodDeleted, 
        ...results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[delete-user-by-email] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
