import { apiFetch } from './client';
import { DEFAULT_DEMO_USER } from '../context/AuthContext';

const DEFAULT_SETTINGS = {
  notificationRadius: 2.0,
  nearbyVerificationRequests: true,
  nearbyNewIncidents: true,
  highSeverityAlerts: true,
  categories: {
    Accident: true,
    Congestion: true,
    'Road Blockage': true,
    Waterlogging: true,
    Construction: true,
    Hazard: true,
  },
  locationSharingEnabled: false,
  browserNotificationsEnabled: false,
};

function getLocalUser() {
  try {
    const stored = localStorage.getItem('its_user');
    return stored ? JSON.parse(stored) : DEFAULT_DEMO_USER;
  } catch {
    return DEFAULT_DEMO_USER;
  }
}

function saveLocalUser(usr) {
  try {
    localStorage.setItem('its_user', JSON.stringify(usr));
  } catch {
    // ignore
  }
}

function getLocalSettings() {
  try {
    const stored = localStorage.getItem('its_settings');
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveLocalSettings(st) {
  try {
    localStorage.setItem('its_settings', JSON.stringify(st));
  } catch {
    // ignore
  }
}

/** Fetch the current user profile with data-driven metrics & activity. */
export async function fetchCurrentUser() {
  try {
    return await apiFetch('/users/me');
  } catch {
    return getLocalUser();
  }
}

/** Update profile details (display name, avatar URL). */
export async function updateUserProfile(data) {
  try {
    return await apiFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  } catch {
    // Fallback: update locally
    const current = getLocalUser();
    const updated = {
      ...current,
      ...(data.name ? { name: data.name, fullName: data.name } : {}),
      ...(data.avatar_url !== undefined ? { avatarUrl: data.avatar_url || null } : {}),
    };
    saveLocalUser(updated);
    return updated;
  }
}

/** Fetch user persisted settings/preferences. */
export async function fetchUserSettings() {
  try {
    return await apiFetch('/users/me/settings');
  } catch {
    return getLocalSettings();
  }
}

/** Update user persisted settings/preferences. */
export async function updateUserSettings(settings) {
  try {
    return await apiFetch('/users/me/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  } catch {
    saveLocalSettings(settings);
    return { status: 'ok', settings };
  }
}

/** Send current user location for proximity awareness. */
export async function updateUserLocation(coords) {
  try {
    return await apiFetch('/users/me/location', {
      method: 'POST',
      body: JSON.stringify(coords),
    });
  } catch {
    return { status: 'ok', location: coords };
  }
}
