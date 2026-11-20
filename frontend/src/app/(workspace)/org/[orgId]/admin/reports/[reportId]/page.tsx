"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Download, FileBarChart, Lightbulb, Users } from "lucide-react";
import { toast } from "sonner";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { AdminButton, NotFoundState, PageFrame, Panel, StatPill, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { DonutChart } from "@/components/delivery/DeliveryCharts";
import { OrgGate, useOrgHref } from "@/components/org-console/OrgUI";
import { downloadCsv, generateCsv } from "@/lib/csv";

export default function AdminReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const href = useOrgHref("admin");
  const { status, retry } = useDemoLoad();
  // Owner-only reports are not visible to admins: treated as not found.
  const report = useOrgConsoleStore((s) => s.reports.find((r) => r.id === reportId && r.audience.includes("admin")));
  const members = useOrgConsoleStore((s) => s.members);
  const roles = useOrgConsoleStore((s) => s.roles);
  const back = { href: href("reports"), label: "Back to reports" };
  const crumbs = [{ label: "Admin", href: href() }, { label: "Reports", href: href("reports") }, { label: report?.title ?? "Report" }];

  if (status === "ready" && !report) {
    return <OrgGate family="admin"><PageFrame crumbs={crumbs} back={back} title="Report"><NotFoundState what="Report" back={back} /></PageFrame></OrgGate>;
  }

  const exportCsv = () => {
    if (!report) return;
    downloadCsv(`${report.id}.csv`, generateCsv(["Metric", "Value"], report.metrics.map((m) => [m.label, m.value])));
    toast.success("Report exported as CSV");
  };

  return (
    <OrgGate family="admin" need="report.export">
      <PageFrame crumbs={crumbs} back={back} title={report?.title ?? "Report"} description={report ? `${report.period} · generated ${formatDateTime(report.generatedAt)} UTC` : undefined} status={status} onRetry={retry} skeleton="detail" actions={<AdminButton variant="outline" onClick={exportCsv}><Download className="w-3.5 h-3.5" /> Export CSV</AdminButton>}>
        {report && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{report.metrics.map((m) => <StatPill key={m.label} label={m.label} value={m.value} />)}</div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Panel className="xl:col-span-2" title="Summary" icon={FileBarChart}><p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{report.summary}</p>
                <ul className="mt-4 space-y-2">{report.highlights.map((h) => <li key={h} className="flex items-start gap-2 text-xs"><Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />{h}</li>)}</ul>
              </Panel>
              <Panel title="Members by role" icon={Users} iconTone="violet">
                <DonutChart height={170} centerLabel="members" data={roles.map((r) => ({ name: r.name, value: members.filter((m) => m.roleId === r.id).length, color: r.color })).filter((x) => x.value > 0)} />
              </Panel>
            </div>
          </>
        )}
      </PageFrame>
    </OrgGate>
  );
}
