import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Cria paciente na Communicare via API Patients
 * POST /v1/patient
 */
async function createCommunicarePatient(
  cpf: string,
  nome: string,
  email: string,
  telefone: string,
  sexo: string,
  birthDate?: string
): Promise<{ success: boolean; patientId?: number; error?: string; details?: any }> {
  const PATIENTS_BASE = Deno.env.get('COMMUNICARE_PATIENTS_BASE') || 
                        'https://api-patients-production.communicare.com.br';
  const API_TOKEN = Deno.env.get('COMMUNICARE_API_TOKEN');

  if (!API_TOKEN) {
    return { success: false, error: 'COMMUNICARE_API_TOKEN não configurado' };
  }

  try {
    console.log('[activate-communicare-manual] 📝 Iniciando cadastro do paciente na Communicare');
    console.log('[activate-communicare-manual] Nome:', nome);
    console.log('[activate-communicare-manual] CPF:', cpf.substring(0, 3) + '***');

    const cpfClean = cpf.replace(/\D/g, '');
    const phoneClean = telefone.replace(/\D/g, '');
    
    // Extrair DDI e número (ex: +5511999999999 → ddi: 55, mobile: 11999999999)
    const ddi = phoneClean.startsWith('55') ? '55' : '55';
    const mobileNumber = phoneClean.replace(/^55/, '');
    
    // Converter birth_date de YYYY-MM-DD para DDMMYYYY (formato Communicare)
    let birthDateFormatted = "01011990"; // Fallback
    if (birthDate) {
      try {
        const parts = birthDate.split('-');
        if (parts.length === 3) {
          const [year, month, day] = parts;
          birthDateFormatted = `${day}${month}${year}`;
          console.log('[activate-communicare-manual] Data de nascimento:', birthDate, '→', birthDateFormatted);
        }
      } catch (e) {
        console.warn('[activate-communicare-manual] Erro ao converter birth_date, usando fallback:', e);
      }
    }

    // Mapear gênero
    const genderFormatted = (sexo === 'M' || sexo === 'F') ? sexo : 'M';
    console.log('[activate-communicare-manual] Gênero:', sexo, '→', genderFormatted);

    const patientPayload = {
      name: nome,
      cpf: cpfClean,
      mobileNumber: mobileNumber,
      email: email,
      ddi: ddi,
      birthDate: birthDateFormatted,
      gender: genderFormatted,
      workingArea: "Outro",
      jogPosition: "Outro",
    };
    
    console.log('[activate-communicare-manual] Payload:', JSON.stringify(patientPayload, null, 2));
    
    const res = await fetch(`${PATIENTS_BASE}/v1/patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_token': API_TOKEN,
      },
      body: JSON.stringify(patientPayload)
    });
    
    const resText = await res.text();
    console.log('[activate-communicare-manual] Response status:', res.status);
    console.log('[activate-communicare-manual] Response body:', resText);
    
    // 201 = criado, 409 = já existe (ambos são sucesso)
    if (res.status === 201 || res.status === 409) {
      console.log('[activate-communicare-manual] ✓ Paciente criado ou já existente');
      
      let patientId: number | undefined;
      
      try {
        const postData = JSON.parse(resText);
        patientId = postData.id || postData.patientId;
        
        if (patientId) {
          console.log('[activate-communicare-manual] ✓ patientId obtido do POST:', patientId);
          return { success: true, patientId, details: postData };
        }
      } catch (e) {
        console.log('[activate-communicare-manual] POST response não contém ID, consultando via GET...');
      }
      
      // Se não tiver ID no POST, fazer GET
      console.log('[activate-communicare-manual] Consultando patientId via GET...');
      const getRes = await fetch(`${PATIENTS_BASE}/v1/patient?cpf=${cpfClean}`, {
        method: 'GET',
        headers: { 'api_token': API_TOKEN }
      });
      
      if (getRes.ok) {
        const getBody = await getRes.text();
        console.log('[activate-communicare-manual] GET Response body:', getBody);
        
        try {
          const getData = JSON.parse(getBody);
          // Pode ser array ou objeto
          if (Array.isArray(getData)) {
            patientId = getData[0]?.id;
          } else {
            patientId = getData.id;
          }
          
          if (patientId) {
            console.log('[activate-communicare-manual] ✓ patientId obtido via GET:', patientId);
            return { success: true, patientId, details: getData };
          }
        } catch (e) {
          console.error('[activate-communicare-manual] Erro ao parsear GET response:', e);
        }
      }
      
      // Sucesso mesmo sem ID (paciente existe)
      console.log('[activate-communicare-manual] ⚠️ Paciente criado mas ID não obtido');
      return { success: true, details: { message: 'Paciente criado/existente, ID não retornado' } };
    }
    
    console.error('[activate-communicare-manual] ❌ Erro ao criar paciente:', res.status, resText);
    return { 
      success: false, 
      error: `HTTP ${res.status}: ${resText}`,
      details: { status: res.status, body: resText }
    };

  } catch (error) {
    console.error('[activate-communicare-manual] ❌ Exception:', error);
    return { 
      success: false, 
      error: error.message || 'Exception during registration',
      details: { exception: error.toString() }
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[activate-communicare-manual] 📥 Requisição recebida');
    console.log('[activate-communicare-manual] Method:', req.method);
    console.log('[activate-communicare-manual] URL:', req.url);

    const { email, cpf } = await req.json();

    console.log('[activate-communicare-manual] Email:', email);
    console.log('[activate-communicare-manual] CPF:', cpf?.substring(0, 3) + '***');

    if (!email && !cpf) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email ou CPF obrigatório' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Buscar dados do paciente no Supabase
    // ✅ CORREÇÃO: Usar URL e KEY fixa do projeto original
    const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
    const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(
      ORIGINAL_SUPABASE_URL,
      ORIGINAL_SERVICE_ROLE_KEY
    );

    let query = supabaseAdmin
      .from('patients')
      .select('id, email, first_name, last_name, cpf, phone_e164, gender, birth_date');

    if (email) {
      query = query.eq('email', email);
    } else if (cpf) {
      query = query.eq('cpf', cpf.replace(/\D/g, ''));
    }

    const { data: patient, error: patientError } = await query.maybeSingle();

    if (patientError || !patient) {
      console.error('[activate-communicare-manual] ❌ Paciente não encontrado:', patientError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Paciente não encontrado no banco de dados' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[activate-communicare-manual] ✅ Paciente encontrado:', {
      email: patient.email,
      nome: `${patient.first_name} ${patient.last_name}`,
      cpf: patient.cpf?.substring(0, 3) + '***'
    });

    // Validar dados obrigatórios
    if (!patient.cpf || !patient.phone_e164) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Paciente sem CPF ou telefone cadastrado',
          patient: {
            email: patient.email,
            has_cpf: !!patient.cpf,
            has_phone: !!patient.phone_e164
          }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Cadastrar na Communicare
    const nomeCompleto = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Paciente';

    const result = await createCommunicarePatient(
      patient.cpf,
      nomeCompleto,
      patient.email,
      patient.phone_e164,
      patient.gender || 'M',
      patient.birth_date
    );

    if (result.success) {
      // Atualizar paciente com ID da Communicare (se obtido)
      if (result.patientId) {
        await supabaseAdmin
          .from('patients')
          .update({ 
            communicare_patient_id: String(result.patientId),
            communicare_registered_at: new Date().toISOString()
          })
          .eq('id', patient.id);
      }

      // Registrar métrica de sucesso
      await supabaseAdmin.from('metrics').insert({
        metric_type: 'communicare_manual_activation',
        metadata: {
          patient_id: patient.id,
          patient_email: patient.email,
          activation_source: 'manual_admin',
          communicare_patient_id: result.patientId,
          communicare_details: result.details
        }
      });

      console.log('[activate-communicare-manual] ✅ Cadastro concluído com sucesso');
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Paciente cadastrado na Communicare com sucesso',
          patient: {
            email: patient.email,
            nome: nomeCompleto,
            cpf: patient.cpf.substring(0, 3) + '.' + patient.cpf.substring(3, 6) + '.***-**'
          },
          communicare_patient_id: result.patientId,
          communicare_details: result.details
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      // Registrar métrica de falha
      await supabaseAdmin.from('metrics').insert({
        metric_type: 'communicare_manual_activation',
        metadata: {
          patient_id: patient.id,
          patient_email: patient.email,
          activation_source: 'manual_admin',
          status: 'failed',
          error: result.error,
          communicare_details: result.details
        }
      });

      console.error('[activate-communicare-manual] ❌ Falha no cadastro:', result.error);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: result.error,
          details: result.details
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('[activate-communicare-manual] ❌ Exception:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno do servidor',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
