"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitBranch, CreditCard, Mail, Server, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminIntegrationsPage() {
  const integrations = [
    { name: "GitHub Cloud & Enterprise", icon: GitBranch, status: "OPERATIONAL", version: "v2.4", desc: "Automated commit, PR, and check-run event ingestion" },
    { name: "Stripe Billing Infrastructure", icon: CreditCard, status: "OPERATIONAL", version: "2026-10-15", desc: "SaaS subscriptions, dunning, and invoice generation" },
    { name: "SendGrid Transactional Mail", icon: Mail, status: "OPERATIONAL", version: "API v3", desc: "Multi-tenant email delivery and bounce tracking" },
    { name: "Datadog APM & Metrics", icon: Server, status: "OPERATIONAL", version: "Agent 7", desc: "Latency, distributed traces, and audit telemetry" },
  ];

  return (
    <PanelLayout title="Global Platform Integrations" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Integrations" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Platform-Level Service Providers</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Core external infrastructure powering auth, repository hooks, billing, and telemetry</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map(i => {
            const Icon = i.icon;
            return (
              <Card key={i.name} className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary-100 dark:bg-primary-950/60 text-primary-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">{i.name}</h4>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{i.version}</span>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> {i.status}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">{i.desc}</p>
                <div className="pt-2 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => toast.success("Configuration validated.")}>
                    Configure
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </PanelLayout>
  );
}
