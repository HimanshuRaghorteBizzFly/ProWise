import React from "react";
import { DeliveryShell } from "@/components/delivery/DeliveryShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DeliveryShell role="manager">{children}</DeliveryShell>;
}
