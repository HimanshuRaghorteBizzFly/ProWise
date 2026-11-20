"use client";

import React from "react";

import { OwnerAccessGate } from "@/components/owner/OwnerAccessGate";
import { OrgShell } from "@/components/org-console/OrgShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <OwnerAccessGate requiredPermission="org.manage">
      <OrgShell family="owner">{children}</OrgShell>
    </OwnerAccessGate>
  );
}
