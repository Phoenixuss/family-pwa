// cache names are versioned so you can bust old caches by bumping this
const CACHE_NAME = 'family-pwa-v2';

// IMPORTANT for GitHub Pages subpaths: build a base path automatically
// e.g., https://phoenixuss.github.io/family-pwa/  -> base '/family-pwa/'
const BASE = (() => {
  const url = new URL(self.location);
  // sw.js sits at <base>/sw.js
  return url.pathname.replace(/sw\.js$/, '');
})();

// minimal assets to pre-cache; keep paths relative to BASE
const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'app.js',
  BASE + 'script.js',
  BASE + 'manifest.json'
];

// install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// activate: clean older caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

// fetch: cache-first, network fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
