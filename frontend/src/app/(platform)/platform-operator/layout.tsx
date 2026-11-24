import React from "react";

import { LiveRouteGate } from "@/components/data/LiveRouteGate";
import { OperatorShell } from "./_components/OperatorShell";

export default function PlatformOperatorLayout({ children }: { children: React.ReactNode }) {
  return <OperatorShell><LiveRouteGate>{children}</LiveRouteGate></OperatorShell>;
}
