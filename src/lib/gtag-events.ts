/**
 * Google Analytics 4 & Google Ads Event Tracking Helper
 * 
 * Este módulo fornece uma interface TypeScript-safe para enviar eventos
 * para o Google Analytics 4 (GA4) e Google Ads via gtag.js.
 * 
 * IDs configurados:
 * - GA4: G-NC10XED57R
 * - Google Ads: AW-17744564489
 * 
 * @example
 * import { gtagEvent } from '@/lib/gtag-events';
 * 
 * gtagEvent('conversion', {
 *   send_to: 'AW-17744564489/AbC123',
 *   value: 49.90,
 *   currency: 'BRL'
 * });
 */

// Tipagem global para window.gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    gtagEvent?: (eventName: string, params?: Record<string, any>) => void;
    dataLayer?: any[];
  }
}

/**
 * Envia um evento para o Google Analytics 4 e Google Ads
 * 
 * @param eventName - Nome do evento (ex: 'conversion', 'purchase', 'page_view')
 * @param params - Parâmetros do evento (opcional)
 * 
 * @example
 * // Evento de conversão
 * gtagEvent('conversion', {
 *   send_to: 'AW-17744564489/conversion_label',
 *   value: 100.00,
 *   currency: 'BRL'
 * });
 * 
 * @example
 * // Evento personalizado
 * gtagEvent('consulta_agendada', {
 *   servico: 'Consulta Clínica',
 *   valor: 15.90
 * });
 */
export function gtagEvent(eventName: string, params: Record<string, any> = {}): void {
  // Guard: ambiente servidor
  if (typeof window === 'undefined') {
    return;
  }

  // Guard: gtag não carregado
  if (typeof window.gtag !== 'function') {
    console.warn('[gtag-events] gtag não está disponível. Evento ignorado:', eventName);
    return;
  }

  // Enviar evento
  try {
    window.gtag('event', eventName, params);
    console.log('[gtag-events] Evento enviado:', eventName, params);
  } catch (error) {
    console.error('[gtag-events] Erro ao enviar evento:', error);
  }
}

/**
 * Rastreia uma conversão do Google Ads
 * 
 * @param conversionLabel - Label da conversão configurada no Google Ads
 * @param value - Valor da conversão em reais (opcional)
 * @param transactionId - ID único da transação (opcional, para evitar duplicatas)
 * 
 * @example
 * gtagConversion('AbC123DeF456', 49.90, 'order_123456789');
 */
export function gtagConversion(
  conversionLabel: string,
  value?: number,
  transactionId?: string
): void {
  const params: Record<string, any> = {
    send_to: `AW-17744564489/${conversionLabel}`,
  };

  if (value !== undefined) {
    params.value = value;
    params.currency = 'BRL';
  }

  if (transactionId) {
    params.transaction_id = transactionId;
  }

  gtagEvent('conversion', params);
}

/**
 * Rastreia uma visualização de página (page_view)
 * Útil para SPAs com rotas dinâmicas
 * 
 * @param pageTitle - Título da página (opcional)
 * @param pagePath - Caminho da página (opcional)
 * 
 * @example
 * gtagPageView('Consulta Clínica', '/servicos/consulta');
 */
export function gtagPageView(pageTitle?: string, pagePath?: string): void {
  const params: Record<string, any> = {};

  if (pageTitle) params.page_title = pageTitle;
  if (pagePath) params.page_path = pagePath;

  gtagEvent('page_view', params);
}

// Expor gtagEvent globalmente para uso em scripts inline (se necessário)
if (typeof window !== 'undefined') {
  window.gtagEvent = gtagEvent;
}
