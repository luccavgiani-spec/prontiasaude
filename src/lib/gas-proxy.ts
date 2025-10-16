/**
 * Wrapper para chamadas ao Google Apps Script via Supabase Edge Function Proxy
 * Inclui Authorization header (anon key) para passar pelo proxy
 */

const SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I';

export async function callGas(path: string, payload?: any) {
  const url = `${SUPABASE_URL}/functions/v1/gas-proxy?path=${encodeURIComponent(path)}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${SUPABASE_ANON}`,
    'Content-Type': 'application/json'
  };
  
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  
  const text = await res.text();
  let json = null;
  try { 
    json = JSON.parse(text); 
  } catch(_) { 
    json = null; 
  }
  
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status} ${text}`);
  }
  
  return { status: res.status, text, json };
}

/**
 * Helper para chamar lovable-payment-notify via proxy Supabase
 * Evita CORS/405 errors
 */
export async function callGasViaProxy(path: string, payload: any) {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/gas-proxy?path=${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  
  const data = await res.json().catch(() => ({} as any));
  return { status: res.status, ok: res.ok, data };
}

export default callGas;
