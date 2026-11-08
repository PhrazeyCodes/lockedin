// LockedIn service worker — keeps the app itself on the phone so it opens with bad or no
// signal. Your data still comes from Supabase; this only caches the app's own files.
//
// v2 fix: a saved page is only ever used together with the exact code files it needs.
// (v1 could serve a saved page from an older update whose code files were already gone
// from the server — the app then sat on the loading screen.)
//
//  - /_next/static/* (code, file names change every update): cache-first
//  - pages: network first; the saved copy only when the network fails or is very slow,
//    and every saved page has its code files saved alongside it
//  - Supabase, /api, and Next's in-app navigation data: never cached
const VERSION = "v2";
const STATIC = `lockedin-static-${VERSION}`;
const PAGES = `lockedin-pages-${VERSION}`;
const SHELL = ["/home", "/plan", "/lift", "/journal", "/social", "/login"];

// Save a page AND every code/style file it references, so it can always run from the cache
async function savePage(path, res) {
  const html = await res.clone().text();
  const assets = [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s)]+\.(?:js|css)/g)].map((m) => m[0]))];
  const st = await caches.open(STATIC);
  await Promise.all(assets.map(async (a) => {
    if (await st.match(a)) return;
    const r = await fetch(a);
    if (!r.ok) throw new Error("asset missing " + a);
    await st.put(a, r);
  }));
  // only store the page once all of its files are safely saved
  await (await caches.open(PAGES)).put(path, res);
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    await Promise.all(SHELL.map(async (p) => {
      try { const r = await fetch(p, { cache: "no-store" }); if (r.ok && !r.redirected) await savePage(p, r); } catch {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    let hadOld = false;
    for (const k of await caches.keys()) if (![STATIC, PAGES].includes(k)) { hadOld = true; await caches.delete(k); }
    await self.clients.claim();
    // Phones stuck on a broken saved page from v1: reload them onto the fresh version
    if (hadOld) for (const c of await self.clients.matchAll({ type: "window" })) c.navigate(c.url).catch(() => {});
  })());
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // Supabase, fonts, etc.
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  if (req.headers.get("RSC") || url.searchParams.has("_rsc")) return; // Next navigation data

  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname) || url.pathname === "/manifest.json") {
    e.respondWith((async () => {
      const c = await caches.open(STATIC);
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
    return;
  }

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const key = url.pathname;
      const net = fetch(req).then((res) => {
        if (res.ok && !res.redirected) e.waitUntil(savePage(key, res.clone()).catch(() => {}));
        return res;
      });
      try {
        // Normal signal: always the live version. Only a dead/very slow connection uses the saved copy.
        return await Promise.race([net, timeout(4000)]);
      } catch {
        const hit = await (await caches.open(PAGES)).match(key);
        if (hit) { net.catch(() => {}); return hit; }
        return net;
      }
    })());
  }
});
