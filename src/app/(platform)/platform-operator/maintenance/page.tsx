"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function OperatorMaintenancePage() {
  return (
    <PanelLayout title="Maintenance Mode & Schedules" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Maintenance" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Platform Maintenance Windows</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Control read-only state and maintenance banners</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.info("Maintenance scheduler opened.")}>
            Schedule Window
          </Button>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">Next maintenance window: Sunday Nov 8, 02:00 - 04:00 UTC (Read-only mode disabled).</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
