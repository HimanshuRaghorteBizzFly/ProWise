"use client";

import React from "react";

import { OwnerAccessGate } from "@/components/owner/OwnerAccessGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <OwnerAccessGate requiredPermission="org:update">{children}</OwnerAccessGate>;
}
