"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, ChevronDown, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { SystemRole } from "@/types";
import { previewEnabled } from "@/lib/permissions";

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

/** Dev preview only (NEXT_PUBLIC_USE_MOCKS=true, never in production). */
export function RoleSwitcher() {
  return previewEnabled() ? <RoleSwitcherControl /> : null;
}

function RoleSwitcherControl() {
  const router = useRouter();
  const currentRole = useAuthStore((s) => s.currentRole);
  const isRolePreview = useAuthStore((s) => s.isRolePreview);
  const switchRoleAndNavigate = useAuthStore((s) => s.switchRoleAndNavigate);
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(newRole: SystemRole) {
    if (newRole === currentRole || isPending) return;
    startTransition(() => {
      switchRoleAndNavigate(newRole, router.replace);
    });
  }

  return (
    <div
      className="relative inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)]"
      aria-label="Switch role"
    >
      {isPending ? (
        <Loader2
          className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
      ) : (
        <Shield
          className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
      )}
      <select
        value={currentRole}
        onChange={(e) => handleRoleChange(e.target.value as SystemRole)}
        disabled={isPending}
        aria-label="Select dashboard role"
        className="bg-transparent border-none outline-none cursor-pointer text-xs font-semibold text-[var(--color-text-primary)] pr-2 disabled:opacity-60 disabled:cursor-wait"
      >
        {ROLES.map((r) => (
          <option
            key={r.role}
            value={r.role}
            className="bg-[var(--color-surface)] text-[var(--color-text-primary)]"
          >
            {r.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="w-3 h-3 text-[var(--color-text-muted)] pointer-events-none"
        aria-hidden="true"
      />
      {isRolePreview && (
        <span
          title="Preview only: sample data is used and API actions are disabled."
          className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
        >
          Preview
        </span>
      )}
    </div>
  );
}
