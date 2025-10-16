import { getServiceNameFromSKU } from './sku-mapping';

/**
 * Payload padronizado para o Google Apps Script
 */
export interface GASPayload {
  payment_id: string;
  payment_status: string;
  sku: string;
  amount: number;
  currency: string;
  cpf: string;
  email: string;
  name: string;
  phone: string;
  especialidade: string;
  horarioISO: string;
  planoAtivo: boolean;
  source: string;
}

export interface TransformPayloadParams {
  payment_id: string;
  payment_status: string;
  sku: string;
  amount: number; // em centavos
  cpf: string;
  email: string;
  name: string;
  phone: string;
  especialidade: string;
  horario_iso?: string;
  plano_ativo?: boolean;
}

/**
 * Transforma dados do Lovable para o formato esperado pelo Google Apps Script
 * 
 * @param params - Parâmetros do pagamento
 * @returns Payload formatado para o GAS
 * 
 * @example
 * transformToGASPayload({
 *   payment_id: 'MP-123',
 *   payment_status: 'approved',
 *   sku: 'CCP1566',
 *   amount: 12990, // centavos
 *   cpf: '123.456.789-09',
 *   email: 'user@example.com',
 *   name: 'João Silva',
 *   phone: '+55 11 99999-0000',
 *   especialidade: 'Ginecologia',
 *   plano_ativo: false
 * })
 * // Retorna:
 * // {
 * //   payment_id: 'MP-123',
 * //   payment_status: 'approved',
 * //   sku: 'Ginecologista',
 * //   amount: 129.90,
 * //   currency: 'BRL',
 * //   cpf: '12345678909',
 * //   email: 'user@example.com',
 * //   name: 'João Silva',
 * //   phone: '5511999990000',
 * //   especialidade: 'ginecologia',
 * //   horarioISO: '2025-10-16T18:30:00-03:00',
 * //   planoAtivo: false,
 * //   source: 'lovable'
 * // }
 */
export function transformToGASPayload(params: TransformPayloadParams): GASPayload {
  return {
    payment_id: params.payment_id,
    payment_status: params.payment_status,
    sku: getServiceNameFromSKU(params.sku), // Converte SKU técnico → nome serviço
    amount: params.amount / 100, // Converte centavos → reais
    currency: 'BRL',
    cpf: params.cpf.replace(/\D/g, ''), // Remove máscara
    email: params.email,
    name: params.name,
    phone: params.phone.replace(/\D/g, ''), // Remove formatação
    especialidade: params.especialidade.toLowerCase(), // Lowercase
    horarioISO: params.horario_iso || new Date().toISOString(),
    planoAtivo: params.plano_ativo || false,
    source: 'lovable'
  };
}
