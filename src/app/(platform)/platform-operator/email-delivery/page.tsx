"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function OperatorEmailDeliveryPage() {
  return (
    <PanelLayout title="Email Ingestion & Delivery" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Email Delivery" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Outbound Delivery Metrics</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Delivery status, bounces, and reputation score: 99.8%</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">1,420 emails dispatched today with 0 hard bounces.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
