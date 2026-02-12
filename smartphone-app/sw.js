const CACHE_NAME = 'the-toll-v12-safe-network';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // 強制的に待機状態をスキップ（即時更新）
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    clients.claim().then(() => { // 即座にコントロールを開始
      // 古いキャッシュを削除
      return caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[THE TOLL] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept cross-origin requests (Supabase/CDN/etc).
  if (url.origin !== self.location.origin) return;

  // Never cache non-GET requests (auth/sign-in/rpc/etc).
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // キャッシュ優先だが、HTMLは常にネットワークを確認（更新検知のため）
  if (event.request.url.includes('index.html') || event.request.url.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
