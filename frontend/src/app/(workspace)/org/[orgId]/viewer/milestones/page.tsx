"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { Calendar } from "lucide-react";

export default function ViewerMilestonesPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { workItems } = useProjectStore();

  const milestones = workItems.filter((w) => w.type === "MILESTONE");

  return (
    <PanelLayout
      title="Key Delivery Milestones"
      breadcrumb={[
        { label: "Viewer", href: `/org/${orgId}/viewer` },
        { label: "Milestones" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Delivery Milestones (Read-Only)</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            High-level roadmap milestones across structured engineering initiatives.
          </p>
        </div>

        <div className="space-y-4">
          {milestones.map((m) => (
            <Card key={m.id} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-blue-600">{m.key}</span>
                  <h3 className="font-bold text-sm text-app-text-primary">{m.title}</h3>
                </div>
                <Badge variant={m.state === "DONE" ? "success" : "warning"}>
                  {m.state}
                </Badge>
              </div>

              <p className="text-xs text-app-text-secondary">{m.description}</p>

              <div className="pt-2 border-t border-app-border text-xs text-app-text-muted flex items-center justify-between">
                <span>Criteria: {m.criteria}</span>
                <span>Due Date: {m.dueDate || "Nov 30, 2026"}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}

