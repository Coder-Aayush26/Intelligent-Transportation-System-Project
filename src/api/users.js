import { apiFetch } from './client';

/** Fetch the current user profile. */
export function fetchCurrentUser() {
  return apiFetch('/users/me');
}
