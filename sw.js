const CACHE_NAME = "beatable-cache-v20260324e";
const APP_BASE_PATH = new URL("./", self.location.href).pathname;
const INDEX_FALLBACK = `${APP_BASE_PATH}index.html`;

function scopedPath(relativePath) {
  return new URL(relativePath, self.location.href).pathname;
}

const APP_ASSETS = [
  APP_BASE_PATH,
  INDEX_FALLBACK,
  scopedPath("js/app.js"),
  scopedPath("css/normalize.css"),
  scopedPath("css/styles.css"),
  scopedPath("data/catalog-manifest.json"),
  scopedPath("data/catalog.json"),
  scopedPath("data/list.csv"),
  scopedPath("data/metadata.json"),
  scopedPath("icons/icon-32.png"),
  scopedPath("icons/icon-64.png"),
  scopedPath("icons/icon-128.png"),
  scopedPath("icons/icon-192.png"),
  scopedPath("icons/icon-512.png")
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

function isStaticAsset(url) {
  return /\.(css|js|woff2?|ttf|eot|png|svg|ico|webp|jpg|jpeg|gif)(\?|$)/i.test(url.pathname);
}

function isDataFile(url) {
  return (
    url.pathname.endsWith("/catalog-manifest.json") ||
    url.pathname.endsWith("/catalog.json") ||
    url.pathname.includes("/data/catalogs/") ||
    url.pathname.endsWith("/list.csv") ||
    url.pathname.endsWith("/metadata.json")
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Data files: network-first, fall back to cache
  if (isDataFile(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match(INDEX_FALLBACK))
        )
    );
    return;
  }

  // Everything else: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match(INDEX_FALLBACK))
      )
  );
});
