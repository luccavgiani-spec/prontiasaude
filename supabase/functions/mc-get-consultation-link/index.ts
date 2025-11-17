import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GetLinkRequest {
  order_id?: string;
  contact_id?: string;
  email?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: GetLinkRequest = await req.json();
    const { order_id, contact_id, email } = payload;

    console.log('[mc-get-consultation-link] 🔍 Request:', { order_id, contact_id, email });

    if (!order_id && !contact_id && !email) {
      throw new Error('order_id, contact_id ou email são obrigatórios');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar appointment por order_id (prioridade), email ou contact_id
    let query = supabase
      .from('appointments')
      .select('redirect_url, created_at, order_id, email')
      .not('redirect_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (order_id) {
      console.log('[mc-get-consultation-link] Buscando por order_id:', order_id);
      query = query.eq('order_id', order_id);
    } else if (email) {
      console.log('[mc-get-consultation-link] Buscando por email:', email);
      query = query.eq('email', email);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[mc-get-consultation-link] ❌ DB Error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.warn('[mc-get-consultation-link] ⚠️ Appointment não encontrado');
      
      // Retornar URL vazia para ManyChat saber que ainda não está pronto
      return new Response(JSON.stringify({
        url: '',
        found: false,
        message: 'Aguardando confirmação do pagamento...'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[mc-get-consultation-link] ✅ URL encontrada:', {
      url: data[0].redirect_url,
      order_id: data[0].order_id,
      email: data[0].email
    });

    return new Response(JSON.stringify({
      url: data[0].redirect_url,
      found: true,
      order_id: data[0].order_id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[mc-get-consultation-link] ❌ Error:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      url: '',
      found: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
