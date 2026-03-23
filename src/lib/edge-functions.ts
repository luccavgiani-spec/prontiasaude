import { supabase } from "@/integrations/supabase/client";

/**
 * ✅ URL FIXA do projeto Supabase de produção (ploqujuhpwutpcibedbr)
 * As Edge Functions estão deployadas APENAS neste projeto.
 */
const SUPABASE_URL = "https://ploqujuhpwutpcibedbr.supabase.co";

/**
 * ✅ Chave pública (anon key) do projeto original - hardcoded para segurança
 */
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I";

const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

type InvokeOptions = {
  body?: any;
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PUT" | "DELETE";
};

/**
 * Invoca Edge Function no Supabase de PRODUÇÃO
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  options: InvokeOptions = {},
): Promise<{ data: T | null; error: any }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      ...options.headers,
    };

    // ✅ CORREÇÃO: Se options.headers.Authorization já vier definido, NÃO sobrescrever.
    // Isso permite que chamadas híbridas (Cloud/Produção) enviem o token correto.
    if (!options.headers?.Authorization) {
      headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
    }

    console.log(`[invokeEdgeFunction] target=production function=${functionName} origin=${typeof window !== 'undefined' ? window?.location?.origin : 'server'}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(`${EDGE_FUNCTIONS_URL}/${functionName}`, {
        method: options.method || "POST",
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

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

