/**
 * Wrapper para chamadas ao Google Apps Script via Supabase Edge Function Proxy
 * Inclui Authorization header (anon key) para passar pelo proxy
 */

const GAS_BASE = import.meta.env.VITE_GAS_BASE;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function callGas(path: string, payload?: any) {
  const url = `${GAS_BASE}?path=${encodeURIComponent(path)}`;
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

export default callGas;
