/**
 * Web Vitals tracking para monitoramento de performance
 * Envia métricas para Facebook Pixel e console
 */

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

function sendToAnalytics(metric: WebVitalMetric) {
  // Log no console para debugging
  console.log(`[Web Vital] ${metric.name}:`, {
    value: Math.round(metric.value),
    rating: metric.rating,
  });

  // Enviar para Facebook Pixel se disponível
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('trackCustom', 'WebVital', {
      name: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating,
    });
  }
}

export function initWebVitals() {
  if (typeof window === 'undefined') return;

  // Carregar web-vitals dinamicamente para não aumentar bundle inicial
  import('web-vitals').then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
    onCLS(sendToAnalytics);
    onFCP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
    onINP(sendToAnalytics);
  }).catch((error) => {
    console.warn('Failed to load web-vitals:', error);
  });
}
