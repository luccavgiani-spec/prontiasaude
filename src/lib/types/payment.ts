/**
 * Tipos TypeScript para o sistema de pagamentos
 */

export interface CardFormData {
  token: string;
  payment_method_id: string;
  installments: number;
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
