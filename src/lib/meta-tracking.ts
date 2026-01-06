// Meta Pixel tracking via GTM Server-Side
import { gtagEvent } from './gtag-events';

const GTM_SERVER_URL = 'https://sgtm.prontiasaude.com.br';
const PIXEL_ID = '1489396668966676';

// Get fallback URL with priority: localStorage > env > default
let currentFallbackUrl = localStorage.getItem('gtm_fallback_url') || 
                         import.meta.env.VITE_GTM_SERVER_URL || 
                         GTM_SERVER_URL;

interface UserData {
  client_ip?: string;
  client_user_agent?: string;
  fbp?: string;
  fbc?: string;
}

interface CustomData {
  currency?: string;
  value?: number;
  order_id?: string;
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
}

interface MetaEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: 'website';
  user_data: UserData;
  custom_data?: CustomData;
}

// Get or create Facebook Click ID (fbp cookie)
function getFbp(): string {
  const fbpCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('_fbp='));
  
  if (fbpCookie) {
    return fbpCookie.split('=')[1];
  }
  
  // Create new fbp if it doesn't exist
  const fbp = `fb.1.${Date.now()}.${Math.random().toString(36).substring(2)}`;
  document.cookie = `_fbp=${fbp}; path=/; max-age=7776000; domain=.prontiasaude.com.br`;
  return fbp;
}

// Get Facebook Click ID from URL (fbc)
function getFbc(): string | undefined {
  const urlParams = new URLSearchParams(window.location.search);
  const fbclid = urlParams.get('fbclid');
  
  if (fbclid) {
    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    document.cookie = `_fbc=${fbc}; path=/; max-age=7776000; domain=.prontiasaude.com.br`;
    return fbc;
  }
  
  // Check existing fbc cookie
  const fbcCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('_fbc='));
  
  return fbcCookie ? fbcCookie.split('=')[1] : undefined;
}

// Generate unique event ID to prevent duplicates
function generateEventId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

// ✅ Send event to Meta CAPI via Edge Function (server-side)
async function sendToMetaCAPI(eventName: string, data: {
  value?: number;
  order_id?: string;
  test_event_code?: string; // ✅ Opcional: para modo teste
}): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: window.location.href,
      value: data.value,
      currency: 'BRL',
      order_id: data.order_id,
      fbp: getFbp(),
      fbc: getFbc(),
      client_user_agent: navigator.userAgent,
    };

    // ✅ Incluir test_event_code apenas se fornecido
    if (data.test_event_code) {
      payload.test_event_code = data.test_event_code;
    }

    const response = await fetch('https://ploqujuhpwutpcibedbr.supabase.co/functions/v1/meta-capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('[Meta CAPI] ✅ Evento enviado:', eventName);
      console.log('[Meta CAPI] 📊 Resposta:', result); // ✅ Mostra fbtrace_id e events_received
    } else {
      console.warn('[Meta CAPI] ⚠️ Resposta não-ok:', result);
    }
  } catch (error) {
    console.error('[Meta CAPI] ❌ Erro ao enviar evento:', error);
  }
}

// ✅ Função de teste QA para validação no Events Manager
export async function sendCAPITest(): Promise<void> {
  console.log('[Meta CAPI] 🧪 Enviando evento de teste com test_event_code: TEST45323');
  await sendToMetaCAPI('CAPI_Test', {
    value: 1,
    order_id: `test_${Date.now()}`,
    test_event_code: 'TEST45323', // ✅ Código fixo da Meta para aparecer em "Eventos de Teste"
  });
  console.log('[Meta CAPI] 🧪 Evento CAPI_Test enviado! Verifique Events Manager → Eventos de Teste');
}

