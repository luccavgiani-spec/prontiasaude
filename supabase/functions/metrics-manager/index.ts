import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { getCorsHeaders } from '../common/cors.ts';

const corsHeaders = getCorsHeaders();

interface MetricPayload {
  metric_type: 'sale' | 'appointment' | 'registration';
  amount_cents?: number;
  plan_code?: string;
  specialty?: string;
  platform?: 'clicklife' | 'communicare';
  status?: string;
  patient_email?: string;
  company_id?: string;
  metadata?: Record<string, any>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verificar se usuário é admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      throw new Error('Forbidden: Admin access required');
    }

    const url = new URL(req.url);
    const operation = url.searchParams.get('operation') || 'read';

    // CREATE METRIC
    if (req.method === 'POST' && operation === 'create') {
      const payload: MetricPayload = await req.json();

      console.log('[metrics-manager] Creating metric:', payload);

      const { data, error } = await supabaseClient
        .from('metrics')
        .insert({
          metric_type: payload.metric_type,
          amount_cents: payload.amount_cents,
          plan_code: payload.plan_code,
          specialty: payload.specialty,
          platform: payload.platform,
          status: payload.status,
          patient_email: payload.patient_email,
          company_id: payload.company_id,
          metadata: payload.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[metrics-manager] Error creating metric:', error);
        throw error;
      }

      console.log('[metrics-manager] Metric created:', data.id);

      return new Response(
        JSON.stringify({ success: true, metric: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
      );
    }

    // READ METRICS
    if ((req.method === 'GET' || req.method === 'POST') && operation === 'read') {
      let metricType, platform, status, startDate, endDate, limit;

      // ✅ Aceitar params via body (POST) ou query string (GET)
      if (req.method === 'POST') {
        const body = await req.json();
        metricType = body.metric_type;
        platform = body.platform;
        status = body.status;
        startDate = body.start_date;
        endDate = body.end_date;
        limit = body.limit || 1000;
      } else {
        metricType = url.searchParams.get('metric_type');
        platform = url.searchParams.get('platform');
        status = url.searchParams.get('status');
        startDate = url.searchParams.get('start_date');
        endDate = url.searchParams.get('end_date');
        limit = parseInt(url.searchParams.get('limit') || '1000');
      }

      console.log('[metrics-manager] Reading metrics with filters:', {
        metricType,
        platform,
        status,
        startDate,
        endDate,
        limit,
      });

      let query = supabaseClient
        .from('metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (metricType) {
        query = query.eq('metric_type', metricType);
      }

      if (platform) {
        query = query.eq('platform', platform);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('[metrics-manager] Error reading metrics:', error);
        throw error;
      }

      console.log('[metrics-manager] Found', data?.length || 0, 'metrics');

      return new Response(
        JSON.stringify({
          success: true,
          metrics: data,
          count: data?.length || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid operation' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('[metrics-manager] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
