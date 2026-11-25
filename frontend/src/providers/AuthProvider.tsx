"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import type { SystemRole, User } from "@/types";
import { SESSION_EXPIRED_EVENT } from "@/lib/api";
import { classifyFailure, previewEnabled, readPermissionEnv } from "@/lib/permissions";
import { establishSession } from "@/lib/session";
import { clearWorkspaceCaches } from "@/lib/workspace-switch";
import { useWorkspaceStore } from "@/store/workspace-store";

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
  useAuthStore.getState().logout();
  window.location.assign(signInPathFor(pathname + search));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, currentRole, currentOrg, isAuthenticated, hydrate } = useAuthStore();
  const setOrganizations = useWorkspaceStore((state) => state.setOrganizations);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, sendToSignIn);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, sendToSignIn);
  }, []);

  useEffect(() => {
    let active = true;
    establishSession().catch((error: unknown) => {
      if (!active) return;
      const store = useAuthStore.getState();
      const preview = previewEnabled() && store.isRolePreview;

      if (classifyFailure(error, readPermissionEnv()) !== "fixture") {
        if (preview) {
          store.setSessionStatus("authenticated");
          return;
        }
        store.logout();
        sendToSignIn();
        return;
      }

      if (preview) {
        store.setSessionStatus("authenticated");
        return;
      }

      // The fixture identity is only used when mock mode is enabled and no real session is available.
      const defaultOrg = {
        id: "org-acme",
        slug: "acme-health",
        name: "Acme Health Technologies",
        ownerId: "usr-owner",
        timezone: "America/New_York",
        workCalendar: { workDays: [1, 2, 3, 4, 5], dailyHours: 8, holidays: [] },
        createdAt: "2026-02-15T09:00:00Z",
        plan: "ENTERPRISE" as const,
        status: "ACTIVE" as const,
      };
      const defaultUser: User = {
        id: "usr-viewer",
        email: "jordan.lee@acmehealth.com",
        name: "Jordan Lee (Viewer)",
        timezone: "America/New_York",
        createdAt: "2026-02-25T16:00:00Z",
      };
      hydrate(defaultUser, [defaultOrg], "VIEWER");
      setOrganizations([defaultOrg]);
    });

    return () => {
      active = false;
    };
  }, [hydrate, setOrganizations]);

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
