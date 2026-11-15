/* Offline support: cache the app files, refresh them in the background. */
const CACHE = 'visa-helper-v3';
const ASSETS = ['./', 'index.html', 'style.css', 'schema.js', 'xlsx-fill.js', 'xlsx-write.js', 'app.js',
  'jszip.min.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/mapping\.json$/.test(url.pathname)) {   // preset cell map: network first
    e.respondWith(fetch(req).then(function (r) {
      const copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return r;
    }).catch(function () { return caches.match(req); }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    const net = fetch(req).then(function (r) {
      if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return r;
    }).catch(function () { return hit || caches.match('index.html'); });
    return hit || net;
  }));
});
