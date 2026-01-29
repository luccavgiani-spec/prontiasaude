import { supabase } from "@/integrations/supabase/client";

/**
 * ✅ URL FIXA do projeto Supabase original (ploqujuhpwutpcibedbr)
 * IMPORTANTE: NÃO usar VITE_SUPABASE_URL pois pode apontar para projeto errado (Lovable Cloud)
 * As Edge Functions estão deployadas APENAS neste projeto.
 */
const SUPABASE_URL = "https://ploqujuhpwutpcibedbr.supabase.co";

/**
 * ✅ URL do Lovable Cloud para funções deployadas automaticamente
 */
const CLOUD_URL = "https://yrsjluhhnhxogdgnbnya.supabase.co";

/**
 * ✅ Chave pública (anon key) do projeto original - hardcoded para segurança
 */
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I";

/**
 * ✅ Chave pública (anon key) do Lovable Cloud
 */
const CLOUD_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyc2psdWhobmh4b2dkZ25ibnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjY1NzUsImV4cCI6MjA4MzgwMjU3NX0.fdF2KZage73BDDM0Shs7cMRLnJdFPUef866R5vZBmnY";

const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const CLOUD_FUNCTIONS_URL = `${CLOUD_URL}/functions/v1`;

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

    // Se tem usuário logado, usa o access_token; se não, usa a anon key.
    headers["Authorization"] = `Bearer ${accessToken || SUPABASE_ANON_KEY}`;

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

/**
 * Invoca Edge Function no LOVABLE CLOUD
 * Usado para funções que precisam acessar ambos os ambientes (Cloud + Produção)
 */
export async function invokeCloudEdgeFunction<T = any>(
  functionName: string,
  options: InvokeOptions = {},
): Promise<{ data: T | null; error: any }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: CLOUD_ANON_KEY,
      ...options.headers,
    };

    // Se tem usuário logado, usa o access_token; se não, usa a anon key.
    headers["Authorization"] = `Bearer ${accessToken || CLOUD_ANON_KEY}`;

    const response = await fetch(`${CLOUD_FUNCTIONS_URL}/${functionName}`, {
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
