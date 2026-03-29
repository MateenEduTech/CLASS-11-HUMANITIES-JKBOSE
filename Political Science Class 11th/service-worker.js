/**
 * Service Worker — Class 11 Political Science PWA
 * Author: Mateen Yousuf | School Education Department, J&K
 * Caching strategy: Cache-First for app shell, Network-First for dynamic content
 */

const CACHE_NAME = 'polsci11-jkbose-v1.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

// ─── INSTALL ────────────────────────────────────────────────────────────────
// Pre-cache the app shell so the app works offline immediately after install
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting()) // Activate immediately, don't wait for old SW to die
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
// Clean up old caches from previous versions of the app
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME) // Delete any cache that isn't current version
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim()) // Take control of all open pages immediately
  );
});

// ─── FETCH ────────────────────────────────────────────────────────────────────
// Cache-First strategy: serve from cache if available, otherwise fetch from network
// This makes the app work fully offline after first load
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and non-http requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // ✅ Found in cache — return immediately (works offline)
        if (cachedResponse) {
          // In the background, try to update the cache with a fresh copy
          fetchAndCache(event.request);
          return cachedResponse;
        }

        // ❌ Not in cache — fetch from network and cache it for next time
        return fetchAndCache(event.request);
      })
      .catch(() => {
        // Network failed AND no cache — show offline fallback for HTML pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      })
  );
});

/**
 * Fetch a resource from the network and cache it.
 * Returns the network response (or throws if network is unavailable).
 */
function fetchAndCache(request) {
  return fetch(request)
    .then(networkResponse => {
      // Only cache valid responses (status 200, not opaque cross-origin)
      if (
        networkResponse &&
        networkResponse.status === 200 &&
        networkResponse.type !== 'opaque'
      ) {
        const responseClone = networkResponse.clone(); // Clone because response can only be consumed once
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
      }
      return networkResponse;
    });
}

// ─── MESSAGE HANDLER ────────────────────────────────────────────────────────
// Listen for messages from the main app (e.g., force update)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Allow the app to clear the cache (useful for "update app" button)
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Cache cleared on request');
      // Notify all clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client =>
          client.postMessage({ type: 'CACHE_CLEARED' })
        );
      });
    });
  }
});

// ─── BACKGROUND SYNC ─────────────────────────────────────────────────────────
// If the browser supports Background Sync, register a sync for quiz scores
// (Useful if scores are ever synced to a server in future)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-scores') {
    console.log('[SW] Background sync triggered: sync-scores');
    // Currently scores are stored in LocalStorage only — no server sync needed
  }
});

console.log('[SW] Service Worker script loaded — Class 11 Political Science PWA v1.0');
