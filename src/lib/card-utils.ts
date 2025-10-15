/**
 * Utilitários para manipulação e detecção de cartões de crédito
 */

export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard';

export interface CardBrandConfig {
  name: string;
  pattern: RegExp;
  gradient: string;
}

export const CARD_BRANDS: Record<CardBrand, CardBrandConfig> = {
  visa: {
    name: 'Visa',
    pattern: /^4/,
    gradient: 'from-blue-600 to-blue-800',
  },
  mastercard: {
    name: 'Mastercard',
    pattern: /^5[1-5]/,
    gradient: 'from-red-600 to-orange-600',
  },
  elo: {
    name: 'Elo',
    pattern: /^(4011|4312|4389|4514|5067|6277|6362|6363|6504|6505|6516)/,
    gradient: 'from-yellow-600 to-yellow-800',
  },
  amex: {
    name: 'Amex',
    pattern: /^3[47]/,
    gradient: 'from-green-600 to-teal-700',
  },
  hipercard: {
    name: 'Hipercard',
    pattern: /^606282/,
    gradient: 'from-red-700 to-red-900',
  },
};

/**
 * Detecta a bandeira do cartão baseado nos primeiros dígitos (BIN)
 */
export function detectCardBrand(number: string): CardBrand | null {
  const clean = number.replace(/\D/g, '');
  
  for (const [brand, config] of Object.entries(CARD_BRANDS)) {
    if (config.pattern.test(clean)) {
      return brand as CardBrand;
    }
  }
  
  return null;
}

/**
 * Formata o número do cartão com espaços (XXXX XXXX XXXX XXXX)
 */
export function formatCardNumber(number: string): string {
  const clean = number.replace(/\D/g, '');
  const groups = clean.match(/.{1,4}/g);
  return groups?.join(' ') || '';
}

/**
 * Mascara o número do cartão mostrando apenas os últimos 4 dígitos
 */
export function maskCardNumber(number: string): string {
  const clean = number.replace(/\D/g, '');
  
  if (clean.length < 4) return clean;
  
  const lastFour = clean.slice(-4);
  const maskedLength = clean.length - 4;
  const masked = '•'.repeat(maskedLength) + lastFour;
  
  return formatCardNumber(masked);
}

/**
 * Extrai o BIN (primeiros 6 dígitos) do número do cartão
 */
export function extractBIN(number: string): string {
  const clean = number.replace(/\D/g, '');
  return clean.slice(0, 6);
}

/**
 * Valida se o número do cartão tem comprimento adequado
 */
export function isValidCardLength(number: string): boolean {
  const clean = number.replace(/\D/g, '');
  // Amex tem 15 dígitos, outros têm 16
  return clean.length === 15 || clean.length === 16;
}

/**
 * Formata a validade do cartão (MM/AA)
 */
export function formatExpiry(value: string): string {
  const clean = value.replace(/\D/g, '');
  
  if (clean.length >= 2) {
    return clean.slice(0, 2) + '/' + clean.slice(2, 4);
  }
  
  return clean;
}
