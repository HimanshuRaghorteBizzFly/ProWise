"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Organization, SystemRole, User } from "@/types";
import { apiClient } from "@/lib/api";
import { clearAuthSession } from "@/lib/auth-session";
import { useWorkspaceStore } from "@/store/workspace-store";

interface AuthContextValue {
  user: User;
  role: SystemRole;
  orgId: string;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, currentRole, currentOrg, isAuthenticated, hydrate, logout } = useAuthStore();
  const setOrganizations = useWorkspaceStore((state) => state.setOrganizations);

  useEffect(() => {
    let active = true;
    apiClient.me().then((me) => {
      if (!active) return;
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
        if (store.isAuthenticated && store.currentRole === "SUPER_ADMIN") {
          return;
        }
        clearAuthSession();
      }
    });
    return () => {
      active = false;
    };
  }, [hydrate, logout, setOrganizations]);

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

function toSystemRole(role: string | undefined): SystemRole {
  const roles: SystemRole[] = [
    "SUPER_ADMIN", "PLATFORM_OPERATOR", "ORGANIZATION_OWNER", "ORGANIZATION_ADMIN",
    "PROJECT_MANAGER", "TEAM_LEAD", "DEVELOPER", "QA_REVIEWER", "VIEWER",
  ];
  return role && roles.includes(role as SystemRole) ? role as SystemRole : "VIEWER";
}

function parseCalendar(value: string) {
  try {
    const calendar = JSON.parse(value) as { workDays?: number[]; dailyHours?: number; holidays?: string[] };
    return {
      workDays: calendar.workDays || [],
      dailyHours: calendar.dailyHours || 0,
      holidays: calendar.holidays || [],
    };
  } catch {
    return { workDays: [], dailyHours: 0, holidays: [] };
  }
}


export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
};
