"use client";

import React from "react";
import { Building2, ChevronDown } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

export function WorkspaceSwitcher() {
  const { organization, organizations, switchOrg } = useOrganization();

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors cursor-pointer">
        <Building2 className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
        <select
          value={organization?.id || ""}
          onChange={(e) => switchOrg(e.target.value)}
          className="bg-transparent border-none outline-none cursor-pointer text-xs font-medium text-[var(--color-text-primary)] pr-2"
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
              {org.name}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)] pointer-events-none" />
      </div>
    </div>
  );
}

