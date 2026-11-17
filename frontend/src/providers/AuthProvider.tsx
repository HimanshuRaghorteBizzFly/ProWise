"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Organization, SystemRole, User } from "@/types";
import { apiClient } from "@/lib/api";
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
        name: me.email.split("@")[0],
        timezone: organizations[0]?.timezone || "UTC",
        createdAt: "",
      };
      const role = toSystemRole(me.memberships[0]?.role_template);
      hydrate(user, organizations, role);
      setOrganizations(organizations);
    }).catch(() => {
      if (active) {
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
