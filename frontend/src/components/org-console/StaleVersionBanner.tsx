"use client";

import React from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

/**
 * Inline notice for 409 STALE_VERSION (task 1.4): someone else saved first. No popup: the banner sits in the
 * page, keeps the user's draft visible, and offers a reload of the latest version. Shows the request reference.
 */
export function StaleVersionBanner({
  requestId,
  onReload,
  reloading = false,
}: {
  requestId?: string;
  onReload: () => void;
  reloading?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="stale-version-banner"
      className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-800 dark:text-amber-200"
    >
      <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-[12rem] space-y-0.5">
        <p>
          <b>Someone changed this.</b> Reload to see the latest version, then make your change again.
        </p>
        {requestId ? <p className="text-[11px] opacity-80">Reference: {requestId}</p> : null}
      </div>
      <button
        type="button"
        onClick={onReload}
        disabled={reloading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-white/60 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-white disabled:opacity-60 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
      >
        <RefreshCw className={reloading ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} aria-hidden />
        Reload
      </button>
    </div>
  );
}