// Send event to GTM Server with fallback
async function sendToGTMServer(event: MetaEvent): Promise<void> {
  try {
    // Flatten event data to URL parameters for GTM Server
    const params = new URLSearchParams();
    
    // Event data
    params.append('event_name', event.event_name);
    params.append('pixel_id', PIXEL_ID);
    params.append('event_time', event.event_time.toString());
    params.append('event_id', event.event_id);
    params.append('event_source_url', event.event_source_url);
    params.append('action_source', event.action_source);
    
    // User data
    if (event.user_data.client_user_agent) {
      params.append('client_user_agent', event.user_data.client_user_agent);
    }
    if (event.user_data.fbp) {
      params.append('fbp', event.user_data.fbp);
    }
    if (event.user_data.fbc) {
      params.append('fbc', event.user_data.fbc);
    }
    
    // Custom data
    if (event.custom_data) {
      if (event.custom_data.currency) {
        params.append('currency', event.custom_data.currency);
      }
      if (event.custom_data.value !== undefined) {
        params.append('value', event.custom_data.value.toString());
      }
      if (event.custom_data.order_id) {
        params.append('order_id', event.custom_data.order_id);
      }
      if (event.custom_data.content_name) {
        params.append('content_name', event.custom_data.content_name);
      }
      if (event.custom_data.content_category) {
        params.append('content_category', event.custom_data.content_category);
      }
      if (event.custom_data.content_ids) {
        params.append('content_ids', JSON.stringify(event.custom_data.content_ids));
      }
      if (event.custom_data.contents) {
        params.append('contents', JSON.stringify(event.custom_data.contents));
      }
    }

    console.log('[Meta Tracking] Sending event:', event.event_name, Object.fromEntries(params));
    console.log('[Meta Tracking] 🎯 Primary URL:', GTM_SERVER_URL);
    console.log('[Meta Tracking] 🔄 Fallback URL:', currentFallbackUrl);

    // Try primary GTM Server URL first
    try {
      await fetch(`${GTM_SERVER_URL}/g/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        mode: 'no-cors'
      });
      console.log('[Meta Tracking] ✅ Event sent successfully via custom domain:', event.event_name);
    } catch (primaryError) {
      console.warn('[Meta Tracking] ⚠️ Custom domain unavailable, trying fallback...', primaryError);
      
      // Fallback to alternative GTM Server URL
      if (currentFallbackUrl !== GTM_SERVER_URL) {
        await fetch(`${currentFallbackUrl}/g/collect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
          mode: 'no-cors'
        });
        console.log('[Meta Tracking] ✅ Event sent successfully via fallback URL:', event.event_name);
      } else {
        throw primaryError;
      }
    }
  } catch (error) {
    console.error('[Meta Tracking] ❌ Error sending event:', error);
  }
}

// Track PageView event
export function trackPageView(): void {
  // Use native fbq if available (for Meta Pixel Helper detection)
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', 'PageView');
  }

  // Also send to GTM Server for redundancy
  const event: MetaEvent = {
    event_name: 'PageView',
    event_time: Math.floor(Date.now() / 1000),
    event_id: generateEventId(),
    event_source_url: window.location.href,
    action_source: 'website',
    user_data: {
      client_user_agent: navigator.userAgent,
      fbp: getFbp(),
      fbc: getFbc(),
    }
  };

  sendToGTMServer(event);
}

// Track ViewContent event
export function trackViewContent(data?: {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  value?: number;
}): void {
  // Use native fbq if available
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', 'ViewContent', data);
  }

  // Also send to GTM Server for redundancy
  const event: MetaEvent = {
    event_name: 'ViewContent',
    event_time: Math.floor(Date.now() / 1000),
    event_id: generateEventId(),
    event_source_url: window.location.href,
    action_source: 'website',
    user_data: {
      client_user_agent: navigator.userAgent,
      fbp: getFbp(),
      fbc: getFbc(),
    },
    custom_data: {
      currency: 'BRL',
      ...data
    }
  };

  sendToGTMServer(event);
}

// Track Lead event
export function trackLead(data?: {
  value?: number;
  content_name?: string;
}): void {
  // Use native fbq if available
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', 'Lead', data);
  }

  // Also send to GTM Server for redundancy
  const event: MetaEvent = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    event_id: generateEventId(),
    event_source_url: window.location.href,
    action_source: 'website',
    user_data: {
      client_user_agent: navigator.userAgent,
      fbp: getFbp(),
      fbc: getFbc(),
    },
    custom_data: {
      currency: 'BRL',
      ...data
    }
  };

  sendToGTMServer(event);
}

