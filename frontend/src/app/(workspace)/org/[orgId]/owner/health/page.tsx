"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { HeartPulse, ShieldAlert, ShieldCheck } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import type { OrgRisk } from "@/mocks/org-console";
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
} from "@/components/delivery/DeliveryUI";
import { DonutChart, GroupedBarChart } from "@/components/delivery/DeliveryCharts";
import { OrgGate, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

type Sev = "ALL" | OrgRisk["severity"];
const ORDER: OrgRisk["severity"][] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const COLOR = { CRITICAL: "#E11D48", HIGH: "#F97316", MEDIUM: "#F59E0B", LOW: "#94A3B8" };

export default function OwnerHealthPage() {
  const href = useOrgHref("owner");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const allProjects = useOrgConsoleStore((s) => s.projects);
  const allRisks = useOrgConsoleStore((s) => s.risks);
  const teams = useOrgConsoleStore((s) => s.teams);
  const [sev, setSev] = useState<Sev>("ALL");
  const projects = useMemo(() => (forceEmpty ? [] : allProjects), [allProjects, forceEmpty]);
  const risks = useMemo(() => (forceEmpty ? [] : [...allRisks].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))), [allRisks, forceEmpty]);
  const shown = risks.filter((r) => sev === "ALL" || r.severity === sev);

  return (
    <OrgGate family="owner" need="project.read">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Health & risks" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Health & risks"
        description="Health of every project and the company-wide risk register."
        status={status}
        onRetry={retry}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8 gap-3">
          {projects.map((p) => (
            <Link key={p.id} href={href(`projects/${p.id}`)} className="block rounded-xl">
              <SurfaceCard className="h-full p-3 space-y-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/40">
                <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold" style={{ color: p.color }}>{p.code}</span><HealthBadge health={p.health} /></div>
                <p className="text-xs font-semibold truncate">{p.name}</p>
                <ProgressBar value={p.progress} planned={p.plannedProgress} color={p.color} size="sm" showLabel />
              </SurfaceCard>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel title="Risks by severity" icon={HeartPulse} iconTone="rose">
            <DonutChart centerLabel="risks" data={ORDER.map((s) => ({ name: s[0] + s.slice(1).toLowerCase(), value: risks.filter((r) => r.severity === s).length, color: COLOR[s] }))} />
          </Panel>
          <Panel className="xl:col-span-2" title="Health by team" description="Projects on track vs needing attention" icon={HeartPulse} iconTone="teal">
            <GroupedBarChart
              data={teams.map((t) => ({ label: t.name.split(" ")[0], primary: projects.filter((p) => p.teamId === t.id && p.health === "ON_TRACK").length, secondary: projects.filter((p) => p.teamId === t.id && p.health !== "ON_TRACK").length }))}
              primaryLabel="On track"
              secondaryLabel="At risk / off track"
              primaryColor="#10B981"
              secondaryColor="#F43F5E"
            />
          </Panel>
        </div>
        <Panel
          title="Risk register"
          description="Click a risk to open its project"
          icon={ShieldAlert}
          iconTone="amber"
          action={<SegmentTabs<Sev> value={sev} onChange={setSev} options={[{ value: "ALL", label: "All", count: risks.length }, { value: "CRITICAL", label: "Critical" }, { value: "HIGH", label: "High" }, { value: "MEDIUM", label: "Med" }]} />}
        >
          {shown.length === 0 ? (
            <EmptyStateView icon={ShieldCheck} title="No risks here" description="No open risks match this filter." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {shown.map((r) => (
                <Link key={r.id} href={href(`projects/${r.projectId}`)} className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:border-blue-500/40">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0"><p className="text-xs font-semibold">{r.title}</p><p className="text-[11px] text-[var(--color-text-muted)]">{lk.project(r.projectId)?.name} · raised {formatDate(r.raisedAt)}</p></div>
                    <SeverityBadge severity={r.severity} />
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">{r.mitigation}</p>
                  <p className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]"><Avatar person={lk.member(r.ownerId)} size="sm" />Owner {lk.member(r.ownerId)?.name}</p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </PageFrame>
    </OrgGate>
  );
}
