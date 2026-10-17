// TrackFlow Service Worker
const CACHE_NAME = 'trackflow-v1.1.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/config.js',
  './js/firebase-config.js',
  './js/firebase-auth.js',
  './js/state.js',
  './js/storage.js',
  './js/api.js',
  './js/scoring.js',
  './js/streak.js',
  './js/tasks.js',
  './js/eod.js',
  './js/goals.js',
  './js/analytics.js',
  './js/reminders.js',
  './js/settings.js',
  './js/app.js',
  './assets/chart.umd.min.js',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// Install Event - Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[ServiceWorker] Some assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
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

// Fetch Event - Stale-while-revalidate for local assets, network-first for external/API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // If requesting Google Apps Script or external API, always use network-only
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
    return;
  }

  // Local assets: Stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed, if no cache available for navigation, return cached index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Push Event - Background notification when pushed from backend / Web Push
self.addEventListener('push', (event) => {
  let data = {
    title: 'TrackFlow Reminder',
    body: 'You have a scheduled task on your calendar.',
    tag: 'trackflow-reminder',
    icon: './assets/icon-192.png',
    badge: './assets/favicon.svg',
    data: { url: './index.html' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = Object.assign(data, parsed);
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || './assets/icon-192.png',
    badge: data.badge || './assets/favicon.svg',
    tag: data.tag || 'trackflow-reminder',
    renotify: true,
    vibrate: [200, 100, 200],
    data: data.data || { url: './index.html' },
    actions: [
      { action: 'open', title: 'Open TrackFlow' },
      { action: 'complete', title: 'Mark Done' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './index.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('index.html') && 'focus' in client) {
          if (event.action === 'complete' && event.notification.data && event.notification.data.taskId) {
            client.postMessage({
              type: 'COMPLETE_TASK',
              taskId: event.notification.data.taskId
            });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Message listener from frontend to show rich local notification via Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      ...options,
      icon: './assets/icon-192.png',
      badge: './assets/favicon.svg'
    });
  }
});
