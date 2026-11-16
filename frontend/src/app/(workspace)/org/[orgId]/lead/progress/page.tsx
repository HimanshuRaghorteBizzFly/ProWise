"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { Card } from "@/components/ui/card";

export default function LeadProgressPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Team Velocity & Progress" breadcrumb={[{ label: "Team Lead", href: `/org/${orgId}/lead` }, { label: "Progress" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Team Burnup & Velocity</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Real-time baseline leaf completion progress across all squad projects</p>
        </div>
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <ProgressChart height={260} />
        </Card>
      </div>
    </PanelLayout>
  );
}
