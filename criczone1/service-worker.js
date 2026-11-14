"use strict";

/* CRICZONE1 shell cache only. Live JSON feeds, player URLs and media are never cached. */
const CACHE_NAME = "criczone1-shell-v2";
const SCOPE_URL = self.registration.scope;
const SHELL_URLS = [
  new URL("./", SCOPE_URL).href,
  new URL("./manifest.json", SCOPE_URL).href,
  new URL("../assets/js/cz-global-community.js", SCOPE_URL).href,
  new URL("../photos/photo_2026-10-28_14-52-23.jpg", SCOPE_URL).href
];
const APP_URL = new URL("./", SCOPE_URL);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(SHELL_URLS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      } catch (_) {
        /* A failed optional asset must not block the app's service-worker install. */
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("criczone1-shell-") && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const shellUrl = SHELL_URLS.find((item) => new URL(item).pathname === url.pathname);
  if (!shellUrl) return; // Never intercept JSON feeds, streams, iframe/player or media requests.

  if (request.mode === "navigate" && url.pathname === APP_URL.pathname) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(SHELL_URLS[0], response.clone());
        return response;
      } catch (_) {
        return (await cache.match(SHELL_URLS[0])) ||
          new Response("CRICZONE is offline. Connect to the internet and reload.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(shellUrl);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(shellUrl, response.clone());
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
