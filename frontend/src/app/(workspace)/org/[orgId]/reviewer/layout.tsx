import React from "react";

import { LiveRouteGate } from "@/components/data/LiveRouteGate";
import { DeliveryShell } from "@/components/delivery/DeliveryShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DeliveryShell role="reviewer"><LiveRouteGate>{children}</LiveRouteGate></DeliveryShell>;
}
