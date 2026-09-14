import { apiFetch } from './client';

/** Fetch all active incidents from the backend. */
export function fetchIncidents() {
  return apiFetch('/incidents/');
}

/** Fetch a single incident by id. */
export function fetchIncident(id) {
  return apiFetch(`/incidents/${id}`);
}

/** Create a new incident report. */
export function createIncident(payload) {
  return apiFetch('/incidents/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Submit a community verification for an incident. */
export function verifyIncident(id, verdict) {
  return apiFetch(`/incidents/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ verdict }),
  });
}

/** Fetch dashboard stats. */
export function fetchStats() {
  return apiFetch('/incidents/stats/summary');
}
