"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { Download, FileBarChart, Lightbulb, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useDeliveryStore } from "@/store/delivery-store";
import { MANAGER_THROUGHPUT, VIEWERS } from "@/mocks/delivery-dashboards";
import { AdminButton, NotFoundState, PageFrame, Panel, StatPill, formatDateTime, useDemoLoad, useRoleHref } from "@/components/delivery/DeliveryUI";
import { GroupedBarChart, HorizontalBarChart } from "@/components/delivery/DeliveryCharts";
import { downloadCsv, generateCsv } from "@/lib/csv";

export default function ManagerReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const href = useRoleHref("manager");
  const { status, retry } = useDemoLoad();
  const report = useDeliveryStore((s) => s.reports.find((r) => r.id === reportId));
  const allProjects = useDeliveryStore((s) => s.projects);
  const projects = useMemo(() => allProjects.filter((p) => p.managerId === VIEWERS.manager.id), [allProjects]);
  const back = { href: href("reports"), label: "Back to reports" };
  const crumbs = [{ label: "Manager", href: href() }, { label: "Reports", href: href("reports") }, { label: report?.title ?? "Report" }];

  if (status === "ready" && !report) {
    return <PageFrame crumbs={crumbs} back={back} title="Report"><NotFoundState what="Report" back={back} /></PageFrame>;
  }

  const exportCsv = () => {
    if (!report) return;
    downloadCsv(
      `${report.id}.csv`,
      generateCsv(
        ["Project", "Health", "Progress %", "Planned %", "Due"],
        projects.map((p) => [p.name, p.health, p.progress, p.plannedProgress, p.dueDate])
      )
    );
    toast.success("Report exported as CSV");
  };

  return (
    <PageFrame
      crumbs={crumbs}
      back={back}
      title={report?.title ?? "Report"}
      description={report ? `${report.period} · generated ${formatDateTime(report.generatedAt)} UTC` : undefined}
      status={status}
      onRetry={retry}
      skeleton="detail"
      actions={<AdminButton variant="outline" onClick={exportCsv}><Download className="w-3.5 h-3.5" /> Export CSV</AdminButton>}
    >
      {report && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {report.metrics.map((m) => <StatPill key={m.label} label={m.label} value={m.value} />)}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Panel className="xl:col-span-2" title="Summary" icon={FileBarChart}>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{report.summary}</p>
              <div className="mt-4">
                <HorizontalBarChart data={projects.map((p) => ({ name: p.code, value: p.progress, color: p.color }))} max={100} valueLabel="Progress" />
              </div>
            </Panel>
            <Panel title="Highlights" icon={Lightbulb} iconTone="amber">
              <ul className="space-y-2.5">
                {report.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <Panel title="Throughput trend" description="Completed vs added tasks, last 6 weeks" icon={TrendingUp} iconTone="emerald">
            <GroupedBarChart data={MANAGER_THROUGHPUT} primaryLabel="Completed" secondaryLabel="Added" primaryColor="#10B981" secondaryColor="#F59E0B" />
          </Panel>
        </>
      )}
    </PageFrame>
  );
}
