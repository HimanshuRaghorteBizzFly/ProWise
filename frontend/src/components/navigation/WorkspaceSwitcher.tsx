"use client";

import React from "react";
import { Building2, ChevronDown, Loader2 } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

/** Workspace picker. Switching asks the API for an org-bound token and clears all cached workspace data. */
export function WorkspaceSwitcher() {
  const { organization, organizations, switchOrg, switching, switchError } = useOrganization();

  return (
    <div className="relative inline-flex flex-col items-start">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors cursor-pointer">
        {switching ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600" aria-hidden />
        ) : (
          <Building2 className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" aria-hidden />
        )}
        <select
          aria-label="Switch workspace"
          value={organization?.id || ""}
          disabled={switching}
          onChange={(e) => void switchOrg(e.target.value)}
          className="bg-transparent border-none outline-none cursor-pointer text-xs font-medium text-[var(--color-text-primary)] pr-2 disabled:cursor-wait"
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
              {org.name}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)] pointer-events-none" />
      </div>
      {switchError && (
        <p role="alert" className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
          {switchError}
        </p>
      )}
    </div>
  );
}
