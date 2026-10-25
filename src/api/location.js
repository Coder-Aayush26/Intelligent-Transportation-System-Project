import { apiFetch } from './client';

/**
 * Geocode a search query (e.g. "Vadodara", "Indore", "Raopura") into coordinates.
 * Tries the backend proxy first (which caches results); falls back to client-side Nominatim
 * if the backend is unreachable.
 *
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<{ displayName: string, lat: number, lng: number, type: string }>>}
 */
export async function geocodeSearch(query, signal) {
  const clean = query?.trim();
  if (!clean || clean.length < 2) return [];

  // 1. Try backend cached geocoder
  try {
    const data = await apiFetch(`/location/search?q=${encodeURIComponent(clean)}`, {
      signal,
      noCache: false,
    });
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    // Fall through to client-side Nominatim
  }

  // 2. Direct fallback to OpenStreetMap Nominatim
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=6&addressdetails=1`,
    {
      signal,
      headers: {
        'Accept': 'application/json',
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Geocoding failed with status ${res.status}`);
  }

  const raw = await res.json();
  if (!Array.isArray(raw)) return [];

  return raw.map((item) => ({
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    type: item.type || 'place',
    importance: parseFloat(item.importance || 0),
  }));
}

/**
 * Reverse-geocode latitude and longitude into a human-readable address.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ displayName: string, locality: string, city: string, state: string }>}
 */
export async function reverseGeocode(lat, lng, signal) {
  // 1. Try backend proxy
  try {
    const data = await apiFetch(`/location/reverse?lat=${lat}&lng=${lng}`, {
      signal,
      noCache: false,
    });
    if (data && data.displayName) {
      return data;
    }
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    // Fall through to client-side Nominatim
  }

  // 2. Direct fallback
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
    {
      signal,
      headers: {
        'Accept': 'application/json',
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Reverse geocoding failed with status ${res.status}`);
  }

  const raw = await res.json();
  const address = raw.address || {};
  const locality =
    address.suburb ||
    address.neighbourhood ||
    address.residential ||
    address.road ||
    address.city_district ||
    address.city ||
    '';
  const city = address.city || address.town || address.village || address.county || '';
  const state = address.state || '';

  return {
    displayName: raw.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    locality,
    city,
    state,
    lat,
    lng,
  };
}
