// Meta Pixel tracking via GTM Server-Side
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

// Track Purchase event
export function trackPurchase(data: {
  value: number;
  order_id: string;
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  content_name?: string;
}): void {
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

  sendToGTMServer(event);
}

// Initialize tracking on page load
export function initMetaTracking(): void {
  // Track initial page view
  trackPageView();
  
  // Track subsequent page views on navigation
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      trackPageView();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
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
  (window as any).trackPurchase = trackPurchase;
  (window as any).__setGtmFallbackUrl = setGtmFallbackUrl;
  
  // Log debug instructions on load
  console.log('[Meta Tracking] 🛠️ Debug mode available:');
  console.log('  • Set fallback: window.__setGtmFallbackUrl("https://your-url.appspot.com")');
  console.log('  • Clear fallback: window.__setGtmFallbackUrl("")');
  console.log('  • Current fallback:', currentFallbackUrl);
}
