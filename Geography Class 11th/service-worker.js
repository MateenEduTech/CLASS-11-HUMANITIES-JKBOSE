// ============================================================
//  JKBOSE Class 11 Geography App — Service Worker
//  Handles offline caching, background sync, install prompts
// ============================================================

const CACHE_NAME = 'geo11-jkbose-v1.0';
const OFFLINE_URL = './index.html';

// All files to cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

// ── Install Event ────────────────────────────────────────────
// Pre-cache all app shell files so the app works offline
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Geography App v1.0...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      // Force new service worker to activate immediately
      return self.skipWaiting();
    }).catch((err) => {
      console.error('[SW] Pre-cache failed:', err);
    })
  );
});

// ── Activate Event ───────────────────────────────────────────
// Clean up old caches when a new service worker takes over
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Claim all clients immediately
      return self.clients.claim();
    })
  );
});

// ── Fetch Event ──────────────────────────────────────────────
// Cache-first strategy: serve from cache, fall back to network
// For navigation requests, always serve index.html (SPA)
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip chrome-extension and non-http requests
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve from cache
        return cachedResponse;
      }

      // Not in cache — try the network
      return fetch(event.request).then((networkResponse) => {
        // Only cache successful, same-origin responses
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed — serve offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        // For other resources, return a simple offline response
        return new Response(
          JSON.stringify({ error: 'Offline', message: 'No network available' }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
          }
        );
      });
    })
  );
});

// ── Message Handler ──────────────────────────────────────────
// Allow the app to send commands to the service worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ cleared: true });
    });
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// ── Background Sync (future use) ─────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    console.log('[SW] Background sync: student progress');
    // Reserved for future cloud sync feature
  }
});

// ── Push Notifications (future use) ─────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'New content available in your Geography App!',
    icon: './manifest.json',
    badge: './manifest.json',
    vibrate: [200, 100, 200],
    data: { url: data.url || './' },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'JKBOSE Geography App',
      options
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data?.url || './';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

console.log('[SW] Geography App Service Worker loaded ✓');
