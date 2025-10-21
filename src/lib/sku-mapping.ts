/**
 * Mapeamento de SKUs técnicos para nomes de serviços
 * Exceções: Pronto Atendimento → "clinico geral", Psicólogos → "psicologo_1/4/8"
 */

const SKU_TO_SERVICE: Record<string, string> = {
  // Pronto Atendimento → Backend usa "Clínico Geral" para Communicare
  'ITC6534': 'Clínico Geral',
  
  // Psicologia → Formato Communicare
  'ZXW2165': 'Psicólogo - 1 sessão',
  'HXR8516': 'Psicólogo - 4 sessões',
  'YME9025': 'Psicólogo - 8 sessões',
  
  // Médicos Especialistas
  'BIR7668': 'Personal Trainer',
  'VPN5132': 'Nutricionista',
  'TQP5720': 'Cardiologista',
  'HGG3503': 'Dermatologista',
  'VHH8883': 'Endocrinologista',
  'TSB0751': 'Gastroenterologista',
  'CCP1566': 'Ginecologista',
  'FKS5964': 'Oftalmologista',
  'TVQ5046': 'Ortopedista',
  'HMG9544': 'Pediatra',
  'HME8366': 'Otorrinolaringologista',
  'DYY8522': 'Médico da Família',
  'QOP1101': 'Psiquiatra',
  'LZF3879': 'Nutrólogo',
  'YZD9932': 'Geriatria',
  'UDH3250': 'Reumatologista',
  'PKS9388': 'Neurologista',
  'MYX5186': 'Infectologista',
  
  // Outros Serviços
  'OVM9892': 'Laudos Psicológicos',
  'RZP5755': 'Renovação de Receitas',
  'ULT3571': 'Solicitação de Exames',
};

/**
 * Converte SKU técnico para nome do serviço
 * @param sku - SKU técnico (ex: "ITC6534", "ZXW2165")
 * @returns Nome do serviço (ex: "clinico geral", "psicologo_1", "Ginecologista")
 */
export function getServiceNameFromSKU(sku: string): string {
  return SKU_TO_SERVICE[sku] || sku;
}
