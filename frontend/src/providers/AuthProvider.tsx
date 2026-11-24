"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Organization, SystemRole, User } from "@/types";
<<<<<<< HEAD
import { SESSION_EXPIRED_EVENT } from "@/lib/api";
import { classifyFailure, previewEnabled, readPermissionEnv } from "@/lib/permissions";
import { establishSession } from "@/lib/session";
import { clearWorkspaceCaches } from "@/lib/workspace-switch";
=======
import { apiClient } from "@/lib/api";
<<<<<<< HEAD
import { mocksAllowed, readPermissionEnv } from "@/lib/permissions";
>>>>>>> 425eba1c2e8cca7686bf3db85b1311460d0d56e4
=======
import { clearAuthSession } from "@/lib/auth-session";
>>>>>>> 29db595 (Initial ProWise project upload)
import { useWorkspaceStore } from "@/store/workspace-store";

interface AuthContextValue {
  user: User;
  role: SystemRole;
  orgId: string;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Pages that need a session: without one the user is sent to sign in (not to an "Access Restricted" page). */
export function isProtectedPath(pathname: string): boolean {
  return /^\/org\//.test(pathname) || ["/select-workspace", "/select-org", "/no-workspace"].includes(pathname);
}

/** Sign-in page for an expired session, remembering where the user was. */
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

/**
 * Loads the server session (GET /v1/me, refreshing the access token from the refresh cookie when needed) into the
 * client stores: the real user, organization (name, timezone), role and memberships. A missing or expired session
 * is "anonymous" and, on a protected page, goes to sign-in. Sample identities exist only in the dev preview
 * (NEXT_PUBLIC_USE_MOCKS=true, never in production) and never override a real session.
 */
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
<<<<<<< HEAD
      const store = useAuthStore.getState();
      const preview = previewEnabled() && store.isRolePreview;
      if (classifyFailure(error, readPermissionEnv()) !== "fixture") {
        if (preview) {
          store.setSessionStatus("authenticated");
=======
      const organizations = me.memberships.map((membership): Organization => ({
        id: membership.org_id,
        slug: membership.slug,
        name: membership.name,
        ownerId: "",
        timezone: membership.timezone,
        workCalendar: parseCalendar(membership.work_calendar),
        createdAt: "",
        plan: "FREE",
        status: membership.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
      }));
      const user: User = {
        id: me.id,
        email: me.email,
        name: me.name || me.email.split("@")[0],
        timezone: organizations[0]?.timezone || "UTC",
        createdAt: "",
      };
      // The role of this session (membership role in the bound organization, or a platform role), never just
      // the first membership: the same person can hold different roles in different organizations.
      const bound = me.organization_id ? organizations.find((o) => o.id === me.organization_id) : undefined;
      const ordered = bound ? [bound, ...organizations.filter((o) => o.id !== bound.id)] : organizations;
      const role = toSystemRole(me.role ?? (organizations.length === 1 ? me.memberships[0]?.role_template : undefined));
      hydrate(user, ordered, role);
      setOrganizations(organizations);
    }).catch((error: unknown) => {
      // The app never invents or keeps a session: no /v1/me answer means signed out, so the persisted
      // isAuthenticated flag is cleared (a 401 arrives here only after the refresh cookie was also refused).
      if (active) {
        const store = useAuthStore.getState();
<<<<<<< HEAD
        // If user already signed in or has an active non-viewer role, preserve their authenticated session
        if (store.isAuthenticated && store.currentRole && store.currentRole !== "VIEWER") {
>>>>>>> 425eba1c2e8cca7686bf3db85b1311460d0d56e4
          return;
        }
        // No valid session: never a fixture identity. Protected pages go to sign-in.
        store.logout();
        sendToSignIn();
        return;
=======
        if (store.isAuthenticated && store.currentRole === "SUPER_ADMIN") {
          return;
        }
        clearAuthSession();
>>>>>>> 29db595 (Initial ProWise project upload)
      }
      // Dev preview only (flag set, backend unreachable): keep the preview, else the sample viewer.
      if (preview) {
        store.setSessionStatus("authenticated");
        return;
      }
      const defaultOrg: Organization = {
        id: "org-acme",
        slug: "acme-health",
        name: "Acme Health Technologies",
        ownerId: "usr-owner",
        timezone: "America/New_York",
        workCalendar: { workDays: [1, 2, 3, 4, 5], dailyHours: 8, holidays: [] },
        createdAt: "2026-02-15T09:00:00Z",
        plan: "ENTERPRISE",
        status: "ACTIVE",
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
      value={{
        user: currentUser,
        role: currentRole,
        orgId: currentOrg.id,
        isAuthenticated,
      }}
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
