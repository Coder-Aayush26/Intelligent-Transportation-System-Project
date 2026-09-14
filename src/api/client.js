/**
 * Thin fetch wrapper.
 * All API modules import this so error handling lives in one place.
 *
 * The Vite dev proxy rewrites /api/* -> http://localhost:8000/api/*
 * so the same paths work in dev and in a same-origin production deploy.
 */

const BASE = '/api';

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