// Track InitiateCheckout event
export function trackInitiateCheckout(data?: {
  value?: number;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
}): void {
  // Use native fbq if available
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', 'InitiateCheckout', data);
  }

  // Google Ads Conversion Tracking - Begin Checkout
  gtagEvent('conversion', {
    send_to: 'AW-17744564489/DZTucUlo6lsMbElmioo1C',
    currency: 'BRL',
    ...(data?.value && { value: data.value }),
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('[Google Ads] Início de checkout enviado:', {
      value: data?.value || 'sem valor',
      content_name: data?.content_name,
    });
  }

  // Also send to GTM Server for redundancy
  const event: MetaEvent = {
    event_name: 'InitiateCheckout',
    event_time: Math.floor(Date.now() / 1000),
    event_id: generateEventId(),
    event_source_url: window.location.href,
    action_source: 'website',
    user_data: {
      client_user_agent: navigator.userAgent,
      fbp: getFbp(),
      fbc: getFbc(),
    },
    custom_data: {
      currency: 'BRL',
      ...data
    }
  };

  // ⚠️ sGTM desativado para Meta (ruído de 404)
  // sendToGTMServer(event);

  // ✅ Meta CAPI server-side (única rota Meta)
  sendToMetaCAPI('InitiateCheckout', {
    value: data?.value,
  });
}

// Track SubscribedButtonClick event (custom event for subscription plans)
export function trackSubscribedButtonClick(data?: {
  value?: number;
  content_name?: string;
  content_category?: string;
}): void {
  // Use native fbq if available
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('trackCustom', 'SubscribedButtonClick', data);
  }

  // Also send to GTM Server for redundancy
  const event: MetaEvent = {
    event_name: 'SubscribedButtonClick',
    event_time: Math.floor(Date.now() / 1000),
    event_id: generateEventId(),
    event_source_url: window.location.href,
    action_source: 'website',
    user_data: {
      client_user_agent: navigator.userAgent,
      fbp: getFbp(),
      fbc: getFbc(),
    },
    custom_data: {
      currency: 'BRL',
      ...data
    }
  };

  sendToGTMServer(event);
}

// ✅ DEDUPLICAÇÃO: Verificar se purchase já foi disparado para este transaction_id
function hasAlreadyTrackedPurchase(transactionId: string): boolean {
  if (typeof window === 'undefined') return false;
  const key = `gtag_purchase_tracked_${transactionId}`;
  return localStorage.getItem(key) === 'true';
}

function markPurchaseAsTracked(transactionId: string): void {
  if (typeof window === 'undefined') return;
  const key = `gtag_purchase_tracked_${transactionId}`;
  localStorage.setItem(key, 'true');
}

// Track Purchase event
export function trackPurchase(data: {
  value: number;
  order_id: string;
  email?: string; // ✅ NOVO - Para Enhanced Conversions
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  content_name?: string;
  content_category?: string;
}): void {
  // ✅ DEDUPLICAÇÃO: Verificar se já foi disparado
  if (hasAlreadyTrackedPurchase(data.order_id)) {
    console.log('[trackPurchase] ⚠️ Evento já disparado para transaction_id:', data.order_id);
    return;
  }

  // Use native fbq if available (Meta Pixel)
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', 'Purchase', {
      value: data.value,
      currency: 'BRL',
      contents: data.contents,
      content_name: data.content_name
    });
  }

  // ✅ ENHANCED CONVERSIONS: Configurar dados do usuário ANTES do evento
  if (typeof window !== 'undefined' && (window as any).gtag && data.email) {
    (window as any).gtag("set", "user_data", {
      email: data.email.toLowerCase().trim() // Normalizado conforme padrão Google
    });
    console.log('[Google Ads] 👤 user_data configurado para Enhanced Conversions');
  }

  // ✅ PASSO 1: Popular dataLayer no formato Enhanced Ecommerce GA4
  // Isso preenche as variáveis ecommerce.* que a tag "Purchase Prontia" do GTM precisa
  if (typeof window !== 'undefined') {
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({ ecommerce: null }); // Limpar ecommerce anterior
    (window as any).dataLayer.push({
      event: 'purchase',
      ecommerce: {
        transaction_id: data.order_id,
        value: data.value,
        currency: 'BRL',
        items: data.contents?.map(item => ({
          item_id: item.id,
          item_name: data.content_name || item.id,
          price: item.item_price || data.value,
          quantity: item.quantity
        })) || []
      }
    });
    console.log('[GTM dataLayer] ✅ Enhanced Ecommerce purchase enviado:', {
      transaction_id: data.order_id,
      value: data.value,
      currency: 'BRL'
    });
  }

  // ✅ PASSO 2: Eventos gtag() para envio direto (redundância)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    // 2a. Evento purchase para GA4
    (window as any).gtag("event", "purchase", {
      transaction_id: data.order_id,
      value: data.value,
      currency: "BRL",
      items: data.contents?.map(item => ({
        item_id: item.id,
        item_name: data.content_name || item.id,
        price: item.item_price || data.value,
        quantity: item.quantity
      })) || []
    });
    console.log('[Google Ads] ✅ Evento purchase enviado:', {
      transaction_id: data.order_id,
      value: data.value,
      currency: 'BRL'
    });

    // 2b. ✅ Conversão Google Ads "Consulta Realizada"
    (window as any).gtag("event", "conversion", {
      send_to: 'AW-17744564489/-L0OCPGgnMMbEImioo1C',
      value: data.value,
      currency: 'BRL',
      transaction_id: data.order_id
    });
    console.log('[Google Ads] ✅ Conversão "Consulta Realizada" enviada:', {
      send_to: 'AW-17744564489/-L0OCPGgnMMbEImioo1C',
      transaction_id: data.order_id,
      value: data.value
    });
  }

  // ✅ MARCAR COMO DISPARADO (evitar duplicatas)
  markPurchaseAsTracked(data.order_id);

  // Also send to GTM Server for redundancy (Meta CAPI)
  const event: MetaEvent = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: generateEventId(),
    event_source_url: window.location.href,
    action_source: 'website',
    user_data: {
      client_user_agent: navigator.userAgent,
      fbp: getFbp(),
      fbc: getFbc(),
    },
    custom_data: {
      currency: 'BRL',
      ...data
    }
  };

  // ⚠️ sGTM desativado para Meta (ruído de 404)
  // sendToGTMServer(event);

  // ✅ Meta CAPI server-side (única rota Meta)
  sendToMetaCAPI('Purchase', {
    value: data.value,
    order_id: data.order_id,
  });
}

