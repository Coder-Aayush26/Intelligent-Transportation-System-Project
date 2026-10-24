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

/** Send current user location for proximity awareness. */
export function updateUserLocation(coords) {
  return apiFetch('/users/me/location', {
    method: 'POST',
    body: JSON.stringify(coords),
  });
}
