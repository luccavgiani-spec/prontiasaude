import { supabase } from "@/integrations/supabase/client";

export interface PatientPlan {
  plan_code?: string;
  plan_expires_at?: string;
  status?: string;
}

export const getPatientPlan = async (email: string): Promise<PatientPlan | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('appointments-manager', {
      body: {
        operation: 'get_patient_plan',
        email: email
      }
    });

    if (error) {
      console.error('Error fetching patient plan:', error);
      return null;
    }

    if (data?.success && data?.plan) {
      return data.plan;
    }

    return null;
  } catch (error) {
    console.error('Exception fetching patient plan:', error);
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