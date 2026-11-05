"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function OperatorBackupsPage() {
  return (
    <PanelLayout title="Database Backups & Snapshots" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Backups" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Automated Daily Snapshots</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Point-in-time recovery points and cross-region backups</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
          <div className="flex justify-between">
            <span className="font-semibold text-sm">Automated Snapshot: snap-2026-11-05-0300</span>
            <Badge variant="default" className="bg-green-600">VERIFIED</Badge>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">Completed at 03:14 UTC • Size: 4.8 GB • Retention: 30 days</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
