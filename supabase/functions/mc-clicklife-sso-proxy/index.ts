// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const MC_HMAC_SECRET = Deno.env.get("MC_HMAC_SECRET") ?? "";
const MC_PROXY_TOKEN = Deno.env.get("MC_PROXY_TOKEN") ?? "";
const SUPABASE_FUNCTIONS_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") ?? 
  "https://ploqujuhpwutpcibedbr.supabase.co/functions/v1";
const TARGET_URL = `${SUPABASE_FUNCTIONS_URL}/clicklife-sso`;

function json(data: any, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function corsHeaders(origin?: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-request-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

async function hmacHex(raw: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  const signatureArray = new Uint8Array(sig);
  return Array.from(signatureArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  const origin = req.headers.get("origin") || "*";
  
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    console.log("[mc-clicklife-sso-proxy] Request received");

    // Validar MC_PROXY_TOKEN
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (!token || token !== MC_PROXY_TOKEN) {
      console.error("[mc-clicklife-sso-proxy] Unauthorized: invalid or missing token");
      return json(
        { ok: false, error: "Unauthorized" }, 
        401, 
        corsHeaders(origin)
      );
    }

    if (!MC_HMAC_SECRET) {
      console.error("[mc-clicklife-sso-proxy] Missing MC_HMAC_SECRET");
      return json(
        { ok: false, error: "Server configuration error" },
        500,
        corsHeaders(origin)
      );
    }

    // Ler corpo cru (não parsear para manter assinatura válida)
    const rawBody = await req.text();
    console.log("[mc-clicklife-sso-proxy] Body received, length:", rawBody.length);

    // Gerar assinatura HMAC-SHA256 em hexadecimal
    const signature = await hmacHex(rawBody, MC_HMAC_SECRET);
    console.log("[mc-clicklife-sso-proxy] HMAC signature generated (hex):", signature.substring(0, 16) + "...");

    // Encaminhar para clicklife-sso com a assinatura correta
    console.log("[mc-clicklife-sso-proxy] Forwarding to:", TARGET_URL);
    
    const response = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-signature": signature, // Header correto que clicklife-sso espera
        "x-proxy-forwarded": "mc-clicklife-sso-proxy",
      },
      body: rawBody,
    });

    const responseText = await response.text();
    console.log("[mc-clicklife-sso-proxy] Response status:", response.status);
    console.log("[mc-clicklife-sso-proxy] Response preview:", responseText.substring(0, 200));

    // Retornar resposta original com CORS
    return new Response(responseText, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin),
      },
    });

  } catch (error) {
    console.error("[mc-clicklife-sso-proxy] Error:", error);
    return json(
      { 
        ok: false, 
        error: error instanceof Error ? error.message : String(error) 
      },
      500,
      corsHeaders(origin)
    );
  }
});
