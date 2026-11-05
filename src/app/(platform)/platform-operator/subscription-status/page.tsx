"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function OperatorSubscriptionStatusPage() {
  return (
    <PanelLayout title="Subscription Health" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Subscriptions" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Tenant Subscription Health</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Active plans, expiring trials, and seats usage</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">All 24 active tenants have valid payment methods on file.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
