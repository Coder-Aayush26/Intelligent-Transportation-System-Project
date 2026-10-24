/**
 * AuthContext — manages user authentication and persistent sessions in MongoDB.
 *
 * Sessions remain active until the user logs out or the token expires.
 * On app load, validates the active session with the backend so user state is restored.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch, clearApiCache } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('its_token') || null);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('its_user') || 'null'); } catch { return null; }
  });
  const [sessionLoading, setSessionLoading] = useState(true);

  const _persist = (tok, usr) => {
    setToken(tok);
    setUser(usr);
    if (tok && usr) {
      localStorage.setItem('its_token', tok);
      localStorage.setItem('its_user', JSON.stringify(usr));
    } else {
      localStorage.removeItem('its_token');
      localStorage.removeItem('its_user');
      try {
        sessionStorage.removeItem('its_lat');
        sessionStorage.removeItem('its_lng');
      } catch {
        // ignore
      }
      clearApiCache();
    }
  };

  // Validate active session in MongoDB on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('its_token');
    if (!storedToken) {
      setSessionLoading(false);
      return;
    }

    apiFetch('/auth/session')
      .then((res) => {
        if (res && res.user) {
          _persist(storedToken, res.user);
        }
      })
      .catch((err) => {
        console.warn('Session verification failed, clearing session:', err.message);
        _persist(null, null);
      })
      .finally(() => {
        setSessionLoading(false);
      });
  }, []);

  const login = useCallback(async (identifier, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
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

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    _persist(null, null);
  }, []);

  const updateAuthUser = useCallback((partialUser) => {
    setUser((prev) => {
      const updated = { ...(prev || {}), ...partialUser };
      try {
        localStorage.setItem('its_user', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login,
        register,
        logout,
        updateAuthUser,
        isLoggedIn: !!token,
        sessionLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
