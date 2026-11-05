"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { WorkloadChart } from "@/components/charts/WorkloadChart";
import { Card } from "@/components/ui/card";

export default function LeadWorkloadPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Team Workload Balance" breadcrumb={[{ label: "Team Lead", href: `/org/${orgId}/lead` }, { label: "Workload" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Capacity vs Planned Workload</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Hours planned vs available hours (strictly distinct from points per V1.1)</p>
        </div>
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <WorkloadChart height={280} />
        </Card>
      </div>
    </PanelLayout>
  );
}
