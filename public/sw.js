// Minimal Service Worker for CastSync PWA
const CACHE_NAME = 'castsync-cache-v2';
const PRECACHE_ASSETS = ['/', '/index.html', '/icon.svg', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only provide an offline HTML fallback for same-origin page navigation.
  // Never return HTML for API, media, JavaScript, or Socket.IO requests.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      event.request.mode !== 'navigate' || url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/socket.io/')) return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      return (await caches.match('/')) || Response.error();
    })
  );
});
