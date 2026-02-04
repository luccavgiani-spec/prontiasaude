/**
 * Lista mestre de todas as especialidades disponíveis no site
 * Fonte: CATALOGO_SERVICOS + SKU_TO_SERVICE + especialidades adicionais
 */
export const ALL_SPECIALTIES = [
  'Clínico Geral',
  'Psicologia',
  'Personal Trainer',
  'Nutrição',
  'Cardiologia',
  'Dermatologia',
  'Endocrinologia',
  'Gastroenterologia',
  'Ginecologia',
  'Oftalmologia',
  'Ortopedia',
  'Pediatria',
  'Otorrinolaringologia',
  'Medicina da Família',
  'Psiquiatria',
  'Nutrologia',
  'Geriatria',
  'Reumatologia',
  'Neurologia',
  'Infectologia',
  'Urologia',
  'Laudos Psicológicos',
  'Solicitação de Exames',
];

/**
 * Normaliza string para comparação (lowercase, sem acentos, trim)
 */
export function normalizeSpecialty(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Verifica se especialidade está na lista da Communicare
 */
export function isCommunicareSpecialty(
  specialty: string,
  communicareList: string[]
): boolean {
  const normalized = normalizeSpecialty(specialty);
  return communicareList.some(s => normalizeSpecialty(s) === normalized);
}
