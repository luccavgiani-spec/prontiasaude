import { supabase } from "@/integrations/supabase/client";

export interface PatientPlan {
  plan_code?: string;
  plan_expires_at?: string;
  status?: string;
}

export const getPatientPlan = async (email: string): Promise<PatientPlan | null> => {
  try {
    const { data, error } = await supabase
      .from('patient_plans')
      .select('plan_code, plan_expires_at, status')
      .eq('email', email)
      .eq('status', 'active')
      .gte('plan_expires_at', new Date().toISOString())
      .order('plan_expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[patient-plan] Error fetching plan:', error);
      return null;
    }

    if (!data) {
      console.log('[patient-plan] No active plan found for:', email);
      return null;
    }

    console.log('[patient-plan] Active plan found:', data);
    return data;
  } catch (error) {
    console.error('[patient-plan] Exception:', error);
    return null;
  }
};

export const formatPlanName = (planCode?: string): string => {
  if (!planCode) return 'Nenhum plano ativo';
  
  const planNames: Record<string, string> = {
    'BASIC': 'Plano Básico',
    'PREMIUM': 'Plano Premium',
    'FAMILY': 'Plano Família',
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