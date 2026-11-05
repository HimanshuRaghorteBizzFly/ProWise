"use client";
import React, { useState } from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function OperatorIncidentsPage() {
  const [incidents] = useState([
    { id: "inc-101", title: "GitHub Webhook Delivery Backlog", severity: "MAJOR", status: "MONITORING", impact: "Repo sync delayed by ~3 mins", created: "45 mins ago" },
    { id: "inc-102", title: "EU Primary Database Read Replica High Memory", severity: "MINOR", status: "RESOLVED", impact: "None, auto-scaled", created: "4 hours ago" },
  ]);

  return (
    <PanelLayout title="Incident Management Console" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Incidents" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Platform Incidents</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Manage active service disruptions and post-mortem mitigation items</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Opening incident declaration wizard...")}>
            <Plus className="w-4 h-4 mr-1.5" /> Declare Incident
          </Button>
        </div>

        <div className="space-y-3">
          {incidents.map(inc => (
            <Card key={inc.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-sm">{inc.title}</span>
                  <Badge variant={inc.severity === "MAJOR" ? "danger" : "secondary"}>{inc.severity}</Badge>

                </div>
                <Badge variant={inc.status === "RESOLVED" ? "default" : "outline"} className={inc.status === "RESOLVED" ? "bg-green-600" : ""}>
                  {inc.status}
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">Impact: {inc.impact} • Created {inc.created}</p>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
