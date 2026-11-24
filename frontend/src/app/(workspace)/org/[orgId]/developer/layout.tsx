"use client";

import React from "react";

import { LiveRouteGate } from "@/components/data/LiveRouteGate";
import { PanelLayout } from "@/components/layouts/panel-layout";

/** Developer pages bring their own PanelLayout; a page without a backend shows "Later" inside one. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <LiveRouteGate shell={(content) => <PanelLayout title="Developer">{content}</PanelLayout>}>{children}</LiveRouteGate>;
}
