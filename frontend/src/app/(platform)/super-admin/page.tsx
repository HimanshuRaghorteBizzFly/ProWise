"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { AdminDashboard } from "@/types/admin";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { DashboardBody } from "@/components/super-admin/DashboardView";
import { AdminButton, ErrorBanner, PageHeader, SurfaceCard, TableSkeleton } from "./_components/SuperAdminPrimitives";

/**
 * Super Admin overview. Every figure comes from GET /v1/admin/dashboard at the moment it is loaded: no sample data,
 * no estimated history and no trends (none is stored yet). Refresh loads it again.
 */
export default function SuperAdminDashboardPage() {
  const { state, reload } = useAdminResource<AdminDashboard>(() => apiClient.admin.dashboard(), "dashboard");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        description="Live counts from the ProWise server."
        actions={
          <AdminButton variant="outline" size="sm" onClick={() => void reload()} disabled={state.status === "loading"}>
            <RefreshCw className={`w-3.5 h-3.5 ${state.status === "loading" ? "animate-spin" : ""}`} />
            Refresh
          </AdminButton>
        }
      />

      {state.status === "loading" && (
        <SurfaceCard className="p-4">
          <div role="status" aria-label="Loading">
            <TableSkeleton rows={4} />
          </div>
        </SurfaceCard>
      )}

      {state.status === "error" && (
        <SurfaceCard className="p-4">
          <ErrorBanner message={state.message} onRetry={() => void reload()} />
        </SurfaceCard>
      )}

      {state.status === "ready" && <DashboardBody data={state.data} />}
    </div>
  );
}
