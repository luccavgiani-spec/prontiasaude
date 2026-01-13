import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncResult {
  patient_id: string;
  email: string;
  success: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[ClubeBen Batch Sync] Starting batch synchronization...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar pacientes com clubeben_status diferente de 'active' OU NULL
    // que tenham CPF, birth_date e email preenchidos
    const { data: patientsToSync, error: fetchError } = await supabase
      .from('patients')
      .select('id, email, cpf, birth_date')
      .or('clubeben_status.is.null,clubeben_status.neq.active')
      .not('cpf', 'is', null)
      .not('birth_date', 'is', null)
      .not('email', 'is', null);

    if (fetchError) {
      console.error('[ClubeBen Batch Sync] Error fetching patients:', fetchError);
      throw fetchError;
    }

    console.log(`[ClubeBen Batch Sync] Found ${patientsToSync?.length || 0} patients to check`);

    const results: SyncResult[] = [];
    
    for (const patient of patientsToSync || []) {
      // Verificar se tem plano ativo
      const { data: activePlan } = await supabase
        .from('patient_plans')
        .select('id, plan_code')
        .or(`user_id.eq.${patient.id},email.eq.${patient.email}`)
        .eq('status', 'active')
        .gte('plan_expires_at', new Date().toISOString())
        .maybeSingle();

      if (activePlan) {
        console.log(`[ClubeBen Batch Sync] Syncing patient ${patient.id} with plan ${activePlan.plan_code}`);
        
        try {
          // Disparar clubeben-sync individual
          const syncResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/clubeben-sync`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                user_id: patient.id,
                user_email: patient.email,
                trigger_source: 'batch_sync',
              }),
            }
          );

          const syncData = await syncResponse.json();
          
          results.push({
            patient_id: patient.id,
            email: patient.email,
            success: syncResponse.ok && syncData.success,
            error: syncData.error || (!syncResponse.ok ? `HTTP ${syncResponse.status}` : undefined),
          });
        } catch (error) {
          console.error(`[ClubeBen Batch Sync] Error syncing patient ${patient.id}:`, error);
          results.push({
            patient_id: patient.id,
            email: patient.email,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[ClubeBen Batch Sync] Completed: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        total_checked: patientsToSync?.length || 0,
        synced: successCount,
        failed: failCount,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ClubeBen Batch Sync] Exception:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
