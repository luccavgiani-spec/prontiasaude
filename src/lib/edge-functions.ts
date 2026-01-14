import { supabase } from "@/integrations/supabase/client";

/**
 * URL base das Edge Functions no Lovable Cloud
 * As edge functions permanecem no Lovable Cloud, mas acessam o banco Supabase antigo via secrets
 */
const EDGE_FUNCTIONS_URL = "https://ploqujuhpwutpcibedbr.supabase.co/functions/v1";
const LOVABLE_CLOUD_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyc2psdWhobmh4b2dkZ25ibnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjY1NzUsImV4cCI6MjA4MzgwMjU3NX0.fdF2KZage73BDDM0Shs7cMRLnJdFPUef866R5vZBmnY";

/**
 * Invoca uma Edge Function do Lovable Cloud
 * Usa o token de auth do usuário logado no Supabase antigo
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  options?: {
    body?: any;
    headers?: Record<string, string>;
    method?: "GET" | "POST" | "PUT" | "DELETE";
  },
): Promise<{ data: T | null; error: any }> {
  try {
    // Obter sessão do usuário do Supabase antigo
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: LOVABLE_CLOUD_ANON_KEY,
      ...options?.headers,
    };

    // Se o usuário está logado, incluir token de auth
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    } else {
      // Usar anon key se não há sessão
      headers["Authorization"] = `Bearer ${LOVABLE_CLOUD_ANON_KEY}`;
    }

    const response = await fetch(`${EDGE_FUNCTIONS_URL}/${functionName}`, {
      method: options?.method || "POST",
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Edge Function] ${functionName} HTTP error:`, response.status, errorText);
      return {
        data: null,
        error: { message: errorText, status: response.status },
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error(`[Edge Function] ${functionName} exception:`, error);
    return {
      data: null,
      error: error instanceof Error ? error : { message: "Unknown error" },
    };
  }
}

/**
 * Wrapper silencioso para edge functions (sem toasts de erro)
 */
export async function invokeEdgeFunctionSilent<T = any>(
  functionName: string,
  options?: {
    body?: any;
    headers?: Record<string, string>;
  },
): Promise<{ data: T | null; error: any }> {
  const result = await invokeEdgeFunction<T>(functionName, options);

  if (result.error) {
    console.warn(`[Edge Function Silent] ${functionName} returned error:`, result.error);
  }

  return result;
}
