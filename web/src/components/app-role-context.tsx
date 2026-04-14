"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AppRole } from "@/lib/types";

type AppRoleContextValue = {
  role: AppRole;
  /** `loading` until the first `/api/me` response (shared across all pages) */
  status: "loading" | "ready";
  /** Call after login / role change to refetch */
  refresh: () => void;
};

const AppRoleContext = createContext<AppRoleContextValue | null>(null);

export function AppRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AppRole>("owner");
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const loadMe = useCallback(() => {
    return fetch("/api/me")
      .then((r) => r.json())
      .then((j) => {
        setRole((j.role as AppRole) ?? "owner");
        setStatus("ready");
      })
      .catch(() => {
        setRole("owner");
        setStatus("ready");
      });
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const refresh = useCallback(() => {
    setStatus("loading");
    void loadMe();
  }, [loadMe]);

  const value = useMemo(
    () => ({ role, status, refresh }),
    [role, status, refresh],
  );

  return (
    <AppRoleContext.Provider value={value}>{children}</AppRoleContext.Provider>
  );
}

export function useAppRole(): AppRoleContextValue {
  const ctx = useContext(AppRoleContext);
  if (!ctx) {
    throw new Error("useAppRole must be used within AppRoleProvider");
  }
  return ctx;
}
