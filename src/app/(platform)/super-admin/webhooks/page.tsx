"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Webhook, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SuperAdminWebhooksPage() {
  const webhooks = [
    { endpoint: "/api/webhooks/github", source: "GitHub", events: "push, pull_request, check_run", deliveries: "99.98%", status: "HEALTHY" },
    { endpoint: "/api/webhooks/stripe", source: "Stripe", events: "invoice.paid, payment_intent.succeeded", deliveries: "100%", status: "HEALTHY" },
    { endpoint: "/api/webhooks/sendgrid", source: "SendGrid", events: "delivered, bounce, spam_report", deliveries: "99.85%", status: "HEALTHY" },
  ];

  return (
    <PanelLayout title="Global Webhooks" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Webhooks" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Inbound Webhook Handlers</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Platform ingress pipelines and signature verification health</p>
        </div>

        <div className="space-y-3">
          {webhooks.map(w => (
            <Card key={w.endpoint} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-primary-600" />
                  <span className="font-mono text-xs font-bold">{w.endpoint}</span>
                  <Badge variant="outline">{w.source}</Badge>
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] font-mono">Listens for: {w.events}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-green-600">{w.deliveries} success</span>
                <Badge variant="default" className="bg-green-600">{w.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
