import { supabase } from "@/integrations/supabase/client";

export interface PatientPlan {
  id?: string;
  plan_code?: string;
  plan_expires_at?: string;
  status?: string;
  created_at?: string;
}

// Helper: retorna data de hoje no formato YYYY-MM-DD (para comparar com DATE do banco)
const getTodayDateString = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0]; // "2026-01-12"
};

export const getPatientPlan = async (email: string, byEmailOnly: boolean = false): Promise<PatientPlan | null> => {
  try {
    // Tentar buscar usuário logado primeiro
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    // Usar data de hoje (YYYY-MM-DD) para comparar com plan_expires_at (DATE)
    // Isso garante que planos que expiram "hoje" ainda são válidos durante todo o dia
    const todayStr = getTodayDateString();
    
    // PRIORIDADE 1: Buscar por user_id (se logado E não for busca apenas por email)
    if (userId && !byEmailOnly) {
      const { data: planByUserId, error: userIdError } = await supabase
        .from('patient_plans')
        .select('id, plan_code, plan_expires_at, status, created_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('plan_expires_at', todayStr)
        .order('plan_expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!userIdError && planByUserId) {
        console.log('[patient-plan] Active plan found by user_id:', planByUserId);
        return planByUserId;
      }
    }
    
    // PRIORIDADE 2: Buscar por email (fallback)
    const normalizedEmail = (email || '').trim().toLowerCase();
    const { data, error } = await supabase
      .from('patient_plans')
      .select('id, plan_code, plan_expires_at, status, created_at')
      .eq('email', normalizedEmail)
      .eq('status', 'active')
      .gte('plan_expires_at', todayStr)
      .order('plan_expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[patient-plan] Error fetching plan by email:', error);
      return null;
    }

    if (!data) {
      console.log('[patient-plan] No active plan found for:', email);
      return null;
    }

    console.log('[patient-plan] Active plan found by email:', data);
    return data;
  } catch (error) {
    console.error('[patient-plan] Exception:', error);
    return null;
  }
};

export const formatPlanName = (planCode?: string): string => {
  if (!planCode) return 'Nenhum plano ativo';
  
  // ✅ Detectar planos empresariais
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

export const checkPatientPlanActive = async (email: string): Promise<PatientPlanStatus> => {
  try {
    const plan = await getPatientPlan(email);
    
    if (!plan?.plan_code || !plan?.plan_expires_at) {
      return {
        hasActivePlan: false,
        canBypassPayment: false,
      };
    }

    // Verificar se o plano está ativo (não expirado)
    const expiresAt = new Date(plan.plan_expires_at);
    const now = new Date();
    const isActive = expiresAt > now && plan.status === 'active';

    return {
      hasActivePlan: isActive,
      planCode: plan.plan_code,
      planExpiresAt: plan.plan_expires_at,
      canBypassPayment: isActive,
    };
  } catch (error) {
    console.error('Error checking plan status:', error);
    return {
      hasActivePlan: false,
      canBypassPayment: false,
    };
  }
};