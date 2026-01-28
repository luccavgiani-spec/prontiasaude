import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from './edge-functions';

// Tipos para as respostas da API
export interface UpsertPatientRequest {
  name: string;
  email: string;
  phone_e164: string;
}

export interface CheckoutRequest {
  mode: "payment" | "subscription";
  price_id: string;
  product_sku?: string;
  plan_code?: string;
  plan_duration_months?: number;
  email: string;
}

export interface CheckoutResponse {
  id?: string;
  url?: string;
  error?: string;
}

export interface PatientSummaryResponse {
  appointments: Array<{
    id: string;
    service_name: string;
    scheduled_date: string;
    status: string;
    join_url?: string;
  }>;
  orders: Array<{
    id: string;
    sku: string;
    created_at: string;
    status: string;
    amount: number;
  }>;
  subscription?: {
    plan_code: string;
    status: string;
    current_period_end: string;
  };
}

// Cadastro/atualização de paciente
export async function upsertPatient(data: UpsertPatientRequest): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('Registering patient via Edge Function:', data);
    
    // Call the patient-operations edge function that handles both Supabase and GAS
    const { data: result, error } = await invokeEdgeFunction('patient-operations', {
      body: {
        operation: 'upsert_patient',
        name: data.name,
        email: data.email,
        phone_e164: data.phone_e164
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message);
    }

    console.log('Patient registration completed:', result);
    return { success: true };
  } catch (error) {
    console.error('Erro ao cadastrar paciente:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// Buscar resumo do paciente
export async function buscarResumosPaciente(email: string): Promise<PatientSummaryResponse | null> {
  try {
    console.log('Fetching patient summary via Supabase Edge Function:', email);
    
    const { data: result, error } = await invokeEdgeFunction('appointments-manager', {
      body: {
        operation: 'get_appointments'
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message);
    }

    // Transform the result to match expected format
    const summary: PatientSummaryResponse = {
      appointments: result.appointments || [],
      orders: [], // TODO: implement orders fetching
      subscription: undefined // TODO: implement subscription info
    };

    console.log('Patient summary fetched successfully:', summary);
    return summary;
  } catch (error) {
    console.error('Erro ao buscar resumo do paciente:', error);
    return null;
  }
}
