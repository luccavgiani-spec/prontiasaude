import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fallback URL — used only if SUPABASE_URL env var is not set (should never happen in production)
const PRODUCTION_URL = "https://ploqujuhpwutpcibedbr.supabase.co";

interface UserRecord {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  phone?: string;
  source: 'production';
  patient?: {
    id: string;
    first_name?: string;
    last_name?: string;
    cpf?: string;
    phone_e164?: string;
    birth_date?: string;
    gender?: string;
    cep?: string;
    address_line?: string;
    address_number?: string;
    city?: string;
    state?: string;
    profile_complete: boolean;
  };
}

/**
 * Busca todos os auth.users com paginação
 */
async function fetchAllAuthUsers(client: ReturnType<typeof createClient>, label: string): Promise<any[]> {
  const allUsers: any[] = [];
  let page = 1;
  const perPage = 1000;

  console.log(`[list-all-users] Buscando auth.users de ${label}...`);

  while (true) {
    try {
      const { data, error } = await client.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        console.error(`[list-all-users] Erro ao buscar ${label} página ${page}:`, error.message);
        break;
      }

      if (!data?.users?.length) {
        break;
      }

      allUsers.push(...data.users);
      console.log(`[list-all-users] ${label} página ${page}: ${data.users.length} usuários (total: ${allUsers.length})`);

      if (data.users.length < perPage) {
        break;
      }

      page++;
    } catch (err: any) {
      console.error(`[list-all-users] Exceção ao buscar ${label}:`, err.message);
      break;
    }
  }

  return allUsers;
}

/**
 * Busca todos os patients de um ambiente
 */
async function fetchAllPatients(client: ReturnType<typeof createClient>, label: string): Promise<any[]> {
  const allPatients: any[] = [];
  let offset = 0;
  const limit = 1000;

  console.log(`[list-all-users] Buscando patients de ${label}...`);

  while (true) {
    try {
      const { data, error } = await client
        .from('patients')
        .select('*')
        .range(offset, offset + limit - 1);

      if (error) {
        console.error(`[list-all-users] Erro ao buscar patients ${label}:`, error.message);
        break;
      }

      if (!data?.length) {
        break;
      }

      allPatients.push(...data);

      if (data.length < limit) {
        break;
      }

      offset += limit;
    } catch (err: any) {
      console.error(`[list-all-users] Exceção ao buscar patients ${label}:`, err.message);
      break;
    }
  }

  console.log(`[list-all-users] ${label}: ${allPatients.length} patients`);
  return allPatients;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[list-all-users] ========================================");
    console.log("[list-all-users] Iniciando busca unificada (produção)...");

    // =============================================
    // CREDENCIAIS — sempre auto-fornecidas pelo Supabase
    // SUPABASE_URL     = URL do projeto atual (produção)
    // SUPABASE_SERVICE_ROLE_KEY = service key do projeto atual (produção)
    // Não depende de segredos manuais como ORIGINAL_SUPABASE_SERVICE_ROLE_KEY
    // =============================================
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const projectUrl = Deno.env.get("SUPABASE_URL") || PRODUCTION_URL;

    console.log("[list-all-users] Project URL:", projectUrl);
    console.log("[list-all-users] Service key exists:", !!serviceKey);

    if (!serviceKey) {
      console.error("[list-all-users] ❌ SUPABASE_SERVICE_ROLE_KEY não disponível!");
      return new Response(
        JSON.stringify({ success: false, error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = createClient(projectUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Buscar auth.users e patients em paralelo
    const [authUsers, patients] = await Promise.all([
      fetchAllAuthUsers(client, 'Produção'),
      fetchAllPatients(client, 'Produção'),
    ]);

    console.log(`[list-all-users] ✅ Produção: ${authUsers.length} auth.users, ${patients.length} patients`);

    // =============================================
    // MESCLAR auth.users com patients por email
    // =============================================

    // Indexar patients por email
    const emailToPatient = new Map<string, any>();
    for (const p of patients) {
      if (p.email) {
        emailToPatient.set(p.email.toLowerCase(), p);
      }
    }

    // Helper: build patient-like object from auth user_metadata (fallback)
    const patientFromMetadata = (meta: any) => {
      if (!meta) return undefined;
      if (!meta.first_name && !meta.last_name) return undefined;
      return {
        id: '',
        first_name: meta.first_name || null,
        last_name: meta.last_name || null,
        cpf: meta.cpf || null,
        phone_e164: meta.phone_e164 || null,
        birth_date: meta.birth_date || null,
        gender: meta.gender || null,
        cep: meta.cep || null,
        address_line: meta.address_line || null,
        address_number: meta.address_number || null,
        city: meta.city || null,
        state: meta.state || null,
        profile_complete: false,
        _from_metadata: true,
      };
    };

    const allUsers: UserRecord[] = authUsers
      .filter((u: any) => !!u.email)
      .map((u: any) => {
        const email = u.email.toLowerCase();
        const patient = emailToPatient.get(email);

        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
          phone: u.phone,
          source: 'production' as const,
          patient: patient ? {
            id: patient.id,
            first_name: patient.first_name,
            last_name: patient.last_name,
            cpf: patient.cpf,
            phone_e164: patient.phone_e164,
            birth_date: patient.birth_date,
            gender: patient.gender,
            cep: patient.cep,
            address_line: patient.address_line,
            address_number: patient.address_number,
            city: patient.city,
            state: patient.state,
            profile_complete: patient.profile_complete || false,
          } : patientFromMetadata(u.user_metadata),
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const stats = {
      totalUnique: allUsers.length,
      productionOnly: allUsers.length,
      cloudOnly: 0,
      both: 0,
      prodAuthTotal: authUsers.length,
      prodKeyConfigured: true,
    };

    console.log(`[list-all-users] ========================================`);
    console.log(`[list-all-users] RESULTADO FINAL:`);
    console.log(`[list-all-users] - Total: ${stats.totalUnique} usuários`);
    console.log(`[list-all-users] ========================================`);

    return new Response(
      JSON.stringify({
        success: true,
        users: allUsers,
        stats,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[list-all-users] Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
