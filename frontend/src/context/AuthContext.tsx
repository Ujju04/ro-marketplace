import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../lib/api";

type Role = "user" | "technician" | null;

interface AuthContextType {
  token: string | null;
  role: Role;
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, role: Role, userData: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("ro_token"));
  const [role, setRole] = useState<Role>(localStorage.getItem("ro_role") as Role);
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem("ro_token"));

  useEffect(() => {
    if (!token) { setIsLoading(false); return; }
    const endpoint = role === "technician" ? "/technicians/me/profile" : "/auth/users/me";
    api.get(endpoint)
      .then((res) => setUser(res.data))
      .catch(() => { /* token invalid, interceptor handles redirect */ })
      .finally(() => setIsLoading(false));
  }, [token, role]);

  const login = (newToken: string, newRole: Role, userData: any) => {
    localStorage.setItem("ro_token", newToken);
    localStorage.setItem("ro_role", newRole || "");
    setToken(newToken);
    setRole(newRole);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("ro_token");
    localStorage.removeItem("ro_role");
    setToken(null);
    setRole(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, user, isAuthenticated: !!token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
