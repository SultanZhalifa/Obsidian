/*
 * OBSIDIAN service worker.
 *
 * Scope is deliberately narrow: it provides an installable app shell and an
 * offline fallback, but it NEVER caches market data, API responses, auth, or
 * WebSocket traffic — those must always be live and real. Only same-origin GET
 * navigations and static assets are handled; everything else passes straight
 * through to the network.
 */
const VERSION = "obsidian-v1";
const SHELL_CACHE = `${VERSION}-shell`;

const OFFLINE_URL = "/offline";

// Pre-cache the minimal shell needed to render the offline page + icons.
const SHELL_ASSETS = ["/offline", "/icons/icon-192.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("obsidian-") && !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function shouldBypass(url) {
  // Never intercept anything dynamic, authenticated, or live.
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/register") ||
    url.protocol === "ws:" ||
    url.protocol === "wss:"
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (shouldBypass(url)) return;

  // App navigations: network-first, fall back to the cached offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r ?? Response.error()),
      ),
    );
    return;
  }

  // Static build assets (immutable): cache-first for speed.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  }
});
