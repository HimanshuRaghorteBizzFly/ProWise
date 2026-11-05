"use client";

import React from "react";
import { Shield, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SystemRole } from "@/types";

const ROLES: { label: string; role: SystemRole }[] = [
  { label: "Super Admin", role: "SUPER_ADMIN" },
  { label: "Platform Operator", role: "PLATFORM_OPERATOR" },
  { label: "Org Owner", role: "ORGANIZATION_OWNER" },
  { label: "Org Admin", role: "ORGANIZATION_ADMIN" },
  { label: "Project Manager", role: "PROJECT_MANAGER" },
  { label: "Team Lead", role: "TEAM_LEAD" },
  { label: "Developer", role: "DEVELOPER" },
  { label: "QA / Reviewer", role: "QA_REVIEWER" },
  { label: "Viewer", role: "VIEWER" },
];

export function RoleSwitcher() {
  const { role, switchRole } = useAuth();

  return (
    <div className="relative inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)]">
      <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
      <select
        value={role}
        onChange={(e) => switchRole(e.target.value as SystemRole)}
        className="bg-transparent border-none outline-none cursor-pointer text-xs font-semibold text-[var(--color-text-primary)] pr-2"
      >
        {ROLES.map((r) => (
          <option key={r.role} value={r.role} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
            {r.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)] pointer-events-none" />
    </div>
  );
}

