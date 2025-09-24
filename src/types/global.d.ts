// Tipagens globais para o projeto Médicos do Bem

interface Window {
  Stripe?: (key: string) => {
    redirectToCheckout: (options: { sessionId: string }) => Promise<void>;
  };
}

// Google Sheets integration removed
export interface UpsertPatientResponse {
  success: boolean;
  error?: string;
}

export interface CheckoutSession {
  id?: string;
  url?: string;
  error?: string;
}

export interface PatientSummary {
  appointments: Appointment[];
  orders: Order[];
  subscription?: Subscription;
}

export interface Appointment {
  id: string;
  service_name: string;
  scheduled_date: string;
  status: string;
  join_url?: string;
}

export interface Order {
  id: string;
  sku: string;
  created_at: string;
  status: string;
  amount: number;
}

export interface Subscription {
  plan_code: string;
  status: string;
  current_period_end: string;
}