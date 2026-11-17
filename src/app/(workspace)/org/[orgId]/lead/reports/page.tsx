"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function LeadReportsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Team Delivery Reports" breadcrumb={[{ label: "Team Lead", href: `/org/${orgId}/lead` }, { label: "Reports" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Team Quality & Completion Metrics</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Review rejection rates, rework cycle time, and milestone delivery</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">Average review cycle time: 4.2 hours • First-pass approval rate: 89%</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
