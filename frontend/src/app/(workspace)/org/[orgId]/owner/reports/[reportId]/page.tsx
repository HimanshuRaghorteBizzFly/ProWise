"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Download, FileBarChart, Lightbulb, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { AdminButton, NotFoundState, PageFrame, Panel, StatPill, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { HorizontalBarChart } from "@/components/delivery/DeliveryCharts";
import { OrgGate, useOrgHref } from "@/components/org-console/OrgUI";
import { downloadCsv, generateCsv } from "@/lib/csv";

export default function OwnerReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const href = useOrgHref("owner");
  const { status, retry } = useDemoLoad();
  const report = useOrgConsoleStore((s) => s.reports.find((r) => r.id === reportId && r.audience.includes("owner")));
  const projects = useOrgConsoleStore((s) => s.projects);
  const back = { href: href("reports"), label: "Back to reports" };
  const crumbs = [{ label: "Owner", href: href() }, { label: "Reports", href: href("reports") }, { label: report?.title ?? "Report" }];

  if (status === "ready" && !report) {
    return <OrgGate family="owner"><PageFrame crumbs={crumbs} back={back} title="Report"><NotFoundState what="Report" back={back} /></PageFrame></OrgGate>;
  }

  const exportCsv = () => {
    if (!report) return;
    downloadCsv(`${report.id}.csv`, generateCsv(["Metric", "Value"], report.metrics.map((m) => [m.label, m.value])));
    toast.success("Report exported as CSV");
  };

  return (
    <OrgGate family="owner" need="report.export">
      <PageFrame crumbs={crumbs} back={back} title={report?.title ?? "Report"} description={report ? `${report.period} · generated ${formatDateTime(report.generatedAt)} UTC` : undefined} status={status} onRetry={retry} skeleton="detail" actions={<AdminButton variant="outline" onClick={exportCsv}><Download className="w-3.5 h-3.5" /> Export CSV</AdminButton>}>
        {report && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{report.metrics.map((m) => <StatPill key={m.label} label={m.label} value={m.value} />)}</div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Panel className="xl:col-span-2" title="Summary" icon={FileBarChart}>
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{report.summary}</p>
              </Panel>
              <Panel title="Highlights" icon={Lightbulb} iconTone="amber">
                <ul className="space-y-2.5">{report.highlights.map((h) => <li key={h} className="flex items-start gap-2 text-xs"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />{h}</li>)}</ul>
              </Panel>
            </div>
            <Panel title="Portfolio progress" icon={TrendingUp} iconTone="emerald">
              <HorizontalBarChart max={100} valueLabel="Progress" data={projects.map((p) => ({ name: p.code, value: p.progress, color: p.color }))} />
            </Panel>
          </>
        )}
      </PageFrame>
    </OrgGate>
  );
}
