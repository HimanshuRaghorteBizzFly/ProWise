"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { ActivityChart } from "@/components/charts/ActivityChart";

export default function OperatorGitHubMonitoringPage() {
  return (
    <PanelLayout title="GitHub Ingestion Monitoring" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "GitHub" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Repository Ingestion Activity</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Webhook event rate, commits parsed, and PR status updates</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <ActivityChart height={260} />
        </Card>
      </div>
    </PanelLayout>
  );
}
