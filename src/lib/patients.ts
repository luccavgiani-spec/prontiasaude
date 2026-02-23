import { getHybridSession } from "@/lib/auth-hybrid";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { getPatientPlan } from "./patient-plan";
import { supabase } from "@/integrations/supabase/client";
import { supabaseProduction } from "@/lib/supabase-production";

const PATIENT_FIELDS = 'profile_complete, cpf, first_name, last_name, phone_e164, gender';

/**
 * Busca centralizada de paciente com fallback cross-environment.
 * 1. user_id no ambiente atual
 * 2. user_id no outro ambiente
 * 3. email na Produção (fallback final)
 */
export async function checkProfileComplete(
  userId: string,
  email: string,
  environment: 'cloud' | 'production' | null
): Promise<{ profileComplete: boolean; patient: any | null; resolvedClient: any }> {
  const primaryClient = environment === 'production' ? supabaseProduction : supabase;
  const secondaryClient = environment === 'production' ? supabase : supabaseProduction;

  // 1. Tentar por user_id no ambiente atual
  const { data: p1 } = await primaryClient
    .from('patients')
    .select(PATIENT_FIELDS)
    .eq('user_id', userId)
    .maybeSingle();
  if (p1) return { profileComplete: !!p1.profile_complete, patient: p1, resolvedClient: primaryClient };

  // 2. Tentar por user_id no outro ambiente
  const { data: p2 } = await secondaryClient
    .from('patients')
    .select(PATIENT_FIELDS)
    .eq('user_id', userId)
    .maybeSingle();
  if (p2) return { profileComplete: !!p2.profile_complete, patient: p2, resolvedClient: secondaryClient };

  // 3. Fallback por email na Produção
  if (email) {
    const { data: p3 } = await supabaseProduction
      .from('patients')
      .select(PATIENT_FIELDS)
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (p3) return { profileComplete: !!p3.profile_complete, patient: p3, resolvedClient: supabaseProduction };
  }

  return { profileComplete: false, patient: null, resolvedClient: primaryClient };
}

/** 
 * Garante que exista uma linha em public.patients para o usuário atual.
 * ✅ SIMPLIFICADO: SEMPRE chamar Produção via invokeEdgeFunction
 */
export async function ensurePatientRow(userId: string) {
  console.log('[ensurePatientRow] Chamando PRODUÇÃO para user_id:', userId);
  
  const { session } = await getHybridSession();
  const userEmail = session?.user?.email;
  
  console.log('[ensurePatientRow] Email:', userEmail);
  
  // ✅ SEMPRE usar invokeEdgeFunction (Produção)
  const { data, error } = await invokeEdgeFunction('patient-operations', {
    body: {
      operation: 'ensure_patient',
      user_id: userId,
      email: userEmail
    }
  });
  
  if (error) {
    console.error('[ensurePatientRow] Edge function error:', error);
    throw new Error(error.message || 'Falha ao garantir registro do paciente');
  }
  
  console.log('[ensurePatientRow] Resultado:', data);
  return true;
}

