import { validateCPF as validateCPFWithChecksum } from './cpf-validator';

export const validateCPF = (cpf: string): boolean => {
  if (!cpf) return false;
  
  const cleanCPF = cpf.replace(/\D/g, '');
  
  // Validar comprimento
  if (cleanCPF.length !== 11) return false;
  
  // Rejeitar CPFs com todos dígitos iguais
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  // Validar checksum usando biblioteca cpf-check
  return validateCPFWithChecksum(cpf);
};

export const formatCPF = (cpf: string): string => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return cpf;
  return `***.***.***-${cleanCPF.slice(-2)}`;
};

export const validateCNPJ = (cnpj: string): boolean => {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  return cleanCNPJ.length === 14 && /^\d{14}$/.test(cleanCNPJ);
};

export const validateCNPJWithChecksum = (cnpj: string): boolean => {
  const numbers = cnpj.replace(/\D/g, '');
  
  if (numbers.length !== 14) return false;
  
  // CNPJ inválidos conhecidos (todos dígitos iguais)
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  // Validar primeiro dígito verificador
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(numbers[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit1 !== parseInt(numbers[12])) return false;
  
  // Validar segundo dígito verificador
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(numbers[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit2 !== parseInt(numbers[13])) return false;
  
  return true;
};

export const formatCNPJ = (cnpj: string): string => {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  if (cleanCNPJ.length <= 2) return cleanCNPJ;
  if (cleanCNPJ.length <= 5) return cleanCNPJ.replace(/(\d{2})(\d{0,3})/, '$1.$2');
  if (cleanCNPJ.length <= 8) return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
  if (cleanCNPJ.length <= 12) return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
  return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
};

// DDDs válidos do Brasil (principais capitais e regiões)
const VALID_DDDS = [
  11, 12, 13, 14, 15, 16, 17, 18, 19, // SP
  21, 22, 24, // RJ
  27, 28, // ES
  31, 32, 33, 34, 35, 37, 38, // MG
  41, 42, 43, 44, 45, 46, // PR
  47, 48, 49, // SC
  51, 53, 54, 55, // RS
  61, // DF
  62, 64, // GO
  63, // TO
  65, 66, // MT
  67, // MS
  68, // AC
  69, // RO
  71, 73, 74, 75, 77, // BA
  79, // SE
  81, 87, // PE
  82, // AL
  83, // PB
  84, // RN
  85, 88, // CE
  86, 89, // PI
  91, 93, 94, // PA
  92, 97, // AM
  95, // RR
  96, // AP
  98, 99, // MA
];

export const validatePhoneE164 = (phone: string): boolean => {
  if (!phone) return false;
  
  // Validar formato E.164
  if (!/^\+55\d{10,11}$/.test(phone)) return false;
  
  const cleanPhone = phone.replace(/\D/g, '');
  const ddd = parseInt(cleanPhone.substring(2, 4));
  const number = cleanPhone.substring(4);
  
  // Validar DDD
  if (!VALID_DDDS.includes(ddd)) return false;
  
  // Rejeitar números sequenciais óbvios
  if (/^(\d)\1+$/.test(number)) return false;
  if (/^(0123456789|9876543210)/.test(number)) return false;
  
  // Validar padrão de celular (9 dígitos começando com 9) ou fixo (8 dígitos)
  if (number.length === 9) {
    // Celular: deve começar com 9
    return number[0] === '9';
  } else if (number.length === 8) {
    // Fixo: não deve começar com 9
    return number[0] !== '9';
  }
  
  return false;
};

export const formatPhoneE164 = (phone: string): string => {
  // Se já tem +55, retorna como está
  if (phone.startsWith('+55')) {
    return phone;
  }
  
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Se já começa com 55, não adiciona novamente
  if (cleanPhone.startsWith('55') && (cleanPhone.length === 12 || cleanPhone.length === 13)) {
    return `+${cleanPhone}`;
  }
  
  // Adiciona +55 apenas se não estiver presente
  if (cleanPhone.length === 11 || cleanPhone.length === 10) {
    return `+55${cleanPhone}`;
  }
  
  return phone; // Retorna como está se não conseguir processar
};

export const formatPhoneMask = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.length <= 10) {
    // Telefone fixo: (11) 1234-5678
    return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else {
    // Celular: (11) 91234-5678
    return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
};

export const validateCEP = (cep: string): boolean => {
  const cleanCEP = cep.replace(/\D/g, '');
  return cleanCEP.length === 8 && /^\d{8}$/.test(cleanCEP);
};

export const formatCEP = (cep: string): string => {
  const cleanCEP = cep.replace(/\D/g, '');
  if (cleanCEP.length <= 5) {
    return cleanCEP;
  }
  return cleanCEP.replace(/(\d{5})(\d{3})/, '$1-$2');
};

// Domínios temporários conhecidos para rejeitar
const TEMP_EMAIL_DOMAINS = [
  '10minutemail.com', 'guerrillamail.com', 'mailinator.com', 'tempmail.com',
  'throwaway.email', 'maildrop.cc', 'temp-mail.org', 'getnada.com',
  'yopmail.com', 'mailnesia.com', 'trashmail.com', 'sharklasers.com'
];

// TLDs válidos comuns
const VALID_TLDS = [
  'com', 'com.br', 'net', 'org', 'edu', 'gov', 'br', 'io', 'co', 'app',
  'dev', 'tech', 'info', 'biz', 'me', 'site', 'online', 'store', 'club'
];

export const validateEmail = (email: string): boolean => {
  if (!email) return false;
  
  // Validação básica de formato
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  
  // Rejeitar domínios temporários conhecidos
  if (TEMP_EMAIL_DOMAINS.some(temp => domain.includes(temp))) return false;
  
  // Validar TLD
  const tld = domain.split('.').slice(-2).join('.');
  const hasValidTLD = VALID_TLDS.some(validTld => 
    tld === validTld || tld.endsWith('.' + validTld)
  );
  
  if (!hasValidTLD) return false;
  
  // Rejeitar padrões obviamente falsos
  if (/^(test|fake|exemplo|asdf|qwerty|admin|noreply)@/.test(email.toLowerCase())) {
    return false;
  }
  
  return true;
};

export const validateBirthDate = (date: string): boolean => {
  const [year, month, day] = date.split('-').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  return birthDate < today && birthDate > new Date(1900, 0, 1);
};

export const isProfileComplete = (patient: any): boolean => {
  return !!(
    patient?.first_name &&
    patient?.last_name &&
    patient?.address_line &&
    patient?.cpf &&
    patient?.phone_e164 &&
    patient?.birth_date &&
    patient?.terms_accepted_at
  );
};
