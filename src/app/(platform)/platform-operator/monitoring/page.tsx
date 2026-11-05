"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Activity, ShieldCheck, Clock } from "lucide-react";

export default function PlatformOperatorMonitoringPage() {
  const metrics = [
    { service: "Web Client Cluster", latency: "42ms", uptime: "99.99%", status: "Healthy" },
    { service: "NestJS / Spring Boot API Gateway", latency: "68ms", uptime: "99.98%", status: "Healthy" },
    { service: "PostgreSQL Primary + Replicas", latency: "1.2ms", uptime: "100%", status: "Healthy" },
    { service: "BullMQ Job Consumer Workers", latency: "N/A", uptime: "99.95%", status: "Healthy" },
    { service: "GitHub Webhook Receptor", latency: "110ms", uptime: "99.90%", status: "Healthy" },
  ];

  return (
    <PanelLayout
      title="System Monitoring &amp; Telemetry"
      breadcrumb={[
        { label: "Platform Operator", href: "/platform-operator" },
        { label: "Monitoring" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Microservices Telemetry</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Real-time p95 read latency, consumer backlogs, and uptime monitoring.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {metrics.map((m, idx) => (
            <Card key={idx} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-app-text-primary">{m.service}</span>
                <Badge variant="success">{m.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-app-border">
                <div>
                  <span className="text-app-text-muted text-[10px]">Response Time</span>
                  <p className="font-mono font-bold text-app-text-primary mt-0.5">{m.latency}</p>
                </div>
                <div>
                  <span className="text-app-text-muted text-[10px]">30-Day Availability</span>
                  <p className="font-mono font-bold text-green-600 mt-0.5">{m.uptime}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}

