import React from "react";

import { RoleRouteGuard } from "@/components/navigation/RoleRouteGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleRouteGuard>{children}</RoleRouteGuard>;
}
