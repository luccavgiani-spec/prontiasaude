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

interface CreateAppointmentRequest {
  operation: 'create_appointment';
  appointment_id?: string;
  email: string;
  user_id?: string;
  service_code: string;
  service_name?: string;
  start_at_local: string;
  duration_min: number;
  status?: string;
  order_id?: string;
  teams_join_url?: string;
  teams_meeting_id?: string;
  provider?: string;
  redirect_url?: string;
}

interface UpdateAppointmentRequest {
  operation: 'update_appointment';
  appointment_id: string;
  teams_join_url?: string;
  teams_meeting_id?: string;
  status?: string;
  redirect_url?: string;
}

interface GetAppointmentsRequest {
  operation: 'get_appointments';
  email: string;
}

interface GetAppointmentRequest {
  operation: 'get_appointment';
  appointment_id: string;
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

    // Operação: Criar agendamento
    if (body.operation === 'create_appointment') {
      const { 
        appointment_id, 
        email, 
        user_id,
        service_code, 
        service_name,
        start_at_local, 
        duration_min, 
        status, 
        order_id,
        teams_join_url,
        teams_meeting_id,
        provider,
        redirect_url
      } = body as CreateAppointmentRequest;

      const finalAppointmentId = appointment_id || `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          appointment_id: finalAppointmentId,
          email,
          user_id,
          service_code,
          service_name,
          start_at_local,
          duration_min,
          status: status || 'scheduled',
          order_id,
          teams_join_url,
          teams_meeting_id,
          provider,
          redirect_url
        })
        .select()
        .single();

      if (error) {
        console.error('[appointments-manager] Error creating appointment:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[appointments-manager] Appointment created:', data);
      return new Response(
        JSON.stringify({ success: true, appointment_id: finalAppointmentId, appointment: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Operação: Atualizar agendamento
    if (body.operation === 'update_appointment') {
      const { appointment_id, teams_join_url, teams_meeting_id, status, redirect_url } = body as UpdateAppointmentRequest;

      const updateData: any = { updated_at: new Date().toISOString() };
      if (teams_join_url) updateData.teams_join_url = teams_join_url;
      if (teams_meeting_id) updateData.teams_meeting_id = teams_meeting_id;
      if (status) updateData.status = status;
      if (redirect_url) updateData.redirect_url = redirect_url;

      const { data, error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('appointment_id', appointment_id)
        .select()
        .single();

      if (error) {
        console.error('[appointments-manager] Error updating appointment:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[appointments-manager] Appointment updated:', data);
      return new Response(
        JSON.stringify({ success: true, appointment: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Operação: Buscar agendamentos por email
    if (body.operation === 'get_appointments') {
      const { email } = body as GetAppointmentsRequest;

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('email', email)
        .order('start_at_local', { ascending: false });

      if (error) {
        console.error('[appointments-manager] Error fetching appointments:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[appointments-manager] Found ${data?.length || 0} appointments for ${email}`);
      console.log('[appointments-manager] Appointments with redirect_url:', data?.filter(a => a.redirect_url).length || 0);
      
      return new Response(
        JSON.stringify({ success: true, appointments: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Operação: Buscar agendamento específico
    if (body.operation === 'get_appointment') {
      const { appointment_id } = body as GetAppointmentRequest;

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_id', appointment_id)
        .maybeSingle();

      if (error) {
        console.error('[appointments-manager] Error fetching appointment:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, appointment: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Operação: Buscar pagamentos pendentes por email (para reprocessamento)
    if (body.operation === 'search_pending_payments') {
      const { email } = body;

      if (!email) {
        return new Response(
          JSON.stringify({ success: false, error: 'Email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('pending_payments')
        .select('id, order_id, payment_id, patient_email, patient_name, sku, status, processed, created_at, amount')
        .ilike('patient_email', `%${email}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('[appointments-manager] Error searching pending payments:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[appointments-manager] Found ${data?.length || 0} pending payments for ${email}`);
      return new Response(
        JSON.stringify({ success: true, payments: data || [] }),
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
