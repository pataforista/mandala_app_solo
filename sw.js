importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log(`Workbox is loaded`);

  // Pre-cache core local resources on install
  workbox.precaching.precacheAndRoute([
    { url: 'index.html', revision: '507694cc41' },
    { url: 'offline.html', revision: 'e3f75ca34c' },
    { url: 'manifest.json', revision: '499c63e010' },
    { url: 'dataset_taoista.js', revision: '40430edc17' },
    { url: 'favicon.ico', revision: '82b6de504a' },
    { url: 'assets/sekaiwo/SekaiwoRegular.ttf', revision: '18b91dca8a' },
    { url: 'assets/icons/icon-192.png', revision: '40b39ab008' },
    { url: 'assets/icons/icon-512.png', revision: 'bbf769826f' },
    { url: 'assets/catalogo.json', revision: '51d5902a83' }
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


  // Paquetes de figuras y adornos: se guardan al primer uso y se refrescan en segundo plano
  // (con CacheFirst, un paquete corregido no llegaba a quien ya lo tenía en caché)
  workbox.routing.registerRoute(
    ({url}) => url.pathname.includes('/assets/') && url.pathname.endsWith('.json'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'figure-packages',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 90 * 24 * 60 * 60, // 90 días
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Offline fallback
  workbox.recipes.offlineFallback();
} else {
  console.log(`Workbox didn't load`);
}
