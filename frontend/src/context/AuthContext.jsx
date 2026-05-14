import { createContext, useContext, useState, useEffect } from 'react';
import { MOCK_USERS } from '../data/mockData';
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

  // Try the backend first; fall back to in-bundle MOCK_USERS if the API is
  // unavailable (no Supabase, offline preview, etc.).
  const login = async ({ email, password }) => {
    try {
      const { user: u } = await api.login(email, password);
      const safe = { ...u };
      delete safe.password;
      setUser(safe);
      return { ok: true, user: safe };
    } catch (e) {
      const found = MOCK_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );
      if (!found) return { ok: false, error: 'Invalid email or password' };
      const { password: _pw, ...safe } = found;
      setUser(safe);
      return { ok: true, user: safe };
    }
  };

  const loginAs = (userId) => {
    const found = MOCK_USERS.find((u) => u.id === userId);
    if (!found) return { ok: false };
    const { password: _pw, ...safe } = found;
    setUser(safe);
    return { ok: true, user: safe };
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, loginAs, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
