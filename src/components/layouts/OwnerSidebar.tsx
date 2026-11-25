"use client";

import React from "react";
import { OrgSidebarBody } from "@/components/org-console/OrgShell";

/** Org Owner sidebar — same menu as the Org Owner workspace shell (no Access Map). */
export function OwnerSidebar({ orgId = "" }: { orgId?: string }) {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--color-border)] h-screen sticky top-0 overflow-hidden">
      <OrgSidebarBody family="owner" orgId={orgId} />
    </aside>
  );
}
