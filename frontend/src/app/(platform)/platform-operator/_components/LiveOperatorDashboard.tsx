"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Bell, LifeBuoy, RefreshCw, Webhook } from "lucide-react";

import { resolveApiBaseUrl } from "@/lib/api";

/** Stored operational counts (incidents, tickets, webhooks, jobs, alerts); nothing invented such as a health score. */
export interface OperatorStats {
  openIncidents: number;
  openTickets: number;
  pendingWebhooks: number;
  failedJobs: number;
  unacknowledgedAlerts: number;
  operationalStatus: string;
}

export function OperatorStatsContent({ stats }: { stats: OperatorStats }) {
  const tiles: { label: string; value: number; icon: React.ElementType }[] = [
    { label: "Open incidents", value: stats.openIncidents, icon: AlertTriangle },
    { label: "Open support tickets", value: stats.openTickets, icon: LifeBuoy },
    { label: "Webhooks retrying", value: stats.pendingWebhooks, icon: Webhook },
    { label: "Failed jobs", value: stats.failedJobs, icon: RefreshCw },
    { label: "Unacknowledged alerts", value: stats.unacknowledgedAlerts, icon: Bell },
  ];
  return (
    <div className="space-y-4">
      <p className="text-xs" data-testid="operator-status">
        Operational status: <span className="font-semibold">{stats.operationalStatus === "OPERATIONAL" ? "Operational" : "Degraded"}</span>
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {tiles.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
              <Icon className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)]">Uptime history, charts and per-tenant telemetry are not stored yet (Later).</p>
    </div>
  );
}

export function LiveOperatorDashboard() {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "ready"; stats: OperatorStats } | { kind: "error"; message: string }>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    // Operator sessions use their own httpOnly cookie, so the request only needs credentials included.
    fetch(`${resolveApiBaseUrl()}/v1/operator/dashboard/stats`, { credentials: "include", headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403
          ? "Sign in with a platform operator account to see operational data."
          : "Operational data could not be loaded.");
        return (await response.json()) as OperatorStats;
      })
      .then((stats) => { if (active) setState({ kind: "ready", stats }); })
      .catch((error: unknown) => { if (active) setState({ kind: "error", message: error instanceof Error ? error.message : "Operational data could not be loaded." }); });
    return () => { active = false; };
  }, [attempt]);
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Operations overview</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">Stored incidents, tickets, webhooks, jobs and alerts.</p>
      </div>
      {state.kind === "loading" && <p className="text-xs text-[var(--color-text-muted)]">Loading operational data…</p>}
      {state.kind === "error" && (
        <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <span>{state.message}</span>
          <button type="button" className="font-semibold" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
        </div>
      )}
      {state.kind === "ready" && <OperatorStatsContent stats={state.stats} />}
    </div>
  );
}
