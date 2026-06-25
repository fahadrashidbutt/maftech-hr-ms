// src/auth.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { api, token } from './api.js';

const AuthContext = createContext(null);

// Permission codes per role, mirrored from the backend so the UI can hide
// controls the user can't use. The backend remains the real enforcer.
const PERMS = {
  super_admin: ['*'],
  hr: ['employee.write', 'employee.edit', 'leave.approve', 'leave.edit', 'document.write', 'recruitment.read', 'recruitment.write', 'dashboard.hr', 'shift.write'],
  manager: ['leave.approve', 'dashboard.hr'],
  employee: ['leave.submit'],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token.get()) { setLoading(false); return; }
    api.me().then((d) => setUser(d.user)).catch(() => token.clear()).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const d = await api.login(email, password);
    token.set(d.token);
    const me = await api.me();
    setUser(me.user);
  };
  const logout = () => { token.clear(); setUser(null); };
  const can = (perm) => {
    if (!user) return false;
    const p = PERMS[user.role] || [];
    return p.includes('*') || p.includes(perm);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
