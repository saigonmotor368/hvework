// ==============================================================================
// HVE Work - Progressive Web App Service Worker (v4.0.0)
// Hỗ trợ: Offline App Shell Caching, Web Push Notifications, Navigation Fallback
// ==============================================================================

const CACHE_NAME = 'hve-work-cache-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-any.png',
  '/icons/icon-512-any.png',
  '/icons/apple-touch-icon-v3.png',
];

// 1. Install Event: Cache App Shell core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Network First with Cache Fallback strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Do not intercept non-GET or cross-origin API calls with custom auth
  if (request.method !== 'GET') {
    return;
  }

  // Handle SPA navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Static assets & script/style requests
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// 4. Web Push Notification Event (VAPID)
self.addEventListener('push', (event) => {
  let data = {
    title: 'HVE Work - Thông báo điều hành',
    body: 'Bạn có cập nhật mới về hồ sơ hoặc nhiệm vụ công việc.',
    url: '/',
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'hve-work-update',
    renotify: true,
    data: {
      url: data.url || '/',
    },
    actions: [
      { action: 'open', title: '👁️ Xem chi tiết' },
      { action: 'dismiss', title: 'Đóng' },
    ],
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'HVE_PUSH_RECEIVED' }));
      }),
      typeof self.navigator.setAppBadge === 'function' && Number.isFinite(data.badgeCount)
        ? self.navigator.setAppBadge(data.badgeCount)
        : Promise.resolve(),
    ]),
  );
});

// 5. Notification Click Event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
