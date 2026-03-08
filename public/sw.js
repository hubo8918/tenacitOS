const CACHE = "mc-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(request, url) {
  if (request.destination && ["style", "script", "font", "image"].includes(request.destination)) {
    return true;
  }

  if (url.pathname.startsWith("/_next/static/")) return true;

  return /\.(?:js|css|png|jpe?g|gif|webp|svg|ico|woff2?|ttf)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Never cache authenticated APIs or page navigations.
  // This prevents stale login redirects/pages from being served from cache.
  if (
    url.pathname.startsWith("/api/") ||
    request.mode === "navigate" ||
    request.destination === "document"
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (!isStaticAsset(request, url)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);

      // Avoid caching redirects or failed responses.
      if (response.ok && response.status < 300 && response.type !== "opaqueredirect") {
        cache.put(request, response.clone());
      }

      return response;
    })()
  );
});
