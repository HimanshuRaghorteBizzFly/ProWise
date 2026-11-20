"use client";

import React from "react";
import { DeliverySidebarBody } from "@/components/delivery/DeliveryShell";

/** Project Manager sidebar — same menu as the Project Manager workspace shell. */
export function ManagerSidebar({ orgId = "org-acme" }: { orgId?: string }) {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--color-border)] h-screen sticky top-0 overflow-hidden">
      <DeliverySidebarBody role="manager" orgId={orgId} />
    </aside>
  );
}
