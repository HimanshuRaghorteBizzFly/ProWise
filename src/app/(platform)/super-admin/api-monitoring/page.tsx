"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Activity, Server } from "lucide-react";

export default function SuperAdminApiMonitoringPage() {
  return (
    <PanelLayout title="API & Gateway Monitoring" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "API Monitoring" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">API Gateway & Request Latency</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Real-time edge performance metrics, latency distribution, and error rates</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Req / sec (RPS)</span>
            <div className="text-2xl font-bold mt-1 text-primary-600">842 req/s</div>
          </Card>
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">p99 Response Latency</span>
            <div className="text-2xl font-bold mt-1 text-green-600">42 ms</div>
          </Card>
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Error Rate (5xx)</span>
            <div className="text-2xl font-bold mt-1 text-green-600">0.002%</div>
          </Card>
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Active Connections</span>
            <div className="text-2xl font-bold mt-1 text-primary-600">1,208</div>
          </Card>
        </div>
      </div>
    </PanelLayout>
  );
}
