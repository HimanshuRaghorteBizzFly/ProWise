"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuthStore } from "@/store/auth-store";
import type { SystemRole } from "@/types";

/**
 * Keeps a signed-in member inside the panel of the role they hold in this organization. It is a navigation aid
 * only: every API call is still authorized on the server (membership + scoped grant), so a forged URL shows
 * nothing either way. Role preview (development) switches personas on purpose and is not restricted here.
 */
export const PANEL_ROLES: Record<string, SystemRole[]> = {
  owner: ["ORGANIZATION_OWNER"],
  admin: ["ORGANIZATION_ADMIN", "ORGANIZATION_OWNER"],
  manager: ["PROJECT_MANAGER"],
  lead: ["TEAM_LEAD"],
  developer: ["DEVELOPER"],
  reviewer: ["QA_REVIEWER"],
  viewer: ["VIEWER"],
};

/** The panel segment of /org/{orgId}/{panel}/..., or null for organization-level pages. */
export function panelOf(pathname: string): string | null {
  const match = /^\/org\/[^/]+\/([^/]+)/.exec(pathname);
  return match && PANEL_ROLES[match[1]] ? match[1] : null;
}

export function mayOpenPanel(role: SystemRole, pathname: string): boolean {
  const panel = panelOf(pathname);
  return panel === null || PANEL_ROLES[panel].includes(role);
}

export function RoleRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const role = useAuthStore((s) => s.currentRole);
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  const preview = useAuthStore((s) => s.isRolePreview);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const blocked = mounted && authenticated && !preview && !mayOpenPanel(role, pathname);
  useEffect(() => {
    if (blocked) router.replace("/unauthorized");
  }, [blocked, router]);

  if (blocked) {
    return (
      <div role="alert" className="p-6 text-sm text-[var(--color-text-secondary)]">
        This area belongs to another role. Redirecting…
      </div>
    );
  }
  return <>{children}</>;
}
