importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log(`Workbox is loaded`);

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
