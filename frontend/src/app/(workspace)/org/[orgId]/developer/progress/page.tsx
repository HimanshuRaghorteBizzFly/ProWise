"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { Card } from "@/components/ui/card";

export default function DeveloperProgressTrackerPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Personal Progress Tracker" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Progress" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Progress Velocity</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Historical delivery velocity and check-in timeline</p>
        </div>
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <ProgressChart height={280} />
        </Card>
      </div>
    </PanelLayout>
  );
}
