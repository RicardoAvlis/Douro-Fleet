// Service Worker — Douro Fleet PWA
const CACHE = 'douro-fleet-v1';

// Recursos estáticos a fazer cache (shell da app)
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css',
  'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js',
];

// Instalar — pré-cache do shell
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(SHELL).catch(e => {
        // Se algum recurso externo falhar, continua na mesma
        console.warn('SW cache parcial:', e);
      });
    })
  );
  self.skipWaiting();
});

// Activar — limpar caches antigas
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — Network First para dados em tempo real, Cache First para assets estáticos
self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);

  // Dados em tempo real (Workers, AISStream, Mapbox tiles) — sempre network
  const realtimeDomains = [
    'raspy-union-da12.ricardo-silva-43d.workers.dev',
    'small-hall-03b3.ricardo-silva-43d.workers.dev',
    'stream.aisstream.io',
    'events.mapbox.com',
    'api.mapbox.com/styles',
    'api.mapbox.com/v4',
  ];
  if (realtimeDomains.some(d => url.href.includes(d))) {
    evt.respondWith(fetch(evt.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Shell da app — Cache First (funciona offline)
  evt.respondWith(
    caches.match(evt.request).then(cached => {
      if (cached) return cached;
      return fetch(evt.request).then(response => {
        // Cache dinâmico dos assets Mapbox GL JS
        if (url.hostname.includes('mapbox.com') && response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(evt.request, clone));
        }
        return response;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});
