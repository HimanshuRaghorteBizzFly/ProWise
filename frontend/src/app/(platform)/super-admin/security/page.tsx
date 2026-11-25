"use client";

import React from "react";
import { operationsApi } from "@/lib/admin-api/operations";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { SecurityCenterView } from "@/components/super-admin/operations/SecurityCenterView";

export default function SecurityCenterPage() {
  const { state, reload } = useAdminResource(() => operationsApi.security.overview(), "security-overview");
  return <SecurityCenterView overview={state} onRetry={reload} />;
}
