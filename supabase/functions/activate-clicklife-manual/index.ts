import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to register patient in ClickLife
async function registerClickLifePatient(
  cpf: string,
  nome: string,
  email: string,
  telefone: string,
  planoId: number,
  sexo: string,
  birthDate?: string
): Promise<{ success: boolean; error?: string; details?: any }> {
  const CLICKLIFE_API = Deno.env.get('CLICKLIFE_API_BASE');
  const INTEGRATOR_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN');

  if (!CLICKLIFE_API || !INTEGRATOR_TOKEN) {
    return { success: false, error: 'ClickLife credentials not configured' };
  }

  try {
    console.log('[activate-clicklife-manual] 📝 Iniciando cadastro do paciente na ClickLife');
    console.log('[activate-clicklife-manual] Nome:', nome);
    console.log('[activate-clicklife-manual] CPF:', cpf.substring(0, 3) + '***');

    // Normalizar telefone
    let telefoneLimpo = telefone.replace(/\D/g, '');
    if (telefoneLimpo.startsWith('55')) {
      telefoneLimpo = telefoneLimpo.substring(2);
    }
    const ddd = telefoneLimpo.substring(0, 2);
    const numero = telefoneLimpo.substring(2);

    // Normalizar e converter data de nascimento para DD-MM-YYYY
    let birthDateFormatted = '01-01-1990'; // fallback
    if (birthDate) {
      if (birthDate.includes('-')) {
        const parts = birthDate.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD -> DD-MM-YYYY
            birthDateFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else {
            // Já está em DD-MM-YYYY
            birthDateFormatted = birthDate;
          }
        }
      }
    }

    const registerPayload = {
      nome,
      cpf: cpf.replace(/\D/g, ''),
      email,
      senha: Deno.env.get('CLICKLIFE_PATIENT_DEFAULT_PASSWORD') || 'Pr0ntia!2025',
      datanascimento: birthDateFormatted,
      sexo: sexo || 'F',
      telefone: numero,
      logradouro: 'Rua Exemplo',
      numero: '123',
      bairro: 'Centro',
      cep: '01000000',
      cidade: 'São Paulo',
      estado: 'SP',
      empresaid: 9083,
      planoid: planoId
    };

    console.log('[activate-clicklife-manual] Payload de cadastro:', {
      ...registerPayload,
      senha: '***',
      cpf: registerPayload.cpf.substring(0, 3) + '***'
    });

    // 1. CADASTRAR PACIENTE
    const registerRes = await fetch(`${CLICKLIFE_API}/usuarios/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authtoken': INTEGRATOR_TOKEN
      },
      body: JSON.stringify(registerPayload)
    });

    const registerData = await registerRes.json();
    console.log('[activate-clicklife-manual] Resposta do cadastro:', registerData);

    // Tolerar erros de "já cadastrado"
    if (!registerRes.ok && registerData.mensagem?.toLowerCase().includes('já cadastrado')) {
      console.log('[activate-clicklife-manual] ⚠️ Paciente já cadastrado (continuando para ativação)');
    } else if (!registerRes.ok) {
      console.error('[activate-clicklife-manual] ❌ Erro no cadastro:', registerData);
      return { 
        success: false, 
        error: registerData.mensagem || 'Erro ao cadastrar paciente',
        details: registerData
      };
    }

    // 2. ATIVAR PACIENTE
    console.log('[activate-clicklife-manual] 🔐 Ativando paciente...');
    
    const activatePayload = {
      authtoken: INTEGRATOR_TOKEN,
      cpf: cpf.replace(/\D/g, ''),
      empresaid: 9083,
      planoid: planoId,
      proposito: 'Ativar'
    };

    const activateRes = await fetch(`${CLICKLIFE_API}/usuarios/ativacao`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authtoken': INTEGRATOR_TOKEN
      },
      body: JSON.stringify(activatePayload)
    });

    const activateData = await activateRes.json();
    console.log('[activate-clicklife-manual] Resposta da ativação:', activateData);

    if (!activateRes.ok) {
      console.error('[activate-clicklife-manual] ❌ Erro na ativação:', activateData);
      return { 
        success: false, 
        error: activateData.mensagem || 'Erro ao ativar paciente',
        details: activateData
      };
    }

    console.log('[activate-clicklife-manual] ✅ Paciente cadastrado e ativado com sucesso');
    return { 
      success: true, 
      details: {
        register: registerData,
        activate: activateData
      }
    };

  } catch (error) {
    console.error('[activate-clicklife-manual] ❌ Exception:', error);
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
    console.log('[activate-clicklife-manual] 📥 Requisição recebida');
    console.log('[activate-clicklife-manual] Method:', req.method);
    console.log('[activate-clicklife-manual] URL:', req.url);

    const { email, cpf, plan_id } = await req.json();

    console.log('[activate-clicklife-manual] 📥 Requisição recebida');
    console.log('[activate-clicklife-manual] Email:', email);
    console.log('[activate-clicklife-manual] CPF:', cpf?.substring(0, 3) + '***');
    console.log('[activate-clicklife-manual] Plan ID:', plan_id || 864);

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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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
      console.error('[activate-clicklife-manual] ❌ Paciente não encontrado:', patientError);
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

    console.log('[activate-clicklife-manual] ✅ Paciente encontrado:', {
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

    // Cadastrar na ClickLife
    const nomeCompleto = `${patient.first_name} ${patient.last_name}`;
    const planoId = plan_id || 864; // Plano padrão para consultas avulsas

    const result = await registerClickLifePatient(
      patient.cpf,
      nomeCompleto,
      patient.email,
      patient.phone_e164,
      planoId,
      patient.gender || 'F',
      patient.birth_date
    );

    if (result.success) {
      // Registrar métrica de sucesso
      await supabaseAdmin.from('metrics').insert({
        metric_type: 'clicklife_manual_activation',
        status: 'success',
        patient_email: patient.email,
        plan_code: `PLAN_${planoId}`,
        metadata: {
          patient_id: patient.id,
          activation_source: 'manual_admin',
          clicklife_details: result.details
        }
      });

      console.log('[activate-clicklife-manual] ✅ Cadastro concluído com sucesso');
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Paciente cadastrado e ativado na ClickLife com sucesso',
          patient: {
            email: patient.email,
            nome: nomeCompleto,
            cpf: patient.cpf.substring(0, 3) + '.' + patient.cpf.substring(3, 6) + '.***-**'
          },
          clicklife_details: result.details
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      // Registrar métrica de falha
      await supabaseAdmin.from('metrics').insert({
        metric_type: 'clicklife_manual_activation',
        status: 'failed',
        patient_email: patient.email,
        plan_code: `PLAN_${planoId}`,
        metadata: {
          patient_id: patient.id,
          activation_source: 'manual_admin',
          error: result.error,
          clicklife_details: result.details
        }
      });

      console.error('[activate-clicklife-manual] ❌ Falha no cadastro:', result.error);
      
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
    console.error('[activate-clicklife-manual] ❌ Exception:', error);
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
