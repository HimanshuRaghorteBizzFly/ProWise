"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { BarChart3, FileBarChart, FolderKanban, ShieldAlert, Users } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import type { Report } from "@/mocks/delivery-dashboards";
import { EmptyStateView, PageFrame, StatusBadge, SurfaceCard, formatDateTime, useDemoLoad, useRoleHref } from "@/components/delivery/DeliveryUI";
import { cn } from "@/lib/utils";

const KIND: Record<Report["kind"], { label: string; icon: React.ElementType; cls: string; tone: "info" | "violet" | "warning" | "success" }> = {
  PORTFOLIO: { label: "Portfolio", icon: FolderKanban, cls: "bg-blue-500/12 text-blue-600 dark:text-blue-400", tone: "info" },
  STATUS: { label: "Status", icon: FileBarChart, cls: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", tone: "success" },
  WORKLOAD: { label: "Workload", icon: Users, cls: "bg-violet-500/12 text-violet-600 dark:text-violet-400", tone: "violet" },
  RISK: { label: "Risk", icon: ShieldAlert, cls: "bg-amber-500/12 text-amber-600 dark:text-amber-400", tone: "warning" },
};

export default function ManagerReportsPage() {
  const href = useRoleHref("manager");
  const { status, retry, forceEmpty } = useDemoLoad();
  const allReports = useDeliveryStore((s) => s.reports);
  const reports = useMemo(() => (forceEmpty ? [] : allReports), [allReports, forceEmpty]);

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "Plan & report" }, { label: "Reports" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Reports"
      description="Generated status, portfolio, workload and risk reports. Open one to read it."
      status={status}
      onRetry={retry}
      skeleton="list"
    >
      {reports.length === 0 ? (
        <SurfaceCard><EmptyStateView icon={BarChart3} title="No reports yet" description="Weekly reports are generated every Monday at 07:00 UTC." /></SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
          {reports.map((r) => {
            const k = KIND[r.kind];
            const Icon = k.icon;
            return (
              <Link key={r.id} href={href(`reports/${r.id}`)} className="group block rounded-xl">
                <SurfaceCard className="h-full p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-blue-500/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center", k.cls)}><Icon className="w-4 h-4" /></span>
                    <StatusBadge label={k.label} tone={k.tone} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">{r.title}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{r.period}</p>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] line-clamp-3 flex-1">{r.summary}</p>
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--color-border)]">
                    {r.metrics.map((m) => (
                      <div key={m.label} className="min-w-0">
                        <p className="text-sm font-bold tabular-nums">{m.value}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] truncate">{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)]">Generated {formatDateTime(r.generatedAt)} UTC</p>
                </SurfaceCard>
              </Link>
            );
          })}
        </div>
      )}
    </PageFrame>
  );
}
