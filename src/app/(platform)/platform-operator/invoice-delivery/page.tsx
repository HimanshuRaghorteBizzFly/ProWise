"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function OperatorInvoiceDeliveryPage() {
  return (
    <PanelLayout title="Invoice Dispatch" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Invoice Delivery" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Invoice PDF Generation Logs</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Dispatch queue for billing contacts</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">All November invoices generated and delivered successfully.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
