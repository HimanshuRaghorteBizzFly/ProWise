"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function OperatorPaymentFailuresPage() {
  return (
    <PanelLayout title="Payment Dunning & Failures" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Payment Failures" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Dunning Failures</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Tenants with failed renewal charges</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">1 tenant currently in automated 7-day payment retry window (Nova Dynamics AI).</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
