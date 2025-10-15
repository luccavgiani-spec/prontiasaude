import { GAS_BASE } from './constants';
import type { DirectSchedulePayload, DirectScheduleResponse } from './types/plan';

/**
 * Agenda diretamente com plano ativo (bypass de pagamento)
 * Backend força ClickLife quando plano_ativo=true
 */
export async function scheduleWithActivePlan(
  payload: DirectSchedulePayload
): Promise<DirectScheduleResponse> {
  try {
    const endpoint = `${GAS_BASE}?path=site-schedule`;
    
    console.log('[Schedule] Direct scheduling with active plan:', payload.sku);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
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
