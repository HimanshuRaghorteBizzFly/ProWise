"use client";

import React from "react";

import { OwnerAccessGate } from "@/components/owner/OwnerAccessGate";
import { ADMIN_GATE_KEYS } from "@/components/owner/org-nav";
import { OrgShell } from "@/components/org-console/OrgShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <OwnerAccessGate anyOf={ADMIN_GATE_KEYS} workspaceLabel="Admin workspace">
      <OrgShell family="admin">{children}</OrgShell>
    </OwnerAccessGate>
  );
}
