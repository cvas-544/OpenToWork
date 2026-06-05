import { createContext, useContext, useState, useEffect } from "react";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const TOKEN_KEY = "otw_token";
const USER_KEY  = "otw_user";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function AuthProvider({ children }) {
  const [token, setToken]   = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(u => { setUser(u); localStorage.setItem(USER_KEY, JSON.stringify(u)); })
      .catch(() => { setToken(null); setUser(null); localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Login failed");
    }
    const data = await res.json();
    setToken(data.token);
    setUser({ email: data.email, role: data.role });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify({ email: data.email, role: data.role }));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const isAdmin = user?.role === "admin";

  return (
    <AuthCtx.Provider value={{ token, user, loading, login, logout, isAdmin }}>
      {children}
    </AuthCtx.Provider>
  );
}