/** Upsert robusto + validações + logs + webhook GAS */
export async function upsertPatientBasic(payload: {
  first_name: string;
  last_name: string;
  address_line: string;
  cpf: string;              // pode vir com máscara; será normalizado para dígitos
  phone_e164: string;       // ex.: +5511999999999
  birth_date: string;       // YYYY-MM-DD
  termsAccepted: boolean;   // checkbox
  gender: string;           // obrigatório: M, F ou I
  cep: string;              // obrigatório: 8 dígitos
  address_number: string;   // obrigatório
  address_complement?: string; // opcional
  city: string;             // obrigatório
  state: string;            // obrigatório: UF
  source?: string;          // opcional: origem do cadastro
  userId?: string;          // opcional: fornecido pelo caller quando não há sessão
  userEmail?: string;       // opcional: fornecido pelo caller quando não há sessão
}) {
  // ✅ Aceitar userId/userEmail explícitos, fallback para sessão híbrida
  let userId = payload.userId;
  let userEmail = payload.userEmail;
  let accessToken: string | undefined;
  let environment: string | null = null;
  
  if (!userId || !userEmail) {
    const hybridResult = await getHybridSession();
    userId = userId || hybridResult.session?.user?.id;
    userEmail = userEmail || hybridResult.session?.user?.email;
    accessToken = hybridResult.session?.access_token;
    environment = hybridResult.environment;
  }
  
  console.log('[patients] userId:', userId, 'userEmail:', userEmail);

  const cleanCpf = (payload.cpf || '').replace(/\D/g, '');
  const cleanCep = (payload.cep || '').replace(/\D/g, '');
  if (!payload.first_name || !payload.last_name) throw new Error('Nome e sobrenome são obrigatórios.');
  if (!/^\+?\d{10,16}$/.test(payload.phone_e164)) {
    throw new Error('Telefone inválido. Use formato E.164 (ex.: +5511912345678).');
  }
  // Bloquear telefones placeholder conhecidos
  const BLOCKED_PHONES = ['+5511999999999', '+5500000000000', '+55999999999', '+5511111111111'];
  if (BLOCKED_PHONES.includes(payload.phone_e164)) {
    throw new Error('Por favor, informe um telefone válido (não use números de exemplo ou repetidos).');
  }
  if (!/^\d{11}$/.test(cleanCpf)) throw new Error('CPF deve ter 11 dígitos.');
  if (!payload.birth_date) throw new Error('Data de nascimento é obrigatória.');
  if (!payload.gender || !['M', 'F', 'I'].includes(payload.gender)) throw new Error('Gênero inválido.');
  if (!/^\d{8}$/.test(cleanCep)) throw new Error('CEP deve ter 8 dígitos.');
  if (!payload.city || !payload.state) throw new Error('Cidade e UF são obrigatórios.');

  // ✅ Upsert via Edge Function usando operação `upsert_patient`
  const fullName = `${payload.first_name} ${payload.last_name}`.trim();

  const { data: upsertResult, error: upsertError } = await invokeEdgeFunction('patient-operations', {
    body: {
      operation: 'upsert_patient',
      name: fullName,
      email: userEmail,
      phone_e164: payload.phone_e164,
      cpf: cleanCpf,
      birth_date: payload.birth_date,
      gender: payload.gender,
      cep: cleanCep,
      address_line: payload.address_line,
      address_number: payload.address_number,
      complement: payload.address_complement || null,
      city: payload.city,
      state: payload.state,
      source: payload.source || 'site',
      terms_accepted: payload.termsAccepted,
      profile_complete: true,
      first_name: payload.first_name,
      last_name: payload.last_name,
    }
  });

  if (upsertError) {
    console.error('Edge function upsert error (patients):', upsertError);
    throw new Error(upsertError.message || 'Falha ao salvar seus dados.');
  }

  console.log('[patients] ✅ upsert_patient result:', upsertResult);

  // ✅ Usar user_id retornado pela Edge Function
  const returnedUserId = upsertResult?.user_id || userId;

  // Send to GAS webhook (complete_profile)
  try {
    const patientPlan = userEmail ? await getPatientPlan(userEmail) : null;
    
    const hasActivePlan = patientPlan?.plan_code && 
                         patientPlan?.status === 'active' && 
                         patientPlan?.plan_expires_at &&
                         new Date(patientPlan.plan_expires_at) > new Date();

    console.log('[patients] Verificação de plano:', {
      email: userEmail,
      plan_code: patientPlan?.plan_code,
      status: patientPlan?.status,
      expires_at: patientPlan?.plan_expires_at,
      hasActivePlan
    });

    const headers: Record<string, string> = {};
    if (accessToken && environment === 'production') {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    await invokeEdgeFunction('patient-operations', {
      body: {
        operation: 'complete_profile',
        user_id: returnedUserId,
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: userEmail,
        phone: payload.phone_e164,
        cpf: cleanCpf,
        birth_date: payload.birth_date,
        gender: payload.gender || '',
        cep: payload.cep || '',
        address_number: payload.address_number || '',
        address_complement: payload.address_complement || '',
        city: payload.city || '',
        state: payload.state || '',
        plano: hasActivePlan
      },
      headers
    });
  } catch (gasError) {
    console.error('GAS webhook error (non-blocking):', gasError);
  }

  return { success: true, user_id: returnedUserId };
}
