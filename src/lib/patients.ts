import { supabase } from "@/integrations/supabase/client";
import { getPatientPlan } from "./patient-plan";

/** Garante que exista uma linha em public.patients para o usuário atual */
export async function ensurePatientRow(userId: string) {
  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data?.id) return true;

  const { error: insErr } = await supabase.from('patients').insert({ id: userId });
  // Ignora conflito se linha foi criada por trigger em paralelo
  if (insErr && insErr.code !== '23505') throw insErr;
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
  gender?: string;          // opcional
  cep?: string;             // opcional
  address_number?: string;  // opcional
  address_complement?: string; // opcional
  city?: string;            // opcional
  state?: string;           // opcional
}) {
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess?.session?.user?.id;
  const userEmail = sess?.session?.user?.email;
  if (!userId) throw new Error('Sessão expirada. Faça login novamente.');

  await ensurePatientRow(userId);

  const cleanCpf = (payload.cpf || '').replace(/\D/g, '');
  if (!payload.first_name || !payload.last_name) throw new Error('Nome e sobrenome são obrigatórios.');
  if (!/^\+?\d{10,16}$/.test(payload.phone_e164)) throw new Error('Telefone inválido. Use formato E.164 (ex.: +5511999999999).');
  if (!/^\d{11}$/.test(cleanCpf)) throw new Error('CPF deve ter 11 dígitos.');
  if (!payload.birth_date) throw new Error('Data de nascimento é obrigatória.');

  const update = {
    id: userId,
    first_name: payload.first_name,
    last_name: payload.last_name,
    address_line: payload.address_line,
    cpf: cleanCpf,
    phone_e164: payload.phone_e164,
    birth_date: payload.birth_date,
    terms_accepted_at: payload.termsAccepted ? new Date().toISOString() : null,
    profile_complete: true
  };

  const { error } = await supabase.from('patients').upsert(update).eq('id', userId);
  if (error) {
    console.error('Supabase upsert error (patients):', error);
    throw new Error(error.message || 'Falha ao salvar seus dados.');
  }

  // Send to GAS webhook
  try {
    // Check if patient has active plan
    const patientPlan = userEmail ? await getPatientPlan(userEmail) : null;
    const hasActivePlan = patientPlan?.status === 'active' || patientPlan?.plan_code ? true : false;

    await supabase.functions.invoke('patient-operations', {
      body: {
        operation: 'complete_profile',
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
      }
    });
  } catch (gasError) {
    console.error('GAS webhook error (non-blocking):', gasError);
  }

  return true;
}