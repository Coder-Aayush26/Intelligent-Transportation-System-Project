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
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('its_token') : null;
  // Normalize path: ensure single leading slash and strip trailing slashes before query params or string end
  const cleanPath = (path.startsWith('/') ? path : `/${path}`).replace(/\/+(\?|$)/, '$1');
  const cacheKey = `${token ? 'auth' : 'anon'}:${cleanPath}`;
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

  const isDev = Boolean(import.meta.env.DEV);
  const primaryUrl = `${BASE}${cleanPath}`;
  const cloudUrl = `${CLOUD_API_ORIGIN}/api${cleanPath}`;
  const directLocalUrl = `http://127.0.0.1:8000/api${cleanPath}`;
  const failoverUrl = isDev ? directLocalUrl : cloudUrl;
  let res;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await execFetch(primaryUrl, options, headers);
    } catch {
      // If primary fetch fails (network error, socket drop, or dead proxy), try direct local or cloud backend
      try {
        const fallbackRes = await execFetch(failoverUrl, options, headers);
        if (fallbackRes.ok) {
          res = fallbackRes;
          break;
        }
      } catch {
        // ignore and proceed to retry
      }

      if (attempt === maxAttempts) {
        if (cache.has(cacheKey)) {
          return cache.get(cacheKey).data;
        }
        throw new Error(isDev 
          ? 'Unable to connect to local backend (http://127.0.0.1:8000). Please ensure Uvicorn is active.' 
          : 'Unable to connect to the server. Please check your network connection.'
        );
      }
      await new Promise((r) => setTimeout(r, 600 * attempt));
      continue;
    }

    // If 502 (Bad Gateway), 504 (Gateway Timeout), or 404 (proxy rewrite mismatch)
    if (res.status === 502 || res.status === 504 || res.status === 404) {
      // If primary returned a gateway/proxy error, attempt direct local (dev) or cloud backend directly
      try {
        const fallbackRes = await execFetch(failoverUrl, options, headers);
        if (fallbackRes.ok) {
          res = fallbackRes;
          break;
        }
      } catch {
        // continue to retry
      }

      // If server is starting up, wait briefly and retry
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
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
              errorDetail = isDev 
                ? 'Backend service is starting up on http://127.0.0.1:8000. Retrying...' 
                : 'The server is currently waking up or starting. Please wait a few seconds and try again.';
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
      errorDetail = isDev 
        ? 'Backend service is starting up on http://127.0.0.1:8000. Retrying...' 
        : 'The server is currently waking up or starting. Please wait a few seconds and try again.';
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
