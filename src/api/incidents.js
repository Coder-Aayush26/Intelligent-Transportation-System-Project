import { apiFetch } from './client';

/**
 * Fetch all active incidents from the backend, optionally filtered by
 * location bounds or category.
 */
export function fetchIncidents(params = {}) {
  const query = new URLSearchParams();
  if (params.lat != null && params.lng != null && params.radius != null) {
    query.set('lat', String(params.lat));
    query.set('lng', String(params.lng));
    query.set('radius', String(params.radius));
  }
  if (params.category) {
    query.set('category', params.category);
  }
  const qs = query.toString();
  return apiFetch(`/incidents${qs ? `?${qs}` : ''}`);
}

/** Fetch a single incident by id. */
export function fetchIncident(id) {
  return apiFetch(`/incidents/${id}`);
}

/** Create a new incident report. */
export function createIncident(payload) {
  return apiFetch('/incidents', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Submit a community verification for an incident with voter coordinates for 1000m proximity check. */
export function verifyIncident(id, verdict, coords = null) {
  return apiFetch(`/incidents/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ 
      verdict,
      user_lat: coords?.lat ?? null,
      user_lng: coords?.lng ?? null,
    }),
  });
}

/** Fetch dashboard stats (optionally local to a geographic area). */
export function fetchStats(params = {}) {
  const query = new URLSearchParams();
  if (params.lat != null && params.lng != null && params.radius != null) {
    query.set('lat', String(params.lat));
    query.set('lng', String(params.lng));
    query.set('radius', String(params.radius));
  }
  const qs = query.toString();
  return apiFetch(`/incidents/stats/summary${qs ? `?${qs}` : ''}`);
}

/** Fetch nearby incidents based on user or searched location within radius km. */
export function fetchNearbyIncidents(lat, lng, radius = 10, category = null) {
  const query = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radius),
  });
  if (category) {
    query.set('category', category);
  }
  return apiFetch(`/incidents/nearby?${query.toString()}`);
}

/** Fetch high-priority notifications. */
export function fetchNotifications() {
  return apiFetch('/incidents/notifications');
}

/** Fetch incidents reported by the currently authenticated user. */
export function fetchMyReports() {
  return apiFetch('/incidents/my', { noCache: true });
}

/** Update incident resolution status and notes (City Officials / Authority). */
export function updateIncidentResolution(id, payload) {
  return apiFetch(`/incidents/${id}/resolution`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    noCache: true,
  });
}

/** Fetch all incidents for the Authority Dashboard operations console. */
export function fetchAuthorityIncidents(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.category) query.set('category', params.category);
  if (params.severity) query.set('severity', params.severity);
  const qs = query.toString();
  return apiFetch(`/incidents/authority/all${qs ? `?${qs}` : ''}`, { noCache: true });
}

/** Fetch hotspot corridor clusters and heatmap points for leaflet.heat. */
export function fetchHotspotAnalytics(days = 30) {
  return apiFetch(`/incidents/analytics/hotspots?days=${days}`, { noCache: true });
}

/** Fetch city-wide road safety trend metrics and hourly distribution. */
export function fetchSafetyTrends() {
  return apiFetch('/incidents/analytics/trends', { noCache: true });
}

