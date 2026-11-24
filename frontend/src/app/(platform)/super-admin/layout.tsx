import React from "react";

import { LiveRouteGate } from "@/components/data/LiveRouteGate";
import { SuperAdminShell } from "./_components/SuperAdminShell";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminShell><LiveRouteGate>{children}</LiveRouteGate></SuperAdminShell>;
}
