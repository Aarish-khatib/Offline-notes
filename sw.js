const scope = self.registration.scope;
const cachePrefix = `offline-notes:${scope}:`;
const cacheName = `${cachePrefix}v1`;
const files = ["", "index.html", "styles.css", "src/app.js", "src/model.js", "src/store.js"];
const shell = new Set(files.map(file => new URL(file, scope).href));

self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...shell])));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  url.search = "";
  if (!shell.has(url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(url.href) ?? fetch(event.request);
  })());
});
