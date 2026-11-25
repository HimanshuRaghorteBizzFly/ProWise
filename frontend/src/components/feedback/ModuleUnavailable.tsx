import React from "react";
import Link from "next/link";
import { Construction } from "lucide-react";

export interface ModuleUnavailableProps {
  /** Human name of the module, e.g. "Announcements". */
  module?: string;
  /** Where the "Back" link goes, normally the panel home. */
  homeHref?: string;
  homeLabel?: string;
}

/**
 * Shown on routes whose module has no backend API yet. The app never renders sample data in its place.
 */
export function ModuleUnavailable({ module, homeHref, homeLabel = "Back to home" }: ModuleUnavailableProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 p-12 text-center">
      <div className="mb-4 rounded-full bg-[var(--color-sidebar)] p-4 text-[var(--color-text-muted)]">
        <Construction className="h-8 w-8" />
      </div>
      <h2 className="text-base font-semibold text-[var(--color-text-primary)]">This module is not available yet</h2>
      <p className="mt-1 max-w-sm text-sm text-[var(--color-text-secondary)]">
        {module ? `${module} has` : "This area has"} no live data source yet. It will appear here once its service is released.
      </p>
      {homeHref && (
        <Link
          href={homeHref}
          className="mt-5 inline-flex items-center rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar)]"
        >
          {homeLabel}
        </Link>
      )}
    </div>
  );
}
