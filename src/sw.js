// Service worker: keeps a copy of the site on the device so it works offline.
// Pages: network first (so updates show up), falling back to the saved copy.
// Assets: saved copy first (their URLs change with every build, so they never go stale).
// Requests to other sites (the breach-check API) are never touched or stored.
const VERSION = '__BUILD__';
const CACHE = `mpc-${VERSION}`;
const PAGES = __PAGES__;
const ASSETS = __ASSETS__;

async function put(cache, url, res) {
  // Store a clean copy (a redirected response can't be used to answer a navigation).
  const body = res.redirected ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers }) : res;
  await cache.put(url, body);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all([...PAGES, ...ASSETS].map(async (url) => {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) await put(cache, url, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('mpc-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // e.g. api.pwnedpasswords.com: straight to network

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const path = url.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
      try {
        const res = await fetch(req);
        if (res.ok && PAGES.includes(path)) await put(cache, path, res.clone());
        return res;
      } catch {
        return (await cache.match(path)) || (await cache.match('/'));
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/') || ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(url.pathname);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) await put(cache, url.pathname, res.clone());
      return res;
    })());
  }
});
