/**
 * Thin fetch wrapper.
 * All API modules import this so error handling and auth token management live in one place.
 *
 * In development, requests are sent to same-origin /api/* so Vite proxies them to localhost:8000.
 * In production, VITE_API_URL can be set to the remote backend origin if hosted on a separate domain.
 */

const API_ORIGIN = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const BASE = `${API_ORIGIN}/api`;

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('its_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch (err) {
    throw new Error('Unable to connect to the server. Please ensure the backend is running on port 8000.');
  }

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const data = await res.json();
      if (data && data.detail) {
        errorDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      const text = await res.text().catch(() => '');
      if (text) errorDetail = text;
    }
    throw new Error(errorDetail || `Request failed with status ${res.status}`);
  }

  return res.json();
}
