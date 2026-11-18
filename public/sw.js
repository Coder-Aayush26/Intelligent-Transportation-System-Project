/**
 * ITS Service Worker (sw.js)
 * Handles background Web Push notifications and lockscreen action buttons.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Push Event Listener
 * Displays native OS notification when encrypted push arrives from server.
 */
self.addEventListener('push', (event) => {
  let data = {
    title: '🚨 ITS Emergency Hazard Alert',
    body: 'A high-severity road incident has been reported near your area.',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: 'its-incident-alert',
    data: {
      url: '/app/map',
      incidentId: null,
    },
    actions: [
      { action: 'confirm', title: 'Confirm Active' },
      { action: 'view', title: 'View on Map' },
    ],
    vibrate: [200, 100, 200, 100, 200],
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = Object.assign(data, payload);
      if (payload.data) {
        data.data = Object.assign(data.data, payload.data);
      }
    } catch {
      data.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/vite.svg',
    badge: data.badge || '/vite.svg',
    tag: data.tag || 'its-alert',
    data: data.data || {},
    actions: data.actions || [],
    vibrate: data.vibrate || [200, 100, 200, 100, 200],
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, notificationOptions));
});

/**
 * Notification Click Listener
 * Handles button clicks ('confirm', 'view') and notification body clicks.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  const incidentId = notifData.incidentId;
  const targetUrl = notifData.url || (incidentId ? `/app/incidents/${incidentId}` : '/app/map');

  // Case 1: Commuter tapped "Confirm Active" lockscreen action button
  if (action === 'confirm' && incidentId) {
    event.waitUntil(
      (async () => {
        try {
          // Cast direct background verification vote to correct endpoint
          await fetch(`/api/incidents/${incidentId}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              verdict: 'confirm',
              user_lat: notifData.lat,
              user_lng: notifData.lng,
              comments: 'Verified directly via lockscreen push alert',
            }),
          });
        } catch (err) {
          console.warn('Background verification from SW failed:', err);
        }

        // Open/focus window to show confirmed incident
        return openOrFocusWindow(targetUrl);
      })()
    );
    return;
  }

  // Case 2: Commuter tapped "View on Map" or clicked the notification body
  event.waitUntil(openOrFocusWindow(targetUrl));
});

/**
 * Helper to focus existing app window or open a new one.
 */
async function openOrFocusWindow(url) {
  const windowClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  for (const client of windowClients) {
    if ('focus' in client) {
      if (client.url && client.url.includes('/app/')) {
        client.navigate(url);
        return client.focus();
      }
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(url);
  }
}

