import { supabase } from "@/integrations/supabase/client";

/**
 * Base URL das Edge Functions do MESMO projeto do Supabase do site
 * (vem do VITE_SUPABASE_URL do build)
 */
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;

// Use anon_key (legado) OU publishable_key (sb_publishable_...) se existir.
// Prioridade: publishable > anon (porque alguns projetos podem bloquear legacy).
const SUPABASE_PUBLIC_KEY =
  ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined);

if (!SUPABASE_URL) {
  throw new Error("VITE_SUPABASE_URL não definido no ambiente.");
}
if (!SUPABASE_PUBLIC_KEY) {
  throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY ou VITE_SUPABASE_ANON_KEY não definido no ambiente.");
}

const EDGE_FUNCTIONS_URL = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;

type InvokeOptions = {
  body?: any;
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PUT" | "DELETE";
};

export async function invokeEdgeFunction<T = any>(
  functionName: string,
  options: InvokeOptions = {},
): Promise<{ data: T | null; error: any }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLIC_KEY,
      ...options.headers,
    };

    // Se tem usuário logado, usa o access_token; se não, usa a public key.
    headers["Authorization"] = `Bearer ${accessToken || SUPABASE_PUBLIC_KEY}`;

    const response = await fetch(`${EDGE_FUNCTIONS_URL}/${functionName}`, {
      method: options.method || "POST",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // resposta não-json
    }

    if (!response.ok) {
      return {
        data: null,
        error: {
          status: response.status,
          message: json?.error || json?.message || text || "Erro ao invocar edge function",
        },
      };
    }

    return { data: (json ?? null) as T, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}
