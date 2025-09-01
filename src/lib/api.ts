import { ENV } from './constants';

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
    const response = await fetch(`${ENV.APPS_SCRIPT_URL}?route=upsert_patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const result = await response.json();
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
    const response = await fetch(`${ENV.APPS_SCRIPT_URL}?route=checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const result = await response.json();
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
    const response = await fetch(`${ENV.APPS_SCRIPT_URL}?route=patient_summary&email=${encodeURIComponent(email)}`);

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Erro ao buscar resumo do paciente:', error);
    return null;
  }
}

// Redirecionar para checkout do Stripe
export function redirecionarParaCheckout(checkoutData: CheckoutResponse): void {
  if (checkoutData.id && (window as any).Stripe) {
    // Se temos sessionId, usar Stripe.js
    const stripe = (window as any).Stripe(ENV.STRIPE_PK);
    stripe.redirectToCheckout({ sessionId: checkoutData.id });
  } else if (checkoutData.url) {
    // Se temos URL direta, abrir em nova aba
    window.open(checkoutData.url, '_blank');
  } else {
    console.error('Dados de checkout inválidos:', checkoutData);
    throw new Error(checkoutData.error || 'Erro ao processar checkout');
  }
}