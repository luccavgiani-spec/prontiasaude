import { supabase } from '@/integrations/supabase/client';

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
    console.log('Upserting patient via Supabase Edge Function:', data);
    
    const { data: result, error } = await supabase.functions.invoke('patient-operations', {
      body: {
        operation: 'upsert_patient',
        ...data
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message);
    }

    console.log('Patient upserted successfully:', result);
    return { success: true };
  } catch (error) {
    console.error('Erro ao cadastrar paciente:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// Criar sessão de checkout
export async function criarCheckout(data: CheckoutRequest): Promise<CheckoutResponse> {
  try {
    console.log('Creating checkout via Supabase Edge Function:', data);
    
    const { data: result, error } = await supabase.functions.invoke('stripe-checkout', {
      body: data
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message);
    }

    console.log('Checkout created successfully:', result);
    return result;
  } catch (error) {
    console.error('Erro ao criar checkout:', error);
    return { 
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// Buscar resumo do paciente
export async function buscarResumosPaciente(email: string): Promise<PatientSummaryResponse | null> {
  try {
    console.log('Fetching patient summary via Supabase Edge Function:', email);
    
    const { data: result, error } = await supabase.functions.invoke('appointment-manager', {
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

// Redirecionar para checkout do Stripe
export function redirecionarParaCheckout(checkoutData: CheckoutResponse): void {
  if (checkoutData.url) {
    // Always open in new tab for better UX
    window.open(checkoutData.url, '_blank');
  } else {
    console.error('Dados de checkout inválidos:', checkoutData);
    throw new Error(checkoutData.error || 'Erro ao processar checkout');
  }
}