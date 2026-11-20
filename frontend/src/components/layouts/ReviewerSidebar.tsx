"use client";

import React from "react";
import { DeliverySidebarBody } from "@/components/delivery/DeliveryShell";

/** QA / Reviewer sidebar — same menu as the QA / Reviewer workspace shell. */
export function ReviewerSidebar({ orgId = "org-acme" }: { orgId?: string }) {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--color-border)] h-screen sticky top-0 overflow-hidden">
      <DeliverySidebarBody role="reviewer" orgId={orgId} />
    </aside>
  );
}
