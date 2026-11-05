"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function OperatorSyncJobsPage() {
  return (
    <PanelLayout title="Scheduled Background Workers" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Sync Jobs" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Platform Sync Workers</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Nightly calendar recalculations, grace day evaluations, and health updates</p>
        </div>
        <div className="space-y-3">
          <Card className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center">
            <div>
              <h4 className="text-sm font-semibold">Nightly Health Evaluation Job</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">Runs at 00:00 per org timezone • Grace days & weekend calendars</p>
            </div>
            <Badge variant="default" className="bg-green-600">IDLE (SUCCESS)</Badge>
          </Card>
        </div>
      </div>
    </PanelLayout>
  );
}
