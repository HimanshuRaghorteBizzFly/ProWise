"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, BarChart3, FolderKanban, Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AdminInput, AdminSelect, EmptyStateView, PageFrame, Panel, StatPill, StatusBadge } from "@/components/delivery/DeliveryUI";
import { DevGate, dateText } from "@/components/developer/DevUI";
import type { ProgressRowDto } from "@/types/flow";
import { ProgressFigure } from "./FlowUI";
import { useProgressOverview } from "./useFlowApi";

/**
 * Progress of every project the caller can see (server-filtered), each with its method: Team = approved points of
 * the active scope ("approved points, 30 of 100"); Solo = the approved submission. "Not reported" while nothing is
 * approved; a Solo figure waiting for review is shown separately and never blended in. Refreshes on window focus.
 */
export function ProgressOverviewView({ orgId, roleLabel, home, projectHref }: {
  orgId: string;
  roleLabel: string;
  home: string;
  /** Where a project row links to (null = no link for this role). */
  projectHref: ((projectId: string) => string) | null;
}) {
  const overview = useProgressOverview(orgId);
  return (
    <PageFrame crumbs={[{ label: roleLabel, href: home }, { label: "Progress" }]} title="Progress"
      description="Approved progress per project, labelled with its method. Git activity, time and task counts never set progress.">
      <DevGate state={overview} what="Project progress" back={{ href: home, label: "Back to dashboard" }}>
        {(rows) => <ProgressOverview rows={rows} projectHref={projectHref} />}
      </DevGate>
    </PageFrame>
  );
}

export function ProgressOverview({ rows, projectHref }: { rows: ProgressRowDto[]; projectHref: ((projectId: string) => string) | null }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("");
  const shown = useMemo(() => rows.filter((r) =>
    (!mode || r.mode === mode) && (!query.trim() || `${r.key} ${r.name}`.toLowerCase().includes(query.trim().toLowerCase()))), [rows, query, mode]);
  const reported = shown.filter((r) => r.percent !== null);
  const awaiting = shown.reduce((n, r) => n + r.in_review + (r.pending_percent !== null ? 1 : 0), 0);
  const blockers = shown.reduce((n, r) => n + r.open_blockers, 0);

  if (rows.length === 0) {
    return <EmptyStateView icon={FolderKanban} title="No projects to show" description="Projects you can see appear here with their approved progress." />;
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatPill label="Projects" value={shown.length} />
        <StatPill label="With approved progress" value={reported.length} tone="success" />
        <StatPill label="Waiting for review" value={awaiting} tone={awaiting > 0 ? "warning" : "neutral"} />
        <StatPill label="Open blockers" value={blockers} tone={blockers > 0 ? "danger" : "neutral"} />
      </div>

      {reported.length > 0 && (
        <Panel title="Approved progress" icon={BarChart3} iconTone="blue" description="Only approved figures are charted.">
          <div style={{ width: "100%", height: Math.max(160, reported.length * 36) }} role="img"
            aria-label={`Approved progress: ${reported.map((r) => `${r.key} ${r.percent}%`).join(", ")}`}>
            <ResponsiveContainer>
              <BarChart data={reported.map((r) => ({ name: r.key, percent: r.percent }))} layout="vertical"
                margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} tickLine={false}
                  axisLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", borderRadius: "8px",
                  fontSize: "12px", color: "var(--color-text-primary)" }} formatter={(value) => [`${value}%`, "Approved"]} />
                <Bar dataKey="percent" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Approved" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      <Panel title="Projects" icon={Activity} iconTone="emerald">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" aria-hidden="true" />
              <AdminInput aria-label="Search projects" placeholder="Search projects" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <AdminSelect aria-label="Delivery mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">Solo and Team</option>
              <option value="STRUCTURED">Team</option>
              <option value="INDIVIDUAL">Solo</option>
            </AdminSelect>
          </div>
          {shown.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No projects match.</p>
          ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="progress-rows">
              {shown.map((r) => (
                <li key={r.project_id} className="rounded-xl border border-[var(--color-border)] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    {projectHref ? (
                      <Link href={projectHref(r.project_id)} className="text-xs font-semibold truncate hover:underline">
                        <span className="font-mono text-blue-600 dark:text-blue-400">{r.key}</span> · {r.name}
                      </Link>
                    ) : (
                      <span className="text-xs font-semibold truncate"><span className="font-mono">{r.key}</span> · {r.name}</span>
                    )}
                    <StatusBadge label={r.mode === "STRUCTURED" ? "Team" : "Solo"} tone={r.mode === "STRUCTURED" ? "info" : "violet"} />
                  </div>
                  <ProgressFigure percent={r.percent} label={r.label} method={r.method_label} pending={r.pending_percent} compact />
                  {r.mode === "STRUCTURED" && (
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {r.todo} created · {r.in_progress} in progress · {r.in_review} in review · {r.done} completed
                      {r.open_blockers > 0 ? ` · ${r.open_blockers} open blocker${r.open_blockers === 1 ? "" : "s"}` : ""}
                    </p>
                  )}
                  <p className="text-[10px] text-[var(--color-text-muted)]">Target {r.target_on ? dateText(r.target_on) : "not set"}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
