import { validate as validateCpfLib } from 'cpf-check';

/**
 * Valida CPF usando biblioteca cpf-check
 */
export function validateCPF(cpf: string): boolean {
  if (!cpf) return false;
  return validateCpfLib(cpf);
}

/**
 * Remove formatação do CPF (mantém apenas números)
 */
export function cleanCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Formata CPF para exibição (###.###.###-##)
 */
export function formatCPF(cpf: string): string {
  const cleaned = cleanCPF(cpf);
  if (cleaned.length !== 11) return cpf;
  
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
