importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log(`Workbox is loaded`);

  // Pre-cache core local resources on install
  workbox.precaching.precacheAndRoute([
    { url: 'index.html', revision: '1.0.1' },
    { url: 'offline.html', revision: '1.0.1' },
    { url: 'manifest.json', revision: '1.0.1' },
    { url: 'dataset_taoista.js', revision: '1.0.1' },
    { url: 'favicon.ico', revision: '1.0.1' },
    { url: 'assets/sekaiwo/SekaiwoRegular.ttf', revision: '1.0.1' },
    { url: 'assets/icons/icon-192.png', revision: '1.0.1' },
    { url: 'assets/icons/icon-512.png', revision: '1.0.1' }
  ]);

  // Cache CDN assets (Shoelace, jsPDF, Resvg, Web Fonts) with CacheFirst strategy
  workbox.routing.registerRoute(
    ({url}) => url.origin === 'https://cdn.jsdelivr.net' ||
               url.origin === 'https://cdnjs.cloudflare.com' ||
               url.origin === 'https://fonts.googleapis.com' ||
               url.origin === 'https://fonts.gstatic.com',
    new workbox.strategies.CacheFirst({
      cacheName: 'cdn-assets',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Cache static assets (HTML, CSS, JS)
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'document' ||
                   request.destination === 'script' ||
                   request.destination === 'style' ||
                   request.destination === 'image',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-resources',
    })
  );

  // Offline fallback
  workbox.recipes.offlineFallback();
} else {
  console.log(`Workbox didn't load`);
}
