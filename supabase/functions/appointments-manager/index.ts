import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../common/cors.ts';

const corsHeaders = getCorsHeaders();

interface CreatePlanRequest {
  operation: 'create_or_update_plan';
  email: string;
  plan_code: string;
  plan_expires_at: string;
  user_id?: string;
}

interface GetPlanRequest {
  operation: 'get_patient_plan';
  email: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[appointments-manager] Request:', body);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Operação: Criar ou atualizar plano
    if (body.operation === 'create_or_update_plan') {
      const { email, plan_code, plan_expires_at, user_id } = body as CreatePlanRequest;

      // Buscar user_id pelo email se não fornecido
      let finalUserId = user_id;
      if (!finalUserId && email) {
        const { data: userData } = await supabase
          .from('auth.users')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        
        if (userData) {
          finalUserId = userData.id;
        }
      }

      const { data, error } = await supabase
        .from('patient_plans')
        .upsert({
          email,
          user_id: finalUserId,
          plan_code,
          plan_expires_at,
          status: 'active',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'email'
        })
        .select()
        .single();

      if (error) {
        console.error('[appointments-manager] Error creating/updating plan:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[appointments-manager] Plan created/updated:', data);
      return new Response(
        JSON.stringify({ success: true, plan: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Operação: Buscar plano
    if (body.operation === 'get_patient_plan') {
      const { email } = body as GetPlanRequest;

      const { data, error } = await supabase
        .from('patient_plans')
        .select('plan_code, plan_expires_at, status')
        .eq('email', email)
        .eq('status', 'active')
        .gte('plan_expires_at', new Date().toISOString())
        .order('plan_expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[appointments-manager] Error fetching plan:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, plan: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid operation' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[appointments-manager] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
