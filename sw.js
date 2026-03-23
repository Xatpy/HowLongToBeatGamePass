const CACHE_NAME = "beatable-cache-v20260322";
const APP_ASSETS = [
  "/",
  "/index.html",
  "/js/app.js",
  "/css/normalize.css",
  "/css/skeleton.css",
  "/css/styles.css",
  "/data/list.csv",
  "/data/metadata.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || caches.match("/index.html"))
    )
  );
});
