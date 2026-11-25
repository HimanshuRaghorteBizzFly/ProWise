"use client";

import React, { useCallback } from "react";
import { operationsApi } from "@/lib/admin-api/operations";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { ApiMonitoringView } from "@/components/super-admin/operations/ApiMonitoringView";
import { useOpsMutation } from "@/components/super-admin/operations/shared";

export default function ApiMonitoringPage() {
  const stats = useAdminResource(() => operationsApi.dashboardStats(), "ops-stats");
  const alerts = useAdminResource(() => operationsApi.alerts.list(), "ops-alerts");
  const jobs = useAdminResource(() => operationsApi.jobs(), "ops-jobs");
  const reloadAlerts = alerts.reload;
  const reloadStats = stats.reload;
  const refresh = useCallback(() => {
    void reloadAlerts();
    void reloadStats();
  }, [reloadAlerts, reloadStats]);
  const { busy, notice, clearNotice, run } = useOpsMutation(refresh);

  return (
    <ApiMonitoringView
      stats={stats.state}
      alerts={alerts.state}
      jobs={jobs.state}
      onRetryStats={stats.reload}
      onRetryAlerts={alerts.reload}
      onRetryJobs={jobs.reload}
      onAcknowledge={(a) => void run(`ack:${a.id}`, () => operationsApi.alerts.acknowledge(a.id), "Alert acknowledged.")}
      busy={busy}
      notice={notice}
      onReload={() => {
        clearNotice();
        refresh();
      }}
      onDismissNotice={clearNotice}
    />
  );
}
