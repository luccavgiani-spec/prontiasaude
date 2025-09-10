export const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/\D/g, '');
  return cleanCPF.length === 11 && /^\d{11}$/.test(cleanCPF);
};

export const formatCPF = (cpf: string): string => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return cpf;
  return `***.***.***-${cleanCPF.slice(-2)}`;
};

export const validatePhoneE164 = (phone: string): boolean => {
  return /^\+55\d{10,11}$/.test(phone);
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

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validateBirthDate = (date: string): boolean => {
  const birthDate = new Date(date);
  const today = new Date();
  return birthDate < today && birthDate > new Date('1900-01-01');
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

export const isIntakeComplete = (patient: any): boolean => {
  const hasAllergiesValid = patient?.has_allergies === false || 
    (patient?.has_allergies === true && patient?.allergies?.trim());
    
  const hasComorbiditiesValid = patient?.has_comorbidities === false || 
    (patient?.has_comorbidities === true && patient?.comorbidities?.trim());
    
  const hasChronicMedsValid = patient?.has_chronic_meds === false || 
    (patient?.has_chronic_meds === true && patient?.chronic_meds?.trim());
    
  return !!(
    patient?.pregnancy_status &&
    hasAllergiesValid &&
    hasComorbiditiesValid &&
    hasChronicMedsValid
  );
};