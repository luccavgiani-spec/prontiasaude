import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export interface Patient {
  id: string;
  first_name?: string;
  last_name?: string;
  address_line?: string;
  cpf?: string;
  phone_e164?: string;
  birth_date?: string;
  gender?: string;
  cep?: string;
  address_number?: string;
  address_complement?: string;
  city?: string;
  state?: string;
  source?: string;
  terms_accepted_at?: string;
  marketing_opt_in?: boolean;
  profile_complete: boolean;
  intake_complete: boolean;
  has_allergies?: boolean;
  allergies?: string;
  pregnancy_status?: 'never' | 'pregnant_now' | 'pregnant_past';
  has_comorbidities?: boolean;
  comorbidities?: string;
  has_chronic_meds?: boolean;
  chronic_meds?: string;
  created_at: string;
  updated_at: string;
}

export const requireAuth = async (): Promise<{ user: User; session: Session } | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    window.location.href = '/entrar';
    return null;
  }
  
  return { user: session.user, session };
};

export const getPatient = async (userId: string): Promise<Patient | null> => {
  const { data, error } = await supabase
    .from('patients' as any)
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error) {
    console.error('Error fetching patient:', error);
    return null;
  }
  
  return data as unknown as Patient;
};

export const upsertPatient = async (userId: string, patientData: Partial<Patient>): Promise<Patient | null> => {
  const { data, error } = await supabase
    .from('patients' as any)
    .upsert({ 
      id: userId, 
      ...patientData,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
    
  if (error) {
    console.error('Error upserting patient:', error);
    throw error;
  }
  
  return data as unknown as Patient;
};

export const checkAuthFlow = async (userId: string): Promise<string> => {
  const patient = await getPatient(userId);
  
  if (!patient || !patient.profile_complete) {
    return '/completar-perfil';
  }
  
  return '/area-do-paciente';
};