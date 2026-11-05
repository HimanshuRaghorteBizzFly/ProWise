"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function OperatorApiErrorsPage() {
  return (
    <PanelLayout title="API Error Logs & Traces" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "API Errors" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">5xx Unhandled Server Exceptions</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Correlated OpenTelemetry traces and error stacks</p>
        </div>
        <Card className="p-6 text-center border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">No unhandled exceptions recorded in the last 24 hours.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
