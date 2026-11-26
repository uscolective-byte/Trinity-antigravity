/**
 * Static PWA manifest, public-asset-only Service Worker, and authentic
 * 4-vertex Tetrakis tetrahedron vector emblem for Auru-Dev-Worker.
 */

export const MANIFEST_JSON = JSON.stringify(
  {
    name: 'Auru Dev · Trinity Atelier',
    short_name: 'Auru Dev',
    description: 'Standalone Obsidian & Champagne Atelier workspace for auru.dev.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    lang: 'sk',
    scope: '/',
    id: '/'
  },
  null,
  2
);

export const SW_JS = `// Cache only static public shell assets for auru.dev. Never cache API data or credentials.
const CACHE_NAME = 'auru-dev-atelier-v1';
const STATIC_ASSETS = new Set(['/atelier.css', '/app.js', '/manifest.json', '/tetrakis-emblem.svg']);

const offlineResponse = () =>
  new Response(
    '<!doctype html><html lang="sk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Auru Dev bez pripojenia</title><body style="background:#09090b;color:#f4f3ef;font:15px Inter,-apple-system,sans-serif;padding:36px;max-width:520px;margin:0 auto"><h1 style="font-weight:600;letter-spacing:-0.02em">Auru Dev je bez pripojenia</h1><p style="color:#a8a69f;line-height:1.6">Pripoj zariadenie k internetu a obnov stránku. Žiadna požiadavka nebola odoslaná.</p></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled([...STATIC_ASSETS].map((p) => fetch(p).then((r) => (r.ok ? cache.put(p, r) : null))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('auru-dev-atelier-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(offlineResponse));
    return;
  }
  if (!STATIC_ASSETS.has(url.pathname)) return;
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      fetch(req)
        .then((res) => {
          if (res.ok) cache.put(url.pathname, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => cache.match(url.pathname).then((hit) => hit || new Response('Offline', { status: 503 })))
    )
  );
});
`;

export const TETRAKIS_EMBLEM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 96" fill="none">
  <rect width="160" height="96" rx="14" fill="#0d0d11"/>
  <rect x="0.75" y="0.75" width="158.5" height="94.5" rx="13.25" stroke="#d6b676" stroke-opacity="0.34" stroke-width="1.5"/>
  <g stroke="#d6b676" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="80,14 44,74 116,74" fill="#d6b676" fill-opacity="0.08"/>
    <line x1="80" y1="14" x2="80" y2="74"/>
    <line x1="80" y1="50" x2="44" y2="74"/>
    <line x1="80" y1="50" x2="116" y2="74"/>
  </g>
  <circle cx="80" cy="50" r="3" fill="#ead099"/>
</svg>`;
