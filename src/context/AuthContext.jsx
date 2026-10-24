/**
 * AuthContext — stores the JWT token and current user in memory + localStorage.
 * Provides login(), register(), logout() helpers to all children.
 */
import { createContext, useContext, useState, useCallback } from 'react';
import { apiFetch } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('its_token') || null);
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('its_user') || 'null'); } catch { return null; }
  });

  const _persist = (tok, usr) => {
    setToken(tok);
    setUser(usr);
    if (tok) {
      localStorage.setItem('its_token', tok);
      localStorage.setItem('its_user',  JSON.stringify(usr));
    } else {
      localStorage.removeItem('its_token');
      localStorage.removeItem('its_user');
    }
  };

  const login = useCallback(async (email, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    _persist(data.access_token, data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    _persist(data.access_token, data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => _persist(null, null), []);

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
