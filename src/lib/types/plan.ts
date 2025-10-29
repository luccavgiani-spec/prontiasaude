export interface RecurringPlan {
  id: string;
  sku: string;
  nome: string;
  amount: number; // centavos
  recurring: true;
  frequency: number;
  frequencyType: 'months' | 'days';
}

export interface SubscriptionPayload {
  payer_email: string;
  card_token: string;
  reason: string;
  auto_recurring: {
    frequency: number;
    frequency_type: 'months' | 'days';
    transaction_amount: number;
    currency_id: 'BRL';
  };
  schedulePayload: {
    cpf: string;
    email: string;
    nome: string;
    telefone: string;
    especialidade?: string;
    sku: string;
    horario_iso?: string;
    plano_ativo: boolean;
  };
}

export interface SubscriptionResponse {
  success: boolean;
  status?: 'authorized' | 'rejected' | 'pending' | 'cancelled';
  subscription_id?: string;
  error?: string;
  message?: string;
}

export interface DirectSchedulePayload {
  cpf: string;
  email: string;
  nome: string;
  telefone: string;
  especialidade?: string;
  sku: string;
  horario_iso?: string;
  plano_ativo: true;
  sexo?: string;
}

export interface DirectScheduleResponse {
  ok: boolean;
  url?: string;
  provider?: string;
  error?: string;
}
