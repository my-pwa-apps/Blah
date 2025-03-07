const CACHE_NAME = 'message-pwa-v1';
const BASE_PATH = '/Blah';
const ASSETS = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/styles.css`,
    `${BASE_PATH}/js/app.js`,
    `${BASE_PATH}/manifest.json`,
    `${BASE_PATH}/images/icon-192x192.png`,
    `${BASE_PATH}/images/icon-512x512.png`,
    `${BASE_PATH}/images/default-avatar.png`,
    `${BASE_PATH}/images/countdracula.png`
];

// Install event - cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // Cache what we can, but don't fail on errors
                return Promise.allSettled(
                    ASSETS.map(url => 
                        cache.add(url).catch(err => 
                            console.warn(`Failed to cache ${url}:`, err)
                        )
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', event => {
    // Add security headers to all responses
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return addSecurityHeaders(response);
                }
                
                return fetch(event.request).then(
                    response => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        const secureResponse = addSecurityHeaders(response.clone());
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, secureResponse);
                            });
                        
                        return secureResponse;
                    }
                );
            })
    );
});

function addSecurityHeaders(response) {
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}
