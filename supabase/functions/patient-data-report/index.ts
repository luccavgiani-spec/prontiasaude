import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[patient-data-report] Gerando relatório de pacientes incompletos...');

    // Buscar pacientes com profile_complete = false
    const { data: incompletePatients, error: incompleteError } = await supabase
      .from('patients')
      .select('id, email, first_name, last_name, cpf, phone_e164, cep, address_line, created_at, updated_at')
      .eq('profile_complete', false)
      .order('created_at', { ascending: false });

    if (incompleteError) {
      console.error('[patient-data-report] Erro ao buscar pacientes incompletos:', incompleteError);
      throw incompleteError;
    }

    // Buscar total de pacientes completos
    const { count: completeCount, error: completeError } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('profile_complete', true);

    if (completeError) {
      console.error('[patient-data-report] Erro ao contar pacientes completos:', completeError);
    }

    // Processar dados dos pacientes incompletos
    const processedPatients = (incompletePatients || []).map(patient => {
      const missingFields: string[] = [];
      
      if (!patient.cpf) missingFields.push('cpf');
      if (!patient.phone_e164) missingFields.push('phone_e164');
      if (!patient.cep) missingFields.push('cep');
      if (!patient.address_line) missingFields.push('address_line');
      if (!patient.first_name) missingFields.push('first_name');
      if (!patient.last_name) missingFields.push('last_name');

      return {
        id: patient.id,
        email: patient.email,
        first_name: patient.first_name,
        last_name: patient.last_name,
        created_at: patient.created_at,
        updated_at: patient.updated_at,
        missing_fields: missingFields,
        never_updated: patient.created_at === patient.updated_at
      };
    });

    // Contadores
    const missingCpf = processedPatients.filter(p => p.missing_fields.includes('cpf')).length;
    const missingPhone = processedPatients.filter(p => p.missing_fields.includes('phone_e164')).length;
    const missingAddress = processedPatients.filter(p => p.missing_fields.includes('cep') || p.missing_fields.includes('address_line')).length;
    const neverUpdated = processedPatients.filter(p => p.never_updated).length;

    // Verificar fontes potenciais de dados (para backfill)
    const sourcesChecked = [];

    const { count: invitesCount } = await supabase
      .from('pending_employee_invites')
      .select('id', { count: 'exact', head: true })
      .not('cpf', 'is', null);
    sourcesChecked.push(`pending_employee_invites (${invitesCount || 0} com CPF)`);

    const { count: employeesCount } = await supabase
      .from('company_employees')
      .select('id', { count: 'exact', head: true })
      .not('cpf', 'is', null);
    sourcesChecked.push(`company_employees (${employeesCount || 0} com CPF)`);

    const { count: familyCount } = await supabase
      .from('pending_family_invites')
      .select('id', { count: 'exact', head: true });
    sourcesChecked.push(`pending_family_invites (${familyCount || 0} registros)`);

    const response = {
      generated_at: new Date().toISOString(),
      summary: {
        total_incomplete: processedPatients.length,
        total_complete: completeCount || 0,
        missing_cpf: missingCpf,
        missing_phone: missingPhone,
        missing_address: missingAddress,
        never_updated: neverUpdated,
        sources_checked: sourcesChecked,
        backfill_possible: false
      },
      incomplete_patients: processedPatients,
      recommendation: neverUpdated > 0 
        ? `${neverUpdated} pacientes nunca atualizaram seus dados após o cadastro inicial. Considere enviar um email solicitando que completem o cadastro em /completar-perfil.`
        : 'Todos os pacientes incompletos já tentaram atualizar seus dados pelo menos uma vez. Verifique logs para identificar possíveis erros.'
    };

    console.log('[patient-data-report] Relatório gerado:', {
      total_incomplete: response.summary.total_incomplete,
      total_complete: response.summary.total_complete,
      missing_cpf: response.summary.missing_cpf
    });

    return new Response(JSON.stringify(response, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[patient-data-report] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
