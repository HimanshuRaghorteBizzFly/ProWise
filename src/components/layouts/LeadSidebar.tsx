"use client";

import React from "react";
import { DeliverySidebarBody } from "@/components/delivery/DeliveryShell";

/** Team Lead sidebar — same menu as the Team Lead workspace shell. */
export function LeadSidebar({ orgId = "" }: { orgId?: string }) {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--color-border)] h-screen sticky top-0 overflow-hidden">
      <DeliverySidebarBody role="lead" orgId={orgId} />
    </aside>
  );
}
