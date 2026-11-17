import React from "react";
import { TriangleAlert } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";

/** Owner-only actions with lasting effect. Rendered only for the current owner holding org.manage. */
export function OrganizationDangerZone({ canTransfer }: { canTransfer: boolean }) {
  if (!canTransfer) return null;
  return (
    <section aria-labelledby="danger-zone-title" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="danger-zone-title" className="flex items-center gap-2 text-section-title font-semibold text-rose-700 dark:text-rose-300">
            <TriangleAlert aria-hidden="true" className="h-4 w-4" /> Danger zone
          </h2>
          <p className="mt-1 text-sm text-app-text-secondary">
            Transfer ownership to an eligible active member after confirmation. Exactly one owner must remain, and the last
            owner cannot demote themselves.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LaterActionButton>Transfer ownership</LaterActionButton>
          <OwnerLaterBadge task="1.2" />
        </div>
      </div>
    </section>
  );
}
