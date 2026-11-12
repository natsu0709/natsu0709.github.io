// オフラインでもハブが開けるようにするService Worker
const CACHE = "natsu-hub-v4";
const FILES = ["./", "./index.html", "./banjo.jpg", "./bon.jpg", "./shinratsu.jpg", "./mymon.jpg", "./godmemo.jpg", "./manifest.json", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// まずネットから最新を取りに行き、ダメならキャッシュ（作品追加がすぐ反映される）
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
    }).catch(() => caches.match(e.request))
  );
});
