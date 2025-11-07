/**
 * Tipos TypeScript para o sistema de pagamentos
 */

export interface PayerOverride {
  first_name: string;
  last_name: string;
  cpf: string;
  phone: {
    area_code: string;
    number: string;
  };
  address: {
    zip_code: string;
    street_name: string;
    street_number?: string;
    neighborhood?: string;
    city: string;
    state: string;
  };
}

export interface CardFormData {
  token: string;
  payment_method_id: string;
  installments: number;
  payerOverride?: PayerOverride;
  deviceId?: string;
}

export interface InstallmentOption {
  installments: number;
  installment_amount: number;
  total_amount: number;
  recommended_message?: string;
}

export interface InstallmentsResponse {
  success: boolean;
  installments?: InstallmentOption[];
  error?: string;
}

export interface CardPreviewData {
  number: string;
  holder: string;
  expiry: string;
}

export interface PaymentFormCallbacks {
  onSubmit: (data: CardFormData) => void;
  onError: (error: string) => void;
  onCardDataChange?: (data: CardPreviewData) => void;
}
