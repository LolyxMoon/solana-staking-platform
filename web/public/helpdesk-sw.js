/**
 * StakePoint Helpdesk - Service Worker
 * Receives push notifications even when browser is closed
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  
  const options = {
    body: data.body || 'New message received',
    icon: data.icon || '/favicon.jpg',
    badge: data.badge || '/favicon.jpg',
    tag: data.tag || 'helpdesk',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open Dashboard'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'StakePoint Helpdesk', options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Open the dashboard
  const urlToOpen = event.notification.data?.url || '/helpdesk/admin/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if dashboard is already open
      for (const client of windowClients) {
        if (client.url.includes('/helpdesk/admin') && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if not
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
