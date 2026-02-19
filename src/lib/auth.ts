import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { getHybridSession, supabaseProductionAuth } from "@/lib/auth-hybrid";

export interface Patient {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  address_line?: string;
  cpf?: string;
  phone_e164?: string;
  birth_date?: string;
  gender?: string;
  cep?: string;
  address_number?: string;
  complement?: string;
  city?: string;
  state?: string;
  source?: string;
  terms_accepted_at?: string;
  marketing_opt_in?: boolean;
  profile_complete: boolean;
  clubeben_status?: string;
  clubeben_last_sync?: string;
  clubeben_retry_count?: number;
  status_email?: number;
  status_sms?: number;
  created_at: string;
  updated_at: string;
}

export const requireAuth = async (): Promise<{ user: User; session: Session } | null> => {
  // ✅ HÍBRIDO: Verificar sessão em ambos os ambientes (Cloud e Produção)
  const { session, environment } = await getHybridSession();
  
  if (!session?.user) {
    window.location.href = '/entrar';
    return null;
  }
  
  // Salvar ambiente para uso posterior (para getPatient usar o cliente correto)
  if (environment) {
    sessionStorage.setItem('auth_environment', environment);
  }
  
  return { user: session.user, session };
};

export const getPatient = async (userId: string, userEmail?: string): Promise<Patient | null> => {
  // ✅ HÍBRIDO: Usar cliente correto baseado no ambiente de autenticação
  const environment = sessionStorage.getItem('auth_environment') as 'cloud' | 'production' | null;
  const client = environment === 'production' ? supabaseProductionAuth : supabase;
  
  const { data, error } = await client
    .from('patients' as any)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
    
  if (data) return data as unknown as Patient;
  
  // Fallback: tentar outro ambiente por user_id
  const otherClient = environment === 'production' ? supabase : supabaseProductionAuth;
  const { data: otherData } = await otherClient
    .from('patients' as any)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (otherData) return otherData as unknown as Patient;
  
  // ✅ FALLBACK POR EMAIL: user_id difere entre Cloud e Produção
  if (userEmail) {
    console.log('[getPatient] Tentando fallback por email:', userEmail);
    const { data: byEmail } = await supabaseProductionAuth
      .from('patients' as any)
      .select('*')
      .eq('email', userEmail.toLowerCase())
      .maybeSingle();
    if (byEmail) return byEmail as unknown as Patient;
  }
  
  if (error) console.error('[getPatient] Error fetching patient:', error);
  return null;
};

export const upsertPatient = async (userId: string, patientData: Partial<Patient>): Promise<Patient | null> => {
  // Primeiro, verificar se já existe registro com esse user_id
  const { data: existing } = await supabase
    .from('patients' as any)
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let result;
  const existingRecord = existing as unknown as { id: string } | null;
  
  if (existingRecord) {
    // UPDATE: registro existe, atualizar pelo id real
    const { data, error } = await supabase
      .from('patients' as any)
      .update({ 
        ...patientData,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingRecord.id)
      .select()
      .single();
      
    if (error) {
      console.error('[upsertPatient] Error updating patient:', error);
      throw error;
    }
    result = data;
  } else {
    // INSERT: registro não existe, criar novo
    const { data, error } = await supabase
      .from('patients' as any)
      .insert({ 
        user_id: userId,
        ...patientData,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (error) {
      console.error('[upsertPatient] Error inserting patient:', error);
      throw error;
    }
    result = data;
  }
  
  return result as unknown as Patient;
};

export const checkAuthFlow = async (userId: string): Promise<string> => {
  const patient = await getPatient(userId);
  
  if (!patient || !patient.profile_complete) {
    return '/completar-perfil';
  }
  
  return '/area-do-paciente';
};