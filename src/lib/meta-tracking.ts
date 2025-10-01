// Meta Pixel tracking via GTM Server-Side
const GTM_SERVER_URL = 'https://sgtm.prontiasaude.com.br';
const PIXEL_ID = '1489396668966676';

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

// Send event to GTM Server
async function sendToGTMServer(event: MetaEvent): Promise<void> {
  try {
    const payload = {
      pixel_id: PIXEL_ID,
      data: [event]
    };

    console.log('[Meta Tracking] Sending event:', event.event_name, payload);

    const response = await fetch(`${GTM_SERVER_URL}/mp/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      mode: 'no-cors' // GTM Server handles CORS
    });

    console.log('[Meta Tracking] Event sent successfully:', event.event_name);
  } catch (error) {
    console.error('[Meta Tracking] Error sending event:', error);
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
