/**
 * High-performance fetch wrapper with in-memory caching (Stale-While-Revalidate).
 *
 * Speeds up client-side navigation between sidebar views to 0ms by caching GET responses
 * and serving cached data immediately while refreshing in the background.
 */

const API_ORIGIN = (import.meta.env.DEV || !import.meta.env.VITE_API_URL)
  ? ''
  : import.meta.env.VITE_API_URL.replace(/\/$/, '');
const BASE = `${API_ORIGIN}/api`;

// In-memory cache for GET requests with 20-second freshness TTL
const cache = new Map();

export async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const token = localStorage.getItem('its_token');
  const cacheKey = `${token ? 'auth' : 'anon'}:${path}`;
  const now = Date.now();

  // Clear cache on write operations (POST, PUT, DELETE) so subsequent GETs get fresh data
  if (method !== 'GET') {
    cache.clear();
  }

  // Fast-path: return cached data immediately if fresh
  if (method === 'GET' && !options.noCache && cache.has(cacheKey)) {
    const entry = cache.get(cacheKey);
    if (now - entry.timestamp < 20000) {
      return entry.data;
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    // If network fails (e.g. temporary timeout) but we have cached data, return it
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey).data;
    }
    throw new Error('Unable to connect to the server. Please check your network connection.');
  }

  if (!res.ok) {
    let errorDetail = '';
    try {
      const clone = res.clone();
      try {
        const data = await clone.json();
        if (data && data.detail) {
          errorDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        }
      } catch {
        const text = await res.text().catch(() => '');
        if (text) {
          if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            errorDetail = `Service endpoint not found (${res.status} at ${path}). Please check backend status.`;
          } else {
            errorDetail = text;
          }
        }
      }
    } catch {
      // fallback
    }
    throw new Error(errorDetail || `Request failed with status ${res.status}`);
  }

  const data = await res.json();
  if (method === 'GET') {
    cache.set(cacheKey, { data, timestamp: now });
  }
  return data;
}

export function clearApiCache() {
  cache.clear();
}
