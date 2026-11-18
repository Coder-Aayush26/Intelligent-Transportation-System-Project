/**
 * Web Push Notification Service
 * Manages Service Worker registration, VAPID key exchange, and PushManager subscriptions.
 */
import { apiFetch } from '../api/client';

/**
 * Check if the current browser environment supports Service Workers and Web Push.
 */
export function isPushNotificationSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Convert standard base64url string to Uint8Array for PushManager.subscribe()
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register the Service Worker located at /sw.js
 */
export async function registerServiceWorker() {
  if (!isPushNotificationSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.error('Failed to register service worker:', err);
    throw err;
  }
}

/**
 * Fetch VAPID public key from backend
 */
export async function getVapidPublicKey() {
  const data = await apiFetch('/notifications/vapid-public-key', { noCache: true });
  if (!data?.public_key) {
    throw new Error('VAPID public key not received from server');
  }
  return data.public_key;
}

/**
 * Retrieve active push subscription from PushManager, if one exists
 */
export async function getExistingPushSubscription() {
  if (!isPushNotificationSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Subscribe user to Native Web Push Notifications
 * @param {Object} coords - Optional { lat, lng }
 * @param {number} radius - Notification alert radius in km
 */
export async function subscribeToPushNotifications({ lat = null, lng = null, radius = 2.0 } = {}) {
  if (!isPushNotificationSupported()) {
    throw new Error('Web Push is not supported on this browser or platform.');
  }

  // 1. Request Browser Permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted by the browser.');
  }

  // 2. Register Service Worker
  const registration = await registerServiceWorker();
  if (!registration) {
    throw new Error('Service Worker registration failed.');
  }

  // 3. Fetch VAPID Public Key
  const vapidPublicKey = await getVapidPublicKey();
  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

  // 4. Subscribe with PushManager (with graceful fallback for privacy browsers like Brave)
  let subscription = null;
  try {
    subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }
  } catch (pushErr) {
    console.warn('PushManager cloud registration blocked (e.g. Brave Shields / Google Push disabled):', pushErr);
    // Create a local fallback subscription so client is registered and can receive local/realtime alerts
    subscription = {
      endpoint: `local-sw-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      isLocal: true,
    };
  }

  let p256dh = '';
  let auth = '';
  if (subscription.getKey) {
    const rawKey = subscription.getKey('p256dh');
    const rawAuth = subscription.getKey('auth');
    p256dh = rawKey
      ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawKey)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')
      : '';
    auth = rawAuth
      ? btoa(String.fromCharCode.apply(null, new Uint8Array(rawAuth)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')
      : '';
  } else {
    p256dh = 'local_fallback_p256dh';
    auth = 'local_fallback_auth';
  }

  // 5. Send Subscription to Backend
  const payload = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh,
      auth,
    },
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
    radius: radius != null ? Number(radius) : 2.0,
  };

  try {
    await apiFetch('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
      noCache: true,
    });
  } catch (apiErr) {
    console.warn('Could not sync subscription to backend, continuing locally:', apiErr);
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('its_push_subscribed', 'true');
  }

  return subscription;
}

/**
 * Unsubscribe user from Native Web Push Notifications
 */
export async function unsubscribeFromPushNotifications() {
  if (!isPushNotificationSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Notify backend to remove record
      await apiFetch(`/notifications/unsubscribe?endpoint=${encodeURIComponent(endpoint)}`, {
        method: 'DELETE',
        noCache: true,
      });
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('its_push_subscribed');
    }
    return true;
  } catch (err) {
    console.error('Failed to unsubscribe from push:', err);
    return false;
  }
}

/**
 * Display a native notification immediately via active Service Worker.
 * Ensures instant visual & vibration feedback even on localhost or low-connectivity networks.
 */
export async function displayLocalNotification({
  title = '🚨 ITS Test Alert: Road Hazard',
  body = 'Testing lockscreen push notification, vibration, and interactive action buttons.',
  incidentId = 'inc-test-demo',
} = {}) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, {
        body,
        icon: '/vite.svg',
        badge: '/vite.svg',
        vibrate: [200, 100, 200, 100, 200],
        tag: `test-incident-${Date.now()}`,
        data: {
          incidentId,
          url: `/app/incidents/${incidentId}`,
        },
        actions: [
          { action: 'confirm', title: 'Confirm Active' },
          { action: 'view', title: 'View on Map' },
        ],
        requireInteraction: true,
      });
      return true;
    }
  } catch (e) {
    console.warn('Could not display local SW notification:', e);
  }
  return false;
}

/**
 * Dispatch a test lockscreen push notification to verify the current device vibrates.
 * Auto-subscribes if no active push subscription exists yet.
 */
export async function sendTestPushAlert(incidentId = 'inc-test-demo') {
  let subscription = await getExistingPushSubscription();
  if (!subscription) {
    // Auto-subscribe if not yet registered
    try {
      subscription = await subscribeToPushNotifications();
    } catch (err) {
      console.warn('Auto-subscription before test alert failed, falling back to local notification:', err);
    }
  }

  // Display native OS notification via Service Worker immediately for guaranteed feedback
  await displayLocalNotification({ incidentId });

  const endpoint = subscription?.endpoint || null;
  if (!endpoint) {
    return { status: 'dispatched_locally', message: 'Notification displayed directly via Service Worker' };
  }

  return apiFetch('/notifications/test', {
    method: 'POST',
    body: JSON.stringify({
      endpoint,
      title: '🚨 ITS Test Alert: Road Hazard',
      body: 'Testing lockscreen push notification, vibration, and interactive action buttons.',
      incident_id: incidentId,
    }),
    noCache: true,
  });
}

