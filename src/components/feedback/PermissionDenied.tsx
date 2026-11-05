import React from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";

export interface PermissionDeniedProps {
  requiredPermission?: string;
  message?: string;
}

export function PermissionDenied({
  requiredPermission,
  message = "You do not have the required permissions to access this feature or perform this action.",
}: PermissionDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center shadow-sm">
      <div className="rounded-full bg-amber-100 dark:bg-amber-950/40 p-4 text-amber-600 dark:text-amber-400 mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Access Restricted</h3>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)] max-w-md">{message}</p>
      {requiredPermission && (
        <span className="mt-3 rounded-md bg-[var(--color-sidebar)] px-2.5 py-1 text-xs font-mono text-[var(--color-text-muted)] border border-[var(--color-border)]">
          Required: {requiredPermission}
        </span>
      )}
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Return to Dashboard
      </Link>
    </div>
  );
}

