// Service Worker - Prontia Saúde v1.0
// APENAS para cache offline de assets estáticos
// NÃO intercepta: API calls, checkout, webhooks

const CACHE_NAME = 'prontia-static-v1';
const CACHE_VERSION = '1.0.0';

// Assets críticos para cache offline
const CRITICAL_ASSETS = [
  '/',
  '/assets/hero-doctor-optimized-512.webp',
  '/assets/hero-doctor-optimized-768.webp',
  '/assets/prontia-logo-branca-200.avif',
  '/fonts/poppins-600.woff2',
  '/fonts/nunito-400.woff2',
];

// Install - cache assets críticos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching critical assets');
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate - limpar caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - estratégia: Network First para HTML, Cache First para assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // NUNCA interceptar:
  // 1. Supabase APIs
  // 2. Mercado Pago
  // 3. Edge Functions
  // 4. External APIs
  if (
    url.pathname.includes('/functions/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('mercadopago') ||
    url.hostname.includes('manychat') ||
    url.hostname.includes('clicklife') ||
    url.hostname.includes('communicare') ||
    request.method !== 'GET'
  ) {
    return; // Deixar passar direto para a rede
  }

  // HTML: Network First (sempre buscar versão mais recente)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache da resposta para offline
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request)) // Fallback para cache se offline
    );
    return;
  }

  // Assets estáticos: Cache First (imagens, fontes, JS, CSS)
  if (
    request.url.match(/\.(js|css|png|jpg|jpeg|webp|avif|woff2|woff|svg)$/)
  ) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then(response => {
            // Cache para futuras requisições
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
            return response;
          });
        })
    );
    return;
  }
});

// Mensagens do cliente (para debug)
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
