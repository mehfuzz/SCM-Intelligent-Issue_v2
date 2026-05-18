import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

const STORAGE_KEY = 'airtel_scm_auth_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const login = async ({ email, password }) => {
    try {
      const { user: u } = await api.login(email, password);
      setUser(u);
      return { ok: true, user: u };
    } catch (e) {
      return { ok: false, error: e?.message?.replace(/^API \d+: /, '') || 'Login failed' };
    }
  };

  // After forced password change succeeds, clear the flag in-memory + localStorage.
  const clearMustChangePassword = () => {
    setUser((prev) => prev ? { ...prev, mustChangePassword: false } : prev);
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
