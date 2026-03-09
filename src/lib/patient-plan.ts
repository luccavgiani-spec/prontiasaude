import { supabaseProduction } from "@/lib/supabase-production";

export interface PatientPlan {
  id?: string;
  plan_code?: string;
  plan_expires_at?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * FUNÇÃO PRINCIPAL - Busca plano ativo por email no banco de PRODUÇÃO
 * 
 * Estratégia: Buscar diretamente na tabela patient_plans por email
 * O campo email é NOT NULL e é a chave de referência para planos
 */
export const getPatientPlan = async (email: string): Promise<PatientPlan | null> => {
  try {
    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!normalizedEmail) {
      console.log('[patient-plan] Email vazio');
      return null;
    }
    
    // Data de agora para comparar expiração
    const now = new Date();
    
    // Buscar plano DIRETO por email no banco de PRODUÇÃO
    const { data: plan, error } = await supabaseProduction
      .from('patient_plans')
      .select('id, plan_code, plan_expires_at, status, created_at, updated_at')
      .eq('email', normalizedEmail)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      console.error('[patient-plan] Erro ao buscar plano:', error);
      return null;
    }

    if (!plan) {
      console.log('[patient-plan] Nenhum plano encontrado para:', normalizedEmail);
      return null;
    }

    // plan_expires_at pode vir como:
    // - DATE: "2026-02-28"
    // - TIMESTAMP: "2026-02-28 00:00:00+00"
    // Tratar ambos: considerar válido até o FIM do dia de expiração
    const expiresAt = new Date(plan.plan_expires_at);
    
    // Se não tem horário definido ou é meia-noite, ajustar para fim do dia
    if (expiresAt.getUTCHours() === 0 && expiresAt.getUTCMinutes() === 0) {
      expiresAt.setUTCHours(23, 59, 59, 999);
    }
    
    if (expiresAt < now) {
      console.log('[patient-plan] Plano expirado:', normalizedEmail, plan.plan_expires_at);
      return null;
    }

    console.log('[patient-plan] ✅ Plano ativo encontrado:', {
      email: normalizedEmail,
      plan_code: plan.plan_code,
      expires: plan.plan_expires_at
    });
    
    return plan;
  } catch (error) {
    console.error('[patient-plan] Exception:', error);
    return null;
  }
};

/**
 * Alias para compatibilidade - usa getPatientPlan
 */
export const getPatientPlanByEmail = getPatientPlan;

/**
 * Busca planos ativos em BATCH para múltiplos emails (elimina N+1 queries)
 * Divide em chunks de 500 para respeitar limite do Supabase
 * Retorna Map<email_lowercase, PatientPlan>
 */
export const getPatientPlansBatch = async (emails: string[]): Promise<Map<string, PatientPlan>> => {
  const planMap = new Map<string, PatientPlan>();
  
  if (!emails.length) return planMap;
  
  const normalizedEmails = emails
    .map(e => (e || '').toLowerCase().trim())
    .filter(Boolean);
  
  // Deduplicate
  const uniqueEmails = [...new Set(normalizedEmails)];
  
  // Chunk into groups of 500 (Supabase .in() limit is ~1000, use 500 for safety)
  const CHUNK_SIZE = 500;
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueEmails.length; i += CHUNK_SIZE) {
    chunks.push(uniqueEmails.slice(i, i + CHUNK_SIZE));
  }
  
  console.log(`[patient-plan] Batch: ${uniqueEmails.length} emails em ${chunks.length} chunks`);
  
  const now = new Date();
  
  // Execute all chunks in parallel
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabaseProduction
        .from('patient_plans')
        .select('id, email, plan_code, plan_expires_at, status, created_at, updated_at')
        .in('email', chunk)
        .eq('status', 'active');
      
      if (error) {
        console.error('[patient-plan] Batch chunk error:', error);
        return [];
      }
      return data || [];
    })
  );
  
  // Flatten and build map, checking expiry
  for (const plans of results) {
    for (const plan of plans) {
      if (!plan.email) continue;
      
      const expiresAt = new Date(plan.plan_expires_at);
      if (expiresAt.getUTCHours() === 0 && expiresAt.getUTCMinutes() === 0) {
        expiresAt.setUTCHours(23, 59, 59, 999);
      }
      
      if (expiresAt < now) continue; // expired
      
      planMap.set(plan.email.toLowerCase(), plan);
    }
  }
  
  console.log(`[patient-plan] Batch: ${planMap.size} planos ativos encontrados`);
  return planMap;
};

