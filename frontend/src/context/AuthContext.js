// PATH: quiz-platform/frontend/src/context/AuthContext.js
// FIXES:
// 1. Bootstrap fetches /auth/me so user.coins and all DB fields are populated
// 2. login() fetches /auth/me after login so full user is set immediately
// 3. loginWithToken() — used by AuthModal after OTP verify — restored
// 4. refreshUser() fully replaces user with fresh server data
// 5. Global 'coinsUpdated' event keeps Navbar coin badge in sync

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user,          setUser]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [newDeviceInfo, setNewDeviceInfo] = useState(null);
  const inactivityTimer = useRef(null);

  // ── Helper: fetch full profile from server ────────────
  // JWT only stores: id, username, email, is_admin, plan
  // coins, streak_count, xp_points, last_spin_date, etc. are NOT in JWT
  const fetchFullProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      return { ...data, plan: data.subscription_plan || 'free' };
    } catch {
      return null;
    }
  }, []);

  // ── Bootstrap on page load ────────────────────────────
  useEffect(() => {
    const token    = localStorage.getItem('qm_token');
    const remember = localStorage.getItem('qm_remember') === 'true';
    const alive    = sessionStorage.getItem('qm_session_alive');

    if (token && (remember || alive)) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          // Set minimal user from JWT immediately so UI doesn't flash logged-out
          const minimalUser = {
            id:       payload.id,
            username: payload.username,
            email:    payload.email,
            is_admin: payload.is_admin || false,
            plan:     payload.plan || 'free',
            coins:    0,
          };
          setUser(minimalUser);

          // Fetch full profile in background so coins/streak/XP are populated
          fetchFullProfile().then(fullUser => {
            if (fullUser) setUser(fullUser);
            setLoading(false);
          });
          return;
        } else {
          clearStorage();
        }
      } catch {
        clearStorage();
      }
    }
    setLoading(false);
  }, []); // eslint-disable-line

  // ── Inactivity auto-logout (non-remember sessions) ────
  const resetTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    if (localStorage.getItem('qm_remember') !== 'true') {
      inactivityTimer.current = setTimeout(() => logout('inactivity'), 30 * 60 * 1000);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!user) return;
    const events = ['mousemove','keydown','click','scroll','touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearTimeout(inactivityTimer.current);
    };
  }, [user, resetTimer]);

  // ── Tab visibility: check session on focus ────────────
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) return;
      if (localStorage.getItem('qm_remember') !== 'true' && !sessionStorage.getItem('qm_session_alive')) {
        logout('session_expired');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []); // eslint-disable-line

  // ── Listen for global coin/xp updates from any component ─
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.coins != null) {
        setUser(prev => prev ? { ...prev, coins: e.detail.coins } : prev);
      }
      if (e.detail?.xp_points != null) {
        setUser(prev => prev ? { ...prev, xp_points: e.detail.xp_points } : prev);
      }
    };
    window.addEventListener('coinsUpdated', handler);
    return () => window.removeEventListener('coinsUpdated', handler);
  }, []);

  function clearStorage() {
    localStorage.removeItem('qm_token');
    localStorage.removeItem('qm_user');
    localStorage.removeItem('qm_remember');
    sessionStorage.removeItem('qm_session_alive');
    delete api.defaults.headers.common['Authorization'];
  }

  // ── Login ─────────────────────────────────────────────
  const login = async (email, password, rememberMe = false) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const { token, user: u, is_new_device } = data;

      localStorage.setItem('qm_token',    token);
      localStorage.setItem('qm_user',     JSON.stringify(u));
      localStorage.setItem('qm_remember', String(rememberMe));
      if (!rememberMe) sessionStorage.setItem('qm_session_alive', '1');
      sessionStorage.setItem('qm_just_logged_in', '1');
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Set minimal user first, then fetch full profile
      setUser({ ...u, plan: u.subscription_plan || u.plan || 'free' });
      const fullUser = await fetchFullProfile();
      if (fullUser) setUser(fullUser);

      if (is_new_device) {
        setNewDeviceInfo({
          device:  data.device_info,
          browser: data.browser,
          ip:      data.ip,
          time:    new Date().toLocaleString(),
        });
      }
      return { ok: true, is_new_device };
    } catch (e) {
      return { ok: false, error: e.response?.data?.error || 'Login failed.' };
    }
  };

  // ── Login with token ── called by AuthModal after OTP verify ──
  // Signature: loginWithToken(token, userObject, rememberMe?)
  const loginWithToken = useCallback((tkn, u, rememberMe = false) => {
    try {
      localStorage.setItem('qm_token',    tkn);
      localStorage.setItem('qm_user',     JSON.stringify(u));
      localStorage.setItem('qm_remember', String(rememberMe));
      if (!rememberMe) sessionStorage.setItem('qm_session_alive', '1');
      sessionStorage.setItem('qm_just_logged_in', '1');
      api.defaults.headers.common['Authorization'] = `Bearer ${tkn}`;

      // Set enriched user immediately
      const enriched = {
        ...u,
        plan:     u.subscription_plan || u.plan || 'free',
        is_admin: u.is_admin || false,
        coins:    u.coins || 0,
      };
      setUser(enriched);

      // Fetch full profile in background to populate coins/streak/XP
      fetchFullProfile().then(fullUser => {
        if (fullUser) setUser(fullUser);
      });
    } catch (e) {
      console.error('loginWithToken error:', e);
    }
  }, [fetchFullProfile]);

  // ── Logout ────────────────────────────────────────────
  const logout = useCallback((reason = 'manual') => {
    clearStorage();
    setUser(null);
    clearTimeout(inactivityTimer.current);
    if (reason !== 'manual') window.location.href = '/';
  }, []); // eslint-disable-line

  // ── Refresh user from server ──────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      const updated = { ...data, plan: data.subscription_plan || 'free' };
      setUser(updated);
      // Broadcast so Navbar coin badge updates instantly
      window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { coins: updated.coins || 0 } }));
      return updated;
    } catch {
      return null;
    }
  }, []);

  // ── Subscription helpers ──────────────────────────────
  const plan    = user?.plan || user?.subscription_plan || 'free';
  const isAdmin = user?.is_admin || false;
  const isPro   = isAdmin || plan === 'pro'   || plan === 'elite' || plan === 'lifetime';
  const isElite = isAdmin || plan === 'elite' || plan === 'lifetime';

  // ── Token getter (always fresh from localStorage) ─────
  const token = localStorage.getItem('qm_token');

  const value = {
    user, loading, login, loginWithToken, logout, refreshUser,
    isAdmin, isPro, isElite, plan,
    token,
    newDeviceInfo, clearNewDevice: () => setNewDeviceInfo(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}