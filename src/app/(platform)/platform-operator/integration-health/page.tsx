"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

export default function OperatorIntegrationHealthPage() {
  const services = [
    { name: "GitHub API Gateway", status: "HEALTHY", latency: "64 ms", uptime: "99.99%" },
    { name: "Stripe Webhook Egress", status: "HEALTHY", latency: "112 ms", uptime: "100%" },
    { name: "SendGrid SMTP Relay", status: "HEALTHY", latency: "45 ms", uptime: "99.98%" },
    { name: "PostgreSQL Primary Pool", status: "HEALTHY", latency: "2 ms", uptime: "100%" },
  ];

  return (
    <PanelLayout title="Integration Health" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Integration Health" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">External Service Status</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Active health probes and response telemetry</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map(s => (
            <Card key={s.name} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{s.name}</span>
                <Badge variant="default" className="bg-green-600">{s.status}</Badge>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] flex justify-between">
                <span>Latency: {s.latency}</span>
                <span>Uptime 30d: {s.uptime}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
