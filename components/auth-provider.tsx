"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AuthSession } from "@/lib/auth/types";

const storageKey = "analyticalrx_access_token";
interface AuthContextValue {
  user: AuthSession | null;
  loading: boolean;
  message: string;
  login: (email: string, password: string, tenantKey: string) => Promise<void>;
  logout: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const accessToken = useRef<string | null>(null);

  function clearToken() {
    accessToken.current = null;
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be disabled. */ }
    setUser(null);
  }

  useEffect(() => {
    const controller = new AbortController();
    async function restore() {
      let token: string | null = null;
      try { token = sessionStorage.getItem(storageKey); } catch { /* Login still works without storage. */ }
      if (!token) { setLoading(false); return; }
      try {
        const response = await fetch("/api/auth/session", {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Please sign in again.");
        if (!controller.signal.aborted) {
          accessToken.current = token;
          setUser(data.user);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          clearToken();
          setMessage(error instanceof Error ? error.message : "Please sign in again.");
        }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void restore();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!user) return;
    function checkExpiry() {
      if (user && Date.now() >= user.expiresAt * 1000) {
        clearToken();
        setMessage("Your session has expired. Sign in again.");
        router.replace("/login");
      }
    }
    const timer = window.setTimeout(checkExpiry, Math.min(Math.max(user.expiresAt * 1000 - Date.now(), 0), 2_147_483_647));
    window.addEventListener("focus", checkExpiry);
    document.addEventListener("visibilitychange", checkExpiry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", checkExpiry);
      document.removeEventListener("visibilitychange", checkExpiry);
    };
  }, [user, router]);

  async function login(email: string, password: string, tenantKey: string) {
    setMessage("");
    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, tenantKey }), cache: "no-store",
      });
    } catch { throw new Error("Cannot reach the sign-in service. Try again shortly."); }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Sign-in failed.");
    accessToken.current = data.accessToken;
    try { sessionStorage.setItem(storageKey, data.accessToken); } catch { /* Session lasts until reload when storage is disabled. */ }
    setUser(data.user);
    router.replace(`/${data.user.role}`);
  }

  function logout() {
    const token = accessToken.current;
    clearToken();
    setMessage("");
    router.replace("/login");
    if (token) void fetch("/api/auth/logout", {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }

  return <AuthContext.Provider value={{ user, loading, message, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
