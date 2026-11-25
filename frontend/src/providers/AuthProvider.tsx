"use client";

import React, { createContext, useContext, useEffect } from "react";
import type { SystemRole, User } from "@/types";
import { clearAuthSession } from "@/lib/auth-session";
import { establishSession } from "@/lib/session";
import { clearWorkspaceCaches } from "@/lib/workspace-switch";
import { useAuthStore } from "@/store/auth-store";

interface AuthContextValue {
  user: User;
  role: SystemRole;
  orgId: string;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Routes that require a session should send anonymous users to sign in. */
export function isProtectedPath(pathname: string): boolean {
  return /^\/org\//.test(pathname) || ["/select-workspace", "/select-org", "/no-workspace"].includes(pathname);
}

export function signInPathFor(pathname: string): string {
  return `/login?expired=1&next=${encodeURIComponent(pathname)}`;
}

function sendToSignIn() {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  if (!isProtectedPath(pathname)) return;
  clearWorkspaceCaches();
  window.location.assign(signInPathFor(pathname + search));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentRole = useAuthStore((state) => state.currentRole);
  const currentOrg = useAuthStore((state) => state.currentOrg);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    // Do not race the login form with an unsolicited /me request on sign-in pages.
    if (["/login", "/signup", "/forgot-password", "/reset-password"].includes(window.location.pathname)) return;
    let active = true;
    establishSession().catch(() => {
      if (!active) return;
      clearAuthSession();
      sendToSignIn();
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user: currentUser, role: currentRole, orgId: currentOrg.id, isAuthenticated }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
};
