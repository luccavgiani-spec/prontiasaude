import { supabase } from "@/integrations/supabase/client";
import { supabaseProductionAuth } from "@/lib/auth-hybrid";
import { getHybridSession } from "@/lib/auth-hybrid";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { getPatientPlan } from "./patient-plan";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Garante que exista uma linha em public.patients para o usuário atual */
export async function ensurePatientRow(userId: string, dbClient: SupabaseClient = supabase) {
  const { data, error } = await dbClient
    .from('patients')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data?.id) return true;

  // Buscar email do usuário autenticado
  const { data: authData } = await dbClient.auth.getUser();
  const userEmail = authData?.user?.email;

  const { error: insErr } = await dbClient.from('patients').insert({ 
    user_id: userId,
    email: userEmail 
  });
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
  gender: string;           // obrigatório: M, F ou I
  cep: string;              // obrigatório: 8 dígitos
  address_number: string;   // obrigatório
  address_complement?: string; // opcional
  city: string;             // obrigatório
  state: string;            // obrigatório: UF
  source?: string;          // opcional: origem do cadastro
}) {
  // ✅ HÍBRIDO: Detectar ambiente correto (Cloud ou Produção)
  const { session, environment } = await getHybridSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;
  
  console.log('[patients] Ambiente detectado:', environment, 'userId:', userId);
  
  if (!userId) throw new Error('Sessão expirada. Faça login novamente.');

  // ✅ Usar cliente correto baseado no ambiente
  const dbClient = environment === 'production' ? supabaseProductionAuth : supabase;
  console.log('[patients] Usando cliente:', environment === 'production' ? 'supabaseProduction' : 'supabase');

  await ensurePatientRow(userId, dbClient);

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

  // Buscar patient.id existente pelo user_id
  const { data: existingPatient } = await dbClient
    .from('patients')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  const updateData = {
    user_id: userId,
    email: userEmail,
    first_name: payload.first_name,
    last_name: payload.last_name,
    address_line: payload.address_line,
    cpf: cleanCpf,
    phone_e164: payload.phone_e164,
    birth_date: payload.birth_date,
    gender: payload.gender,
    cep: cleanCep,
    address_number: payload.address_number,
    complement: payload.address_complement || null,
    city: payload.city,
    state: payload.state,
    source: payload.source || 'site',
    terms_accepted_at: payload.termsAccepted ? new Date().toISOString() : null,
    profile_complete: true
  };

  // Lógica explícita: UPDATE se existe, INSERT se não
  if (existingPatient?.id) {
    const { error } = await dbClient
      .from('patients')
      .update(updateData)
      .eq('id', existingPatient.id);
    if (error) {
      console.error('Supabase update error (patients):', error);
      throw new Error(error.message || 'Falha ao salvar seus dados.');
    }
  } else {
    const { error } = await dbClient
      .from('patients')
      .insert(updateData);
    if (error) {
      console.error('Supabase insert error (patients):', error);
      throw new Error(error.message || 'Falha ao salvar seus dados.');
    }
  }

  // Send to GAS webhook
  try {
    // ✅ CORREÇÃO: Verificar plano ATIVO e NÃO EXPIRADO na tabela patient_plans
    const patientPlan = userEmail ? await getPatientPlan(userEmail) : null;
    
    // Só marcar hasActivePlan=true se:
    // 1. Tiver plan_code
    // 2. Status for 'active'
    // 3. plan_expires_at for maior que agora
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

    await invokeEdgeFunction('patient-operations', {
      body: {
        operation: 'complete_profile',
        user_id: userId,
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