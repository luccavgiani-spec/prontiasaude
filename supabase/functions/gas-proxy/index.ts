// gas-proxy (Supabase Edge Function) - replace entire handler file
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyoS_NkEnauFJGEIs3Rz2NR9UglWfi3qjsg6Ef0TtfDEPlyqFuVvb9WIFkgOLNuN4kk/exec';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I';

// allowed origin list (adapte se precisar)
const ALLOWED_ORIGIN = 'https://prontiasaude.com.br';

export default async function handler(req: Request) {
  // CORS headers (always include)
  const origin = req.headers.get('origin') || ALLOWED_ORIGIN;
  const corsHeaders = new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  });

  // respond preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // require Authorization header from frontend (Bearer <ANON_KEY>)
  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${SUPABASE_ANON}`) {
    return new Response(JSON.stringify({ ok:false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  try {
    // parse path query param from original request (frontend calls gas-proxy?path=mp-create-payment)
    const urlObj = new URL(req.url);
    const path = urlObj.searchParams.get('path') || '';
    const target = GAS_URL + (path ? `?path=${encodeURIComponent(path)}` : '');

    // build fetch options forwarding body & content-type
    const headers = new Headers();
    // forward content-type if present
    const incomingCt = req.headers.get('content-type');
    if (incomingCt) headers.set('Content-Type', incomingCt);

    // forward other useful headers (NOT Authorization to GAS)
    // forward X-Requested-With if exists
    const xr = req.headers.get('x-requested-with');
    if (xr) headers.set('X-Requested-With', xr);

    const fetchInit: RequestInit = {
      method: req.method,
      headers,
      // read body as text and forward (if present)
      body: ['GET','HEAD'].includes(req.method.toUpperCase()) ? undefined : await req.text()
    };

    const res = await fetch(target, fetchInit);
    const text = await res.text();

    // copy response and attach CORS headers
    const respHeaders = new Headers(res.headers);
    respHeaders.set('Access-Control-Allow-Origin', origin);
    respHeaders.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    respHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    return new Response(text, { status: res.status, headers: respHeaders });
  } catch (err: any) {
    const h = new Headers({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    return new Response(JSON.stringify({ ok:false, error: String(err) }), { status: 500, headers: h });
  }
}
