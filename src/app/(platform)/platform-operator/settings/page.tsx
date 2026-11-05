"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function OperatorSettingsPage() {
  return (
    <PanelLayout title="Operator Preferences" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Settings" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Operator Station Configuration</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Alert routing destinations and telemetry refresh frequency</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold block">Dashboard Polling Interval</label>
            <select className="border border-[var(--color-border)] bg-[var(--color-surface)] p-2 rounded text-xs">
              <option>Every 10 seconds</option>
              <option>Every 30 seconds</option>
              <option>Manual refresh only</option>
            </select>
          </div>
          <Button size="sm" onClick={() => toast.success("Operator settings saved")}>Save Preferences</Button>
        </Card>
      </div>
    </PanelLayout>
  );
}
