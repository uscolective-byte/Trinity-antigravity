// Trinity Sovereign PWA Service Worker
const CACHE_NAME = 'trinity-sw-v1';
const STATIC_ASSETS = ['/', '/chat.js', '/chat.css', '/garage.css', '/manifest.json'];

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Do not intercept API or websocket requests
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
