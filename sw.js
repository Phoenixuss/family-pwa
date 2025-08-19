const CACHE_NAME = 'family-pwa-dual-camera-v2.0.0';
const DATA_CACHE_NAME = 'family-pwa-data-v1.0.0';

// Resources to cache
const urlsToCache = [
    '/',
    '/index.html',
    '/app.js',
    '/script.js',
    '/manifest.json',
    // TensorFlow.js and MediaPipe dependencies
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js',
    // FaceNet model
    'https://phoenixuss.github.io/pwa-assets/model/facenet/model.json'
];

// Critical resources that must be cached
const criticalResources = [
    '/',
    '/index.html',
    '/app.js',
    '/script.js',
    '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    console.log('[SW] Install event');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Opened cache');
                
                // Cache critical resources first
                return cache.addAll(criticalResources)
                    .then(() => {
                        // Then cache other resources (don't fail if some fail)
                        return Promise.allSettled(
                            urlsToCache
                                .filter(url => !criticalResources.includes(url))
                                .map(url => {
                                    return cache.add(new Request(url, { 
                                        mode: 'cors',
                                        cache: 'no-cache'
                                    })).catch(error => {
                                        console.warn(`[SW] Failed to cache ${url}:`, error);
                                    });
                                })
                        );
                    });
            })
            .catch((error) => {
                console.error('[SW] Failed to cache critical resources:', error);
            })
    );
    
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate event');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control of all pages
            self.clients.claim()
        ])
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Handle API requests differently
    if (requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(handleApiRequest(event.request));
        return;
    }
    
    // Handle face recognition model requests
    if (requestUrl.href.includes('pwa-assets/model/facenet/')) {
        event.respondWith(handleModelRequest(event.request));
        return;
    }
    
    // Handle other requests with cache-first strategy
    event.respondWith(handleResourceRequest(event.request));
});

// Handle resource requests (cache-first strategy)
async function handleResourceRequest(request) {
    try {
        // Try to get from cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            // Check if cached response is still valid
            const cacheTime = cachedResponse.headers.get('sw-cache-time');
            if (cacheTime) {
                const age = Date.now() - parseInt(cacheTime);
                // Cache valid for 24 hours for most resources
                if (age < 24 * 60 * 60 * 1000) {
                    return cachedResponse;
                }
            } else {
                return cachedResponse;
            }
        }
        
        // Fetch from network
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            const responseToCache = networkResponse.clone();
            
            // Add timestamp to cached response
            const headers = new Headers(responseToCache.headers);
            headers.set('sw-cache-time', Date.now().toString());
            
            const cachedResponseWithTime = new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
            });
            
            cache.put(request, cachedResponseWithTime);
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('[SW] Network request failed:', error);
        
        // Try to return cached version as fallback
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // For navigation requests, return cached index.html
        if (request.destination === 'document') {
            const indexResponse = await caches.match('/index.html');
            if (indexResponse) {
                return indexResponse;
            }
        }
        
        // Return offline page or error response
        return new Response('Service unavailable. Please check your connection.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Handle API requests (network-first strategy)
async function handleApiRequest(request) {
    try {
        // Try network first for API requests
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(DATA_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('[SW] API request failed:', error);
        
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return new Response(JSON.stringify({
            error: 'Network unavailable',
            cached: false
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle model requests (cache-first with long expiry)
async function handleModelRequest(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('[SW] Model request failed:', error);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        throw error;
    }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        return;
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            version: CACHE_NAME
        });
        return;
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        }).then(() => {
            event.ports[0].postMessage({ success: true });
        });
        return;
    }
});

// Background sync for when app comes back online
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    
    if (event.tag === 'family-data-sync') {
        event.waitUntil(syncFamilyData());
    }
});

// Push notification handling
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New family member detected!',
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 'family-notification'
        },
        actions: [
            {
                action: 'view',
                title: 'View Details'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Family PWA', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Sync family data when online
async function syncFamilyData() {
    try {
        // This would sync with your backend/Google Drive
        console.log('[SW] Syncing family data...');
        return Promise.resolve();
    } catch (error) {
        console.error('[SW] Sync failed:', error);
        throw error;
    }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'family-data-backup') {
        event.waitUntil(syncFamilyData());
    }
});
