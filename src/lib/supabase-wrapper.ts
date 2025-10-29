import { supabase } from '@/integrations/supabase/client';

/**
 * Wrapper silencioso para supabase.functions.invoke()
 * Intercepta erros não críticos e evita toasts desnecessários
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  options?: {
    body?: any;
    headers?: Record<string, string>;
  }
): Promise<{ data: T | null; error: any }> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, options);

    if (error) {
      // Log silencioso no console para debug
      console.warn(`[Edge Function] ${functionName} returned error:`, error);
      
      // Não exibe toast para erros genéricos
      // Apenas retorna o erro para o código chamador decidir o que fazer
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    // Log de exceções no console
    console.error(`[Edge Function] ${functionName} exception:`, error);
    
    // Retorna erro sem exibir toast
    return { data: null, error };
  }
}
