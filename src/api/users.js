import { apiFetch } from './client';

/** Fetch the current user profile with data-driven metrics & activity. */
export function fetchCurrentUser() {
  return apiFetch('/users/me');
}

/** Update profile details (display name, avatar URL). */
export function updateUserProfile(data) {
  return apiFetch('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** Fetch user persisted settings/preferences. */
export function fetchUserSettings() {
  return apiFetch('/users/me/settings');
}

/** Update user persisted settings/preferences. */
export function updateUserSettings(settings) {
  return apiFetch('/users/me/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

/** Send current user location to database for proximity awareness and nearby incident calculations. */
export function updateUserLocation(coordsOrLat, maybeLng) {
  let lat;
  let lng;
  if (typeof coordsOrLat === 'object' && coordsOrLat !== null) {
    lat = Number(coordsOrLat.latitude !== undefined ? coordsOrLat.latitude : coordsOrLat.lat);
    lng = Number(coordsOrLat.longitude !== undefined ? coordsOrLat.longitude : coordsOrLat.lng);
  } else {
    lat = Number(coordsOrLat);
    lng = Number(maybeLng);
  }

  const payload = { lat, lng, latitude: lat, longitude: lng };
  return apiFetch('/users/me/location', {
    method: 'POST',
    body: JSON.stringify(payload),
    noCache: true,
  });
}
