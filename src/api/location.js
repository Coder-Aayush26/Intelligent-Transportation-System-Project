import { apiFetch } from './client';
import { searchLandmarks } from '../services/favoritesStorage';

/**
 * Geocode a search query (e.g. "Vadodara", "Delhi Airport", "Palasia", "Vijay Nagar") into coordinates.
 * Accepts optional proximity coordinates (lat/lng) to bias search towards the user's current GPS location.
 *
 * @param {string} query
 * @param {AbortSignal | { signal?: AbortSignal, lat?: number, lng?: number, coords?: { lat: number, lng: number } }} [optionsOrSignal]
 * @returns {Promise<Array<{ displayName: string, lat: number, lng: number, type: string }>>}
 */
export async function geocodeSearch(query, optionsOrSignal) {
  const clean = query?.trim();
  if (!clean || clean.length < 2) return [];

  let signal = null;
  let biasLat = null;
  let biasLng = null;

  if (optionsOrSignal) {
    if (optionsOrSignal instanceof AbortSignal || optionsOrSignal.aborted !== undefined) {
      signal = optionsOrSignal;
    } else if (typeof optionsOrSignal === 'object') {
      signal = optionsOrSignal.signal;
      biasLat = optionsOrSignal.lat ?? optionsOrSignal.coords?.lat;
      biasLng = optionsOrSignal.lng ?? optionsOrSignal.coords?.lng;
    }
  }

  // Check if query is already direct coordinates "lat, lng"
  const coordMatch = clean.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[3]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [{
        displayName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        lat,
        lng,
        type: 'coordinate',
        importance: 1.0,
      }];
    }
  }

  // 1. Try backend cached geocoder with proximity bias
  try {
    let endpoint = `/location/search?q=${encodeURIComponent(clean)}`;
    if (biasLat != null && biasLng != null && !isNaN(biasLat) && !isNaN(biasLng)) {
      endpoint += `&lat=${Number(biasLat).toFixed(4)}&lng=${Number(biasLng).toFixed(4)}`;
    }
    const data = await apiFetch(endpoint, {
      signal,
      noCache: false,
    });
    if (Array.isArray(data) && data.length > 0) {
      const valid = data.filter((r) => !isNaN(r.lat) && !isNaN(r.lng));
      if (valid.length > 0) return valid;
    }
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    // Fall through to client-side Nominatim
  }

  // 2. Direct query to OpenStreetMap Nominatim across India with proximity viewbox
  const runNominatim = async (queryText) => {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryText)}&countrycodes=in&limit=8&addressdetails=1`;
    if (biasLat != null && biasLng != null && !isNaN(biasLat) && !isNaN(biasLng)) {
      const bLat = Number(biasLat);
      const bLng = Number(biasLng);
      const minLng = (bLng - 0.75).toFixed(4);
      const maxLng = (bLng + 0.75).toFixed(4);
      const minLat = (bLat - 0.75).toFixed(4);
      const maxLat = (bLat + 0.75).toFixed(4);
      url += `&viewbox=${minLng},${maxLat},${maxLng},${minLat}&bounded=0`;
    }
    const res = await fetch(url, {
      signal,
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => ({
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type || 'place',
      importance: parseFloat(item.importance || 0),
    })).filter((r) => !isNaN(r.lat) && !isNaN(r.lng));
  };

  try {
    const results = await runNominatim(clean);
    if (results.length > 0) return results;

    // Fallback: Check local surveyed landmarks if external query didn't return
    const surveyed = searchLandmarks(clean);
    if (surveyed && surveyed.length > 0) {
      return surveyed.map((s) => ({
        displayName: s.name,
        lat: s.coords.lat,
        lng: s.coords.lng,
        type: s.category || 'landmark',
        importance: 0.9,
      }));
    }

    return [];
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return [];
  }
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
