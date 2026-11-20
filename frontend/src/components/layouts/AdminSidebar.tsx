"use client";

import React from "react";
import { OrgSidebarBody } from "@/components/org-console/OrgShell";

/** Org Admin sidebar — same menu as the Org Admin workspace shell (no Access Map). */
export function AdminSidebar({ orgId = "org-acme" }: { orgId?: string }) {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--color-border)] h-screen sticky top-0 overflow-hidden">
      <OrgSidebarBody family="admin" orgId={orgId} />
    </aside>
  );
}
