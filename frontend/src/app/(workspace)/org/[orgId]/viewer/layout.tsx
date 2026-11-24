import React from "react";

import { LiveRouteGate } from "@/components/data/LiveRouteGate";
import { ViewerShell } from "./_components/ViewerShell";

export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return <ViewerShell><LiveRouteGate>{children}</LiveRouteGate></ViewerShell>;
}
