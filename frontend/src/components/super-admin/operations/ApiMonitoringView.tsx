"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, BellRing, Check, Cog, ServerCrash, Siren } from "lucide-react";
import type { OpsAlert, OpsBackgroundJob, OpsDashboardStats } from "@/types/admin-operations";
import {
  AdminButton,
  AdminSelect,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { AdminTable, ResourceStatus, cellClass, formatInstant, humanize, mutedCellClass, type ResourceState } from "../admin-resource";
import { CountKpi, MutationNotice, departmentLabel, severityTone, type MutationNoticeState } from "./shared";
import { InfoNote } from "./IntegrationViews";
import { usePagedRows } from "../use-paged-rows";

export interface ApiMonitoringViewProps {
  stats: ResourceState<OpsDashboardStats>;
  alerts: ResourceState<OpsAlert[]>;
  jobs: ResourceState<OpsBackgroundJob[]>;
  onRetryStats: () => void;
  onRetryAlerts: () => void;
  onRetryJobs: () => void;
  onAcknowledge: (alert: OpsAlert) => void;
  busy: string | null;
  notice: MutationNoticeState | null;
  onReload: () => void;
  onDismissNotice: () => void;
}

const num = (v: number | undefined) => (typeof v === "number" ? v : 0);

export function ApiMonitoringView(props: ApiMonitoringViewProps) {
  const { stats, alerts, jobs, busy } = props;
  const [alertFilter, setAlertFilter] = useState("OPEN");

  const alertRows = useMemo(() => {
    if (alerts.status !== "ready") return [];
    if (alertFilter === "OPEN") return alerts.data.filter((a) => !a.acknowledged);
    if (alertFilter === "ACKNOWLEDGED") return alerts.data.filter((a) => a.acknowledged);
    return alerts.data;
  }, [alerts, alertFilter]);
  const jobRows = useMemo(() => (jobs.status === "ready" ? jobs.data : []), [jobs]);
  const alertPage = usePagedRows(alertRows);
  const jobPage = usePagedRows(jobRows);

  return (
    <div className="space-y-6">
      <PageHeader title="API Monitoring" description="Operational alerts raised by platform modules, background worker jobs, and the platform's open-work counters." />

      <InfoNote title="Telemetry">
        Request throughput, latency and error-rate telemetry is not collected by the platform yet, so no traffic figures are shown.
        The counts below come from recorded alerts, jobs, incidents and webhooks.
      </InfoNote>

      <MutationNotice notice={props.notice} onReload={props.onReload} onDismiss={props.onDismissNotice} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CountKpi state={stats} count={(s) => num(s.unacknowledgedAlerts)} label="Unacknowledged Alerts" sublabel="Waiting for an operator" icon={BellRing} tone="rose" />
        <CountKpi state={stats} count={(s) => num(s.failedJobs)} label="Failed Jobs" sublabel="Background worker failures" icon={ServerCrash} tone="amber" />
        <CountKpi state={stats} count={(s) => num(s.openIncidents)} label="Open Incidents" sublabel="Not yet resolved" icon={Siren} tone="violet" />
        <CountKpi state={stats} count={(s) => num(s.pendingWebhooks)} label="Webhooks Retrying" sublabel="Inbound events pending" icon={AlertTriangle} tone="blue" />
      </div>
      {stats.status === "error" && (
        <div className="text-xs">
          <AdminButton size="xs" variant="outline" onClick={props.onRetryStats}>
            Counters failed to load. Retry
          </AdminButton>
        </div>
      )}

      <SurfaceCard className="overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Operational alerts</h3>
          <div className="w-44">
            <AdminSelect
              value={alertFilter}
              onChange={(e) => setAlertFilter(e.target.value)}
              aria-label="Filter alerts"
              options={[
                { label: "Unacknowledged", value: "OPEN" },
                { label: "Acknowledged", value: "ACKNOWLEDGED" },
                { label: "All Alerts", value: "ALL" },
              ]}
            />
          </div>
        </div>
        <ResourceStatus
          state={alerts}
          isEmpty={(d) => d.length === 0}
          onRetry={props.onRetryAlerts}
          emptyIcon={BellRing}
          emptyTitle="No operational alerts"
          emptyDescription="No platform module has raised an alert."
        />
        {alerts.status === "ready" && alerts.data.length > 0 && (
          alertRows.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--color-text-secondary)]">No alerts in this view.</p>
          ) : (
            <AdminTable label="Operational alerts" headers={["Alert", "Severity", "Source", "Department", "Raised", "State", ""]}>
              {alertPage.pageRows.map((a) => (
                <tr key={a.id}>
                  <td className={cellClass}>
                    <p className="font-semibold">{a.title}</p>
                    {a.message && <p className="text-[11px] text-[var(--color-text-secondary)] max-w-md">{a.message}</p>}
                  </td>
                  <td className={cellClass}>
                    <StatusBadge label={humanize(a.severity)} tone={severityTone(a.severity)} />
                  </td>
                  <td className={mutedCellClass}>{humanize(a.source_module)}</td>
                  <td className={mutedCellClass}>{departmentLabel(a.department_id)}</td>
                  <td className={mutedCellClass}>{formatInstant(a.created_at)}</td>
                  <td className={mutedCellClass}>{a.acknowledged ? `Acknowledged${a.acknowledged_by ? ` by ${a.acknowledged_by}` : ""}` : "Open"}</td>
                  <td className={cellClass}>
                    {!a.acknowledged && (
                      <AdminButton size="xs" variant="outline" disabled={Boolean(busy)} isLoading={busy === `ack:${a.id}`} onClick={() => props.onAcknowledge(a)}>
                        <Check className="w-3.5 h-3.5" />
                        Acknowledge
                      </AdminButton>
                    )}
                  </td>
                </tr>
              ))}
            </AdminTable>
          )
        )}
        {alertRows.length > 0 && <PaginationBar {...alertPage.barProps} />}
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Background jobs</h3>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Read-only. Failed outbound event deliveries can be retried from Webhooks &amp; Events.</p>
        </div>
        <ResourceStatus
          state={jobs}
          isEmpty={(d) => d.length === 0}
          onRetry={props.onRetryJobs}
          emptyIcon={Cog}
          emptyTitle="No background jobs"
          emptyDescription="No background job has been recorded."
        />
        {jobs.status === "ready" && jobs.data.length > 0 && (
          <AdminTable label="Background jobs" headers={["Job", "Queue", "Status", "Attempts", "Error", "Scheduled", "Completed"]}>
            {jobPage.pageRows.map((j) => (
              <tr key={j.id}>
                <td className={`${cellClass} font-semibold`}>{j.job_name}</td>
                <td className={mutedCellClass}>{j.queue_name}</td>
                <td className={cellClass}>
                  <StatusBadge label={humanize(j.status)} tone={j.status === "COMPLETED" ? "success" : getStatusTone(j.status)} dot />
                </td>
                <td className={mutedCellClass}>
                  {j.attempts} / {j.max_attempts}
                </td>
                <td className={`${mutedCellClass} max-w-xs break-words`}>{j.error_details || "-"}</td>
                <td className={mutedCellClass}>{formatInstant(j.scheduled_at)}</td>
                <td className={mutedCellClass}>{formatInstant(j.completed_at)}</td>
              </tr>
            ))}
          </AdminTable>
        )}
        {jobRows.length > 0 && <PaginationBar {...jobPage.barProps} />}
      </SurfaceCard>
    </div>
  );
}
