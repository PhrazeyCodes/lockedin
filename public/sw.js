// LockedIn service worker — keeps the app itself on the phone so it opens fast,
// even with bad or no signal (gym basements). Your data still comes from Supabase;
// this only caches the app's own files.
//
//  - /_next/static/* (code, styles — file names change every deploy): cache-first, forever
//  - icons / manifest: cache-first
//  - pages: try the network for up to 1.5s, otherwise use the saved copy
//  - Supabase, /api, and Next's in-app navigation data: never cached
const VERSION = "v1";
const STATIC = `lockedin-static-${VERSION}`;
const PAGES = `lockedin-pages-${VERSION}`;
const SHELL = ["/home", "/plan", "/lift", "/journal", "/social", "/login"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![STATIC, PAGES].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // Supabase, fonts, etc.
  if (url.pathname.startsWith("/api/")) return;
  if (req.headers.get("RSC") || url.searchParams.has("_rsc")) return; // Next navigation data

  // Hashed build files never change — serve from the phone, download once
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|json|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.open(STATIC).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Pages: fresh when the network is quick, saved copy when it isn't
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(PAGES);
      const key = url.pathname;
      const net = fetch(req).then((res) => {
        if (res.ok && !res.redirected) c.put(key, res.clone());
        return res;
      });
      try {
        return await Promise.race([net, timeout(1500)]);
      } catch {
        const hit = await c.match(key);
        if (hit) { net.catch(() => {}); return hit; }
        return net; // nothing saved yet — keep waiting on the network
      }
    })());
  }
});
