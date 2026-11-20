"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { HeartPulse, ShieldAlert, ShieldCheck } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS, type Severity } from "@/mocks/delivery-dashboards";
import {
  Avatar,
  EmptyStateView,
  HealthBadge,
  PageFrame,
  Panel,
  ProgressBar,
  SegmentTabs,
  SeverityBadge,
  SurfaceCard,
  formatDate,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { DonutChart } from "@/components/delivery/DeliveryCharts";

const ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const COLORS: Record<Severity, string> = { CRITICAL: "#E11D48", HIGH: "#F97316", MEDIUM: "#F59E0B", LOW: "#94A3B8" };

export default function ManagerRisksPage() {
  const href = useRoleHref("manager");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const allProjects = useDeliveryStore((s) => s.projects);
  const [sev, setSev] = useState<"ALL" | Severity>("ALL");

  const projects = useMemo(
    () => (forceEmpty ? [] : allProjects.filter((p) => p.managerId === VIEWERS.manager.id)),
    [allProjects, forceEmpty]
  );
  const risks = useMemo(
    () => projects.flatMap((p) => p.risks.map((r) => ({ ...r, project: p }))).sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity)),
    [projects]
  );
  const shown = risks.filter((r) => sev === "ALL" || r.severity === sev);

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "Overview" }, { label: "Health & risks" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Health & risks"
      description="Project health signals and the risk register for your portfolio."
      status={status}
      onRetry={retry}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3.5">
        {projects.map((p) => (
          <Link key={p.id} href={href(`projects/${p.id}`)} className="group block rounded-xl">
            <SurfaceCard className="h-full p-3.5 space-y-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/40">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold truncate">{p.name}</span>
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.health === "ON_TRACK" ? "#10B981" : p.health === "AT_RISK" ? "#F59E0B" : "#EF4444" }} />
              </div>
              <HealthBadge health={p.health} />
              <ProgressBar value={p.progress} planned={p.plannedProgress} color={p.color} size="sm" showLabel />
              <p className="text-[11px] text-[var(--color-text-muted)]">{p.risks.length} risk{p.risks.length === 1 ? "" : "s"} · budget {p.budgetUsed}%</p>
            </SurfaceCard>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Risks by severity" icon={HeartPulse} iconTone="rose">
          <DonutChart centerLabel="open risks" data={ORDER.map((s) => ({ name: s[0] + s.slice(1).toLowerCase(), value: risks.filter((r) => r.severity === s).length, color: COLORS[s] }))} />
        </Panel>
        <Panel
          className="xl:col-span-2"
          title="Risk register"
          description="Click a risk to open its project"
          icon={ShieldAlert}
          iconTone="amber"
          action={
            <SegmentTabs<"ALL" | Severity>
              value={sev}
              onChange={setSev}
              options={[{ value: "ALL", label: "All" }, { value: "CRITICAL", label: "Critical" }, { value: "HIGH", label: "High" }, { value: "MEDIUM", label: "Med" }]}
            />
          }
        >
          {shown.length === 0 ? (
            <EmptyStateView icon={ShieldCheck} title="No risks here" description="No open risks match this severity." />
          ) : (
            <div className="space-y-2.5">
              {shown.map((r) => (
                <Link key={r.id} href={href(`projects/${r.project.id}`)} className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:border-blue-500/40">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{r.title}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{r.project.name} · raised {formatDate(r.raisedAt)}</p>
                    </div>
                    <SeverityBadge severity={r.severity} />
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">{r.mitigation}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                    <Avatar person={lk.person(r.ownerId)} size="sm" /> Owner {lk.person(r.ownerId)?.name}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </PageFrame>
  );
}
