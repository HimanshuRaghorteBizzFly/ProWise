"use client";

import React, { useMemo } from "react";
import { FileBarChart } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { DataTable, PageFrame, StatusBadge, SurfaceCard, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { OrgGate, useOrgHref } from "@/components/org-console/OrgUI";

const KIND_TONE = { PORTFOLIO: "info", PEOPLE: "violet", ACCESS: "warning", INTEGRATION: "success", AUDIT: "danger" } as const;

export default function AdminReportsPage() {
  const href = useOrgHref("admin");
  const { status, retry, forceEmpty } = useDemoLoad();
  const all = useOrgConsoleStore((s) => s.reports);
  const reports = useMemo(() => (forceEmpty ? [] : all.filter((r) => r.audience.includes("admin"))), [all, forceEmpty]);

  return (
    <OrgGate family="admin" need="report.export">
      <PageFrame
        crumbs={[{ label: "Admin", href: href() }, { label: "Reports" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Reports"
        description="People, access, integration and portfolio reports you can open and export."
        status={status}
        onRetry={retry}
        skeleton="list"
      >
        <SurfaceCard className="overflow-hidden">
          <DataTable
            rows={reports}
            rowHref={(r) => href(`reports/${r.id}`)}
            empty={{ icon: FileBarChart, title: "No reports", description: "Reports generate every Monday at 07:00 UTC." }}
            columns={[
              { key: "t", header: "Report", className: "w-[60%] md:w-[40%]", render: (r) => <div className="min-w-0"><p className="font-semibold truncate">{r.title}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{r.summary}</p></div> },
              { key: "k", header: "Type", render: (r) => <StatusBadge label={r.kind[0] + r.kind.slice(1).toLowerCase()} tone={KIND_TONE[r.kind]} /> },
              { key: "p", header: "Period", hideBelow: "md", render: (r) => r.period },
              { key: "m", header: "Key metric", hideBelow: "lg", render: (r) => <span><b>{r.metrics[0].value}</b> {r.metrics[0].label}</span> },
              { key: "g", header: "Generated (UTC)", hideBelow: "xl", render: (r) => formatDateTime(r.generatedAt) },
            ]}
          />
        </SurfaceCard>
      </PageFrame>
    </OrgGate>
  );
}