// Initialize tracking on page load (lazy loaded)
export function initMetaTracking(): void {
  if (typeof window === 'undefined') return;

  // ✅ Inicializar apenas após idle ou timeout
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      initializeTracking();
    }, { timeout: 2000 });
  } else {
    setTimeout(initializeTracking, 2000);
  }
}

function initializeTracking() {
  // Inicializar Facebook Pixel tardiamente
  if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
    (window as any).fbq('init', '1489396668966676');
    trackPageView();
  }

  // Track subsequent page views on navigation
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      trackPageView();
    }
  });
  
  const titleElement = document.querySelector('title');
  if (titleElement) {
    observer.observe(titleElement, {
      childList: true,
      subtree: true,
    });
  }
}

// Debug helper: Set fallback URL at runtime
function setGtmFallbackUrl(url: string): void {
  if (url) {
    localStorage.setItem('gtm_fallback_url', url);
    currentFallbackUrl = url;
    console.log('[Meta Tracking] 🔧 Fallback URL updated to:', url);
    console.log('[Meta Tracking] 💡 Changes will take effect immediately.');
  } else {
    localStorage.removeItem('gtm_fallback_url');
    currentFallbackUrl = import.meta.env.VITE_GTM_SERVER_URL || GTM_SERVER_URL;
    console.log('[Meta Tracking] 🔧 Fallback URL cleared, using default:', currentFallbackUrl);
  }
}

// Expose tracking functions globally for testing
if (typeof window !== 'undefined') {
  (window as any).trackPageView = trackPageView;
  (window as any).trackViewContent = trackViewContent;
  (window as any).trackLead = trackLead;
  (window as any).trackInitiateCheckout = trackInitiateCheckout;
  (window as any).trackSubscribedButtonClick = trackSubscribedButtonClick;
  (window as any).trackPurchase = trackPurchase;
  (window as any).__setGtmFallbackUrl = setGtmFallbackUrl;
  (window as any).sendCAPITest = sendCAPITest; // ✅ QA: Teste Meta CAPI
  
  // Log debug instructions on load
  console.log('[Meta Tracking] 🛠️ Debug mode available:');
  console.log('  • Set fallback: window.__setGtmFallbackUrl("https://your-url.appspot.com")');
  console.log('  • Clear fallback: window.__setGtmFallbackUrl("")');
  console.log('  • Current fallback:', currentFallbackUrl);
  console.log('  • 🧪 Teste Meta CAPI: window.sendCAPITest()');
}
