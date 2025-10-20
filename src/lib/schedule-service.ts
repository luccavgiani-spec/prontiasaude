import { supabase } from '@/integrations/supabase/client';
import type { DirectSchedulePayload, DirectScheduleResponse } from './types/plan';

/**
 * Agenda diretamente com plano ativo (bypass de pagamento)
 * Roteamento inteligente: ClickLife ou Communicare baseado em regras
 */
export async function scheduleWithActivePlan(
  payload: DirectSchedulePayload
): Promise<DirectScheduleResponse> {
  try {
    console.log('[Schedule] Direct scheduling with active plan:', payload.sku);
    
    const { data, error } = await supabase.functions.invoke('schedule-redirect', {
      body: payload,
    });

    if (error) {
      console.error('[Schedule] Supabase function error:', error);
      throw error;
    }

    console.log('[Schedule] Response:', data);
    
    return {
      ok: data.ok !== false,
      url: data.url,
      provider: data.provider,
      error: data.error,
    };
  } catch (error) {
    console.error('[Schedule] Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Erro ao agendar',
    };
  }
}