/**
 * @deprecated Mantido apenas para compatibilidade com código legado
 */
export const getPatientPlanFromProduction = async (patientId: string): Promise<PatientPlan | null> => {
  console.warn('[patient-plan] DEPRECATED: getPatientPlanFromProduction - use getPatientPlan(email)');
  return null;
};

/**
 * Verifica se o plan_code representa um plano familiar.
 * Cobre todos os formatos: FAM_COM_ESP_*, FAM_SEM_ESP_*, FAMILIAR_COM_ESPECIALISTA, FAMILY, FAM_BASIC, etc.
 */
export const isFamilyPlan = (planCode?: string): boolean => {
  if (!planCode) return false;
  const upper = planCode.toUpperCase();
  return upper.includes('FAM') || upper.includes('FAMILIAR');
};

export const formatPlanName = (planCode?: string): string => {
  if (!planCode) return 'Nenhum plano ativo';
  
  // Detectar planos empresariais
  if (planCode.startsWith('EMPRESA_')) {
    const companyName = planCode
      .replace('EMPRESA_', '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
    
    return `Plano Empresarial - ${companyName}`;
  }
  
  const planNames: Record<string, string> = {
    // Individuais com Especialistas
    'IND_COM_ESP_1M': 'Individual com Especialistas - Mensal',
    'IND_COM_ESP_3M': 'Individual com Especialistas - Trimestral',
    'IND_COM_ESP_6M': 'Individual com Especialistas - Semestral',
    'IND_COM_ESP_12M': 'Individual com Especialistas - Anual',
    
    // Individuais sem Especialistas
    'IND_SEM_ESP_1M': 'Individual sem Especialistas - Mensal',
    'IND_SEM_ESP_3M': 'Individual sem Especialistas - Trimestral',
    'IND_SEM_ESP_6M': 'Individual sem Especialistas - Semestral',
    'IND_SEM_ESP_12M': 'Individual sem Especialistas - Anual',
    
    // Familiares com Especialistas
    'FAM_COM_ESP_1M': 'Familiar com Especialistas - Mensal',
    'FAM_COM_ESP_3M': 'Familiar com Especialistas - Trimestral',
    'FAM_COM_ESP_6M': 'Familiar com Especialistas - Semestral',
    'FAM_COM_ESP_12M': 'Familiar com Especialistas - Anual',
    
    // Familiares sem Especialistas
    'FAM_SEM_ESP_1M': 'Familiar sem Especialistas - Mensal',
    'FAM_SEM_ESP_3M': 'Familiar sem Especialistas - Trimestral',
    'FAM_SEM_ESP_6M': 'Familiar sem Especialistas - Semestral',
    'FAM_SEM_ESP_12M': 'Familiar sem Especialistas - Anual',
    
    // Legados
    'BASIC': 'Plano Básico',
    'PREMIUM': 'Plano Premium',
    'FAMILY': 'Plano Família',
    'FAM_BASIC': 'Plano Família Básico',
    'CONSULTA_CLINICA': 'Consulta Clínica',
  };
  
  return planNames[planCode] || planCode;
};

export const formatPlanExpiry = (expiresAt?: string): string => {
  if (!expiresAt) return '';
  
  try {
    const date = new Date(expiresAt);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return expiresAt;
  }
};

export interface PatientPlanStatus {
  hasActivePlan: boolean;
  planCode?: string;
  planExpiresAt?: string;
  canBypassPayment: boolean;
}

/**
 * Verifica se o paciente tem plano ativo
 * Retorna informações do plano se existir
 */
export const checkPatientPlanActive = async (email: string): Promise<PatientPlanStatus> => {
  try {
    const plan = await getPatientPlan(email);
    
    if (!plan?.plan_code || !plan?.plan_expires_at) {
      return {
        hasActivePlan: false,
        canBypassPayment: false,
      };
    }

    return {
      hasActivePlan: true,
      planCode: plan.plan_code,
      planExpiresAt: plan.plan_expires_at,
      canBypassPayment: true,
    };
  } catch (error) {
    console.error('[patient-plan] Erro ao verificar status:', error);
    return {
      hasActivePlan: false,
      canBypassPayment: false,
    };
  }
};
