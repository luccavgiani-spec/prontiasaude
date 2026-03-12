import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// URLs fixas dos dois ambientes
const CLOUD_URL = "https://yrsjluhhnhxogdgnbnya.supabase.co";
const PRODUCTION_URL = "https://ploqujuhpwutpcibedbr.supabase.co";

interface UserRecord {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  phone?: string;
  source: 'cloud' | 'production' | 'both';
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
    console.log("[list-all-users] Iniciando busca unificada...");
    
    // =============================================
    // OBTER SERVICE KEYS
    // No Lovable Cloud:
    //   - SUPABASE_SERVICE_ROLE_KEY = chave do Cloud (automático)
    //   - ORIGINAL_SUPABASE_SERVICE_ROLE_KEY = chave da Produção (manual)
    // =============================================
    
    // Cloud: usar SUPABASE_SERVICE_ROLE_KEY padrão (é o Cloud no Lovable)
    const cloudServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    // Produção: usar ORIGINAL_SUPABASE_SERVICE_ROLE_KEY 
    const prodServiceKey = Deno.env.get("ORIGINAL_SUPABASE_SERVICE_ROLE_KEY");
    
    console.log("[list-all-users] Cloud URL:", CLOUD_URL);
    console.log("[list-all-users] Prod URL:", PRODUCTION_URL);
    console.log("[list-all-users] Cloud key exists:", !!cloudServiceKey);
    console.log("[list-all-users] Cloud key length:", cloudServiceKey?.length || 0);
    console.log("[list-all-users] Prod key exists:", !!prodServiceKey);
    console.log("[list-all-users] Prod key length:", prodServiceKey?.length || 0);
    
    // Validar que temos as credenciais da Produção
    if (!prodServiceKey) {
      console.error("[list-all-users] ❌ ORIGINAL_SUPABASE_SERVICE_ROLE_KEY não configurada!");
      console.error("[list-all-users] A função só consegue buscar usuários do Cloud.");
    }
    
    // Arrays para armazenar resultados
    let cloudAuthUsers: any[] = [];
    let cloudPatients: any[] = [];
    let prodAuthUsers: any[] = [];
    let prodPatients: any[] = [];
    
    // =============================================
    // BUSCAR DO CLOUD (se tiver credenciais)
    // =============================================
    if (cloudServiceKey) {
      try {
        const cloudClient = createClient(CLOUD_URL, cloudServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        
        console.log("[list-all-users] Buscando do Cloud...");
        
        const [cloudUsers, cloudPats] = await Promise.all([
          fetchAllAuthUsers(cloudClient, 'Cloud'),
          fetchAllPatients(cloudClient, 'Cloud'),
        ]);
        
        cloudAuthUsers = cloudUsers;
        cloudPatients = cloudPats;
        
        console.log(`[list-all-users] ✅ Cloud: ${cloudAuthUsers.length} auth.users, ${cloudPatients.length} patients`);
      } catch (cloudErr: any) {
        console.error("[list-all-users] ❌ Erro ao buscar Cloud:", cloudErr.message);
      }
    }
    
    // =============================================
    // BUSCAR DA PRODUÇÃO
    // =============================================
    if (prodServiceKey) {
      try {
        const prodClient = createClient(PRODUCTION_URL, prodServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        
        console.log("[list-all-users] Buscando da Produção...");
        
        const [prodUsers, prodPats] = await Promise.all([
          fetchAllAuthUsers(prodClient, 'Produção'),
          fetchAllPatients(prodClient, 'Produção'),
        ]);
        
        prodAuthUsers = prodUsers;
        prodPatients = prodPats;
        
        console.log(`[list-all-users] ✅ Produção: ${prodAuthUsers.length} auth.users, ${prodPatients.length} patients`);
      } catch (prodErr: any) {
        console.error("[list-all-users] ❌ Erro ao buscar Produção:", prodErr.message);
      }
    }
    
    console.log(`[list-all-users] Totais brutos: Cloud auth=${cloudAuthUsers.length}, Prod auth=${prodAuthUsers.length}`);
    
    // =============================================
    // MESCLAR RESULTADOS
    // =============================================
    
    // Criar mapas por email para mesclagem
    const emailToUserMap = new Map<string, UserRecord>();
    const emailToPatientCloud = new Map<string, any>();
    const emailToPatientProd = new Map<string, any>();
    
    // Indexar patients por email
    for (const p of cloudPatients) {
      if (p.email) {
        emailToPatientCloud.set(p.email.toLowerCase(), p);
      }
    }
    for (const p of prodPatients) {
      if (p.email) {
        emailToPatientProd.set(p.email.toLowerCase(), p);
      }
    }
    
    // Helper: build patient-like object from auth user_metadata (fallback when no patient record)
    const patientFromMetadata = (meta: any) => {
      if (!meta) return undefined;
      // Only return if there's at least a name
      if (!meta.first_name && !meta.last_name) return undefined;
      return {
        id: '', // no patient record
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
        _from_metadata: true, // flag indicating this came from auth metadata, not patients table
      };
    };

    // Processar auth.users do Cloud
    for (const user of cloudAuthUsers) {
      const email = user.email?.toLowerCase();
      if (!email) continue;

      const patient = emailToPatientCloud.get(email) || emailToPatientProd.get(email);

      emailToUserMap.set(email, {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
        phone: user.phone,
        source: 'cloud',
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
        } : patientFromMetadata(user.user_metadata),
      });
    }
    
    // Processar auth.users da Produção (marcar como 'both' se já existe)
    for (const user of prodAuthUsers) {
      const email = user.email?.toLowerCase();
      if (!email) continue;
      
      const patient = emailToPatientProd.get(email) || emailToPatientCloud.get(email);
      
      if (emailToUserMap.has(email)) {
        // Existe em ambos - manter dados da Produção, marcar como 'both'
        const existing = emailToUserMap.get(email)!;
        emailToUserMap.set(email, {
          ...existing,
          id: user.id, // Usar ID da Produção
          source: 'both',
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
          } : existing.patient || patientFromMetadata(user.user_metadata),
        });
      } else {
        // Apenas na Produção
        emailToUserMap.set(email, {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          email_confirmed_at: user.email_confirmed_at,
          phone: user.phone,
          source: 'production',
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
          } : patientFromMetadata(user.user_metadata),
        });
      }
    }
    
    // Converter map para array e ordenar por created_at
    const allUsers = Array.from(emailToUserMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Calcular estatísticas
    const stats = {
      totalUnique: allUsers.length,
      cloudOnly: allUsers.filter(u => u.source === 'cloud').length,
      productionOnly: allUsers.filter(u => u.source === 'production').length,
      both: allUsers.filter(u => u.source === 'both').length,
      cloudAuthTotal: cloudAuthUsers.length,
      prodAuthTotal: prodAuthUsers.length,
      cloudKeyConfigured: !!cloudServiceKey,
      prodKeyConfigured: !!prodServiceKey,
    };
    
    console.log(`[list-all-users] ========================================`);
    console.log(`[list-all-users] RESULTADO FINAL:`);
    console.log(`[list-all-users] - Total únicos: ${stats.totalUnique}`);
    console.log(`[list-all-users] - Somente Cloud: ${stats.cloudOnly}`);
    console.log(`[list-all-users] - Somente Produção: ${stats.productionOnly}`);
    console.log(`[list-all-users] - Em ambos: ${stats.both}`);
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
