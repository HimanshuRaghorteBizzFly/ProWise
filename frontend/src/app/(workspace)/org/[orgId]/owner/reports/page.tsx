"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { FileBarChart, FolderKanban, GitBranch, ShieldCheck, Users, Activity } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import type { OrgReport } from "@/mocks/org-console";
import { EmptyStateView, PageFrame, StatusBadge, SurfaceCard, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { OrgGate, useOrgHref } from "@/components/org-console/OrgUI";
import { cn } from "@/lib/utils";

const KIND: Record<OrgReport["kind"], { label: string; icon: React.ElementType; cls: string }> = {
  PORTFOLIO: { label: "Portfolio", icon: FolderKanban, cls: "bg-blue-500/12 text-blue-600 dark:text-blue-400" },
  PEOPLE: { label: "People", icon: Users, cls: "bg-violet-500/12 text-violet-600 dark:text-violet-400" },
  ACCESS: { label: "Access", icon: ShieldCheck, cls: "bg-amber-500/12 text-amber-600 dark:text-amber-400" },
  INTEGRATION: { label: "Integration", icon: GitBranch, cls: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400" },
  AUDIT: { label: "Audit", icon: Activity, cls: "bg-rose-500/12 text-rose-600 dark:text-rose-400" },
};

export default function OwnerReportsPage() {
  const href = useOrgHref("owner");
  const { status, retry, forceEmpty } = useDemoLoad();
  const all = useOrgConsoleStore((s) => s.reports);
  const reports = useMemo(() => (forceEmpty ? [] : all.filter((r) => r.audience.includes("owner"))), [all, forceEmpty]);

  return (
    <OrgGate family="owner" need="report.export">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Reports" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Reports"
        description="Company-wide reports, including owner-only security summaries."
        status={status}
        onRetry={retry}
        skeleton="list"
      >
        {reports.length === 0 ? (
          <SurfaceCard><EmptyStateView icon={FileBarChart} title="No reports yet" description="Reports generate every Monday at 07:00 UTC." /></SurfaceCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {reports.map((r) => {
              const k = KIND[r.kind];
              return (
                <Link key={r.id} href={href(`reports/${r.id}`)} className="group block rounded-xl">
                  <SurfaceCard className="h-full p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-blue-500/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center", k.cls)}><k.icon className="w-4 h-4" /></span>
                      <span className="flex gap-1.5">{!r.audience.includes("admin") && <StatusBadge label="Owner only" tone="warning" />}<StatusBadge label={k.label} tone="info" /></span>
                    </div>
                    <div><p className="text-sm font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">{r.title}</p><p className="text-[11px] text-[var(--color-text-muted)]">{r.period}</p></div>
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-3 flex-1">{r.summary}</p>
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--color-border)]">
                      {r.metrics.map((m) => <div key={m.label} className="min-w-0"><p className="text-sm font-bold tabular-nums">{m.value}</p><p className="text-[10px] text-[var(--color-text-muted)] truncate">{m.label}</p></div>)}
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Generated {formatDateTime(r.generatedAt)} UTC</p>
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>
        )}
      </PageFrame>
    </OrgGate>
  );
}
