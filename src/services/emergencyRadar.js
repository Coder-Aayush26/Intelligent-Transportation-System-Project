/**
 * Emergency Verification Radar Service
 * Finds urgent and high-severity incidents within 1,000 meters of the commuter
 * so they can immediately verify or refute conditions in real-time.
 */
import { fetchNearbyIncidents } from '../api/incidents.js';

/**
 * Calculate distance in meters using the Haversine formula
 */
export function haversineMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format meter distance into user-friendly string
 */
export function formatDistance(meters) {
  if (meters == null || isNaN(meters)) return '';
  if (meters < 50) return 'Right here (< 50m)';
  if (meters < 1000) return `${Math.round(meters)}m away`;
  return `${(meters / 1000).toFixed(1)}km away`;
}

/**
 * Check if incident matches Critical or High Emergency criteria
 */
export function isEmergencyIncident(incident) {
  if (!incident) return false;
  const sev = (incident.severity || '').toLowerCase();
  const cat = (incident.category || '').toLowerCase();

  const isHighSeverity = sev === 'critical' || sev === 'high';
  const isUrgentCategory =
    cat.includes('accident') ||
    cat.includes('blockage') ||
    cat.includes('closure') ||
    cat.includes('flood') ||
    cat.includes('hazard') ||
    cat.includes('fire');

  return isHighSeverity || isUrgentCategory;
}

/**
 * Fetch and filter nearby incidents eligible for emergency verification radar
 */
export async function getNearbyEmergencyQueue({ lat, lng, currentUser, maxRadiusKm = 1.0 }) {
  if (lat == null || lng == null) return [];

  try {
    const incidents = await fetchNearbyIncidents(lat, lng, maxRadiusKm);
    if (!Array.isArray(incidents)) return [];

    const eligible = incidents
      .filter((inc) => {
        // Exclude resolved or closed
        const status = (inc.status || '').toLowerCase();
        if (status === 'resolved' || status === 'closed') return false;

        // Verify coords exist
        const incLat = inc.coords?.lat ?? inc.lat;
        const incLng = inc.coords?.lng ?? inc.lng;
        if (incLat == null || incLng == null) return false;

        // Backend requires distance <= 1000m
        const dist = haversineMeters(lat, lng, Number(incLat), Number(incLng));
        if (dist > 1000) return false;

        // Filter out if reported by current user
        if (currentUser) {
          if (inc.reporter_id && currentUser.id && inc.reporter_id === currentUser.id) return false;
          if (inc.reporter && currentUser.username && inc.reporter.toLowerCase() === currentUser.username.toLowerCase()) return false;
        }

        // Filter out if already voted in localStorage
        const existingVote = localStorage.getItem(`its_vote_${inc.id}`);
        if (existingVote) return false;

        // Filter out if skipped in current session
        const skipped = sessionStorage.getItem(`its_skip_verif_${inc.id}`);
        if (skipped) return false;

        // Check if fits user's selected scope: Critical & High severity only
        return isEmergencyIncident(inc);
      })
      .map((inc) => {
        const incLat = inc.coords?.lat ?? inc.lat;
        const incLng = inc.coords?.lng ?? inc.lng;
        const distMeters = haversineMeters(lat, lng, Number(incLat), Number(incLng));
        return {
          ...inc,
          coords: { lat: incLat, lng: incLng },
          distanceMeters: distMeters,
          distanceFormatted: formatDistance(distMeters),
        };
      });

    // Sort: Critical first, then by closest distance
    eligible.sort((a, b) => {
      const aCrit = (a.severity || '').toLowerCase() === 'critical' ? 1 : 0;
      const bCrit = (b.severity || '').toLowerCase() === 'critical' ? 1 : 0;
      if (aCrit !== bCrit) return bCrit - aCrit;
      return a.distanceMeters - b.distanceMeters;
    });

    return eligible;
  } catch (err) {
    console.warn('Failed to fetch emergency queue:', err);
    return [];
  }
}
