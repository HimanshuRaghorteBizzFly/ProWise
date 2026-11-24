"use client";

import React from "react";

import { LiveRouteGate } from "@/components/data/LiveRouteGate";
import { OwnerAccessGate } from "@/components/owner/OwnerAccessGate";
import { OrgShell } from "@/components/org-console/OrgShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <OwnerAccessGate requiredPermission="org.manage">
      <OrgShell family="owner"><LiveRouteGate>{children}</LiveRouteGate></OrgShell>
    </OwnerAccessGate>
  );
}
