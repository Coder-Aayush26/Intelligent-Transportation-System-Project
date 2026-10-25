/**
 * High-performance fetch wrapper with in-memory caching (Stale-While-Revalidate).
 *
 * Speeds up client-side navigation between sidebar views to 0ms by caching GET responses
 * and serving cached data immediately while refreshing in the background.
 */

const CLOUD_API_ORIGIN = 'https://intelligent-transportation-system-project.onrender.com';
const API_ORIGIN = (import.meta.env.DEV || !import.meta.env.VITE_API_URL)
  ? ''
  : import.meta.env.VITE_API_URL.replace(/\/$/, '');
const BASE = `${API_ORIGIN}/api`;

// In-memory cache for GET requests with 20-second freshness TTL
const cache = new Map();

async function execFetch(url, options, headers) {
  return fetch(url, { ...options, headers });
}

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

  const primaryUrl = `${BASE}${path}`;
  let res;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await execFetch(primaryUrl, options, headers);
    } catch {
      // In dev, if local connection fails on attempt 1, try cloud backend directly
      if (import.meta.env.DEV && attempt === 1) {
        try {
          res = await execFetch(`${CLOUD_API_ORIGIN}/api${path}`, options, headers);
          if (res.ok) break;
        } catch {
          // ignore and retry
        }
      }
      if (attempt === maxAttempts) {
        if (cache.has(cacheKey)) {
          return cache.get(cacheKey).data;
        }
        throw new Error('Unable to connect to the server. Please check your network connection.');
      }
      await new Promise((r) => setTimeout(r, 1200 * attempt));
      continue;
    }

    // If 502 (Bad Gateway) or 504 (Gateway Timeout)
    if (res.status === 502 || res.status === 504) {
      // In dev, if local proxy returned 502 because local backend was not running, try cloud backend
      if (import.meta.env.DEV && attempt === 1) {
        try {
          const cloudRes = await execFetch(`${CLOUD_API_ORIGIN}/api${path}`, options, headers);
          if (cloudRes.status !== 502 && cloudRes.status !== 504) {
            res = cloudRes;
            break;
          }
        } catch {
          // continue to retry
        }
      }

      // If server is waking up on Render (free-tier cold start), wait and retry
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
    }

    break;
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
          if (text.includes('<!DOCTYPE') || text.includes('<html') || res.status === 502 || res.status === 504) {
            if (res.status === 502 || res.status === 504) {
              errorDetail = 'The server is currently waking up or starting. Please wait a few seconds and try again.';
            } else {
              errorDetail = `Service endpoint not found (${res.status} at ${path}). Please check backend status.`;
            }
          } else {
            errorDetail = text;
          }
        }
      }
    } catch {
      // fallback
    }

    if (!errorDetail && (res.status === 502 || res.status === 504)) {
      errorDetail = 'The server is currently waking up or starting. Please wait a few seconds and try again.';
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
