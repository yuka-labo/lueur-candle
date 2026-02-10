/**
 * Lueur — Service Worker
 */

const CACHE_NAME = 'lueur-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/messages.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/images/bg-morning.webp',
    '/images/bg-afternoon.webp',
    '/images/bg-evening.webp',
    '/images/bg-latenight.webp'
];

// Install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // キャッシュがあればそれを返す、なければネットワークから取得
                return response || fetch(event.request)
                    .then((fetchResponse) => {
                        // 成功したらキャッシュに追加
                        if (fetchResponse.ok) {
                            const responseClone = fetchResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => cache.put(event.request, responseClone));
                        }
                        return fetchResponse;
                    });
            })
            .catch(() => {
                // オフラインでキャッシュもない場合
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            })
    );
});
