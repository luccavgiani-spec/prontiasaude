// supabase/functions/gas-proxy/index.ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const GAS_BASE = 'https://script.google.com/macros/s/AKfycbyEH4Wn4FEViaYtgbRpL1IKp8Yzz8Q-xZNzRKCeidrfRYqFlyl_rbyV3jXQk11Vmn4n/exec';

Deno.serve(async (req) => {
  // 1) OPTIONS → responde rápido (evita 504 no preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path') || '';
    if (!path) {
      return new Response(JSON.stringify({ success: false, error: 'Missing path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Só permitimos POST para os paths do GAS
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3) Repassa o corpo para o GAS
    const body = await req.text();
    const upstream = await fetch(`${GAS_BASE}?path=${encodeURIComponent(path)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // só este header (evita preflight extra)
      body,
    });

    const data = await upstream.text(); // pode não ser JSON sempre
    // 4) Retorna a resposta do GAS com CORS
    return new Response(data, {
      status: upstream.status,
      headers: { ...corsHeaders, 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch (err) {
    console.error('[gas-proxy] error', err);
    return new Response(JSON.stringify({ success: false, error: 'Proxy error', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
