"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function OperatorAlertsPage() {
  return (
    <PanelLayout title="System Alerts & PagerDuty" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Alerts" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Live Alert Feed</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Correlated infrastructure and application alerts</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
          <div className="flex justify-between">
            <span className="font-semibold text-sm">All monitors normal</span>
            <Badge variant="default" className="bg-green-600">GREEN</Badge>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">Zero active firing alerts across compute, database, and edge tiers.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
