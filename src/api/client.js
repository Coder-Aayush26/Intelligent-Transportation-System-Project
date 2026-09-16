/**
 * Thin fetch wrapper.
 * All API modules import this so error handling lives in one place.
 *
 * The Vite dev proxy rewrites /api/* -> http://localhost:8000/api/*.
 * In production, set VITE_API_URL to the deployed backend origin. When it is
 * unset, requests remain same-origin so a reverse proxy can still be used.
 */

const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const BASE = `${API_ORIGIN}/api`;

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}
