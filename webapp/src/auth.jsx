import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, clearSession, getToken, getUser, setSession, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const IDLE_LIMIT_MS = 30 * 60 * 1000; // sign out after 30 minutes without activity

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? getUser() : null));
  const idleTimer = useRef(null);

  const signOutLocal = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOutLocal);
  }, [signOutLocal]);

  const login = useCallback(async (email, password, allowedRole) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    const u = data.user;
    if (!u || u.role_key !== allowedRole) {
      // Right password, wrong door: end that login straight away.
      try {
        await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${data.access_token}` } });
      } catch (e) {
        // ignore
      }
      throw new Error(allowedRole === 'super_admin' ? 'This page is for the super admin. Use /web/support for support.' : 'This page is for customer support agents.');
    }
    setSession(data.access_token, u);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (e) {
      // sign out locally regardless
    }
    signOutLocal();
  }, [signOutLocal]);

  useEffect(() => {
    if (!user) return undefined;
    const reset = () => {
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        logout();
      }, IDLE_LIMIT_MS);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(idleTimer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user, logout]);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}
