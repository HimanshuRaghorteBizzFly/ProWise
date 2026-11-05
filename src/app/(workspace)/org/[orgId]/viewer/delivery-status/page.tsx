"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function ViewerDeliveryStatusPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { projects } = useProjects(orgId);

  return (
    <PanelLayout title="Delivery Status" breadcrumb={[{ label: "Viewer", href: `/org/${orgId}/viewer` }, { label: "Delivery Status" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Delivery Acceptance Milestones</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Read-only view of customer delivery readiness and acceptance sign-offs</p>
        </div>
        <div className="space-y-3">
          {projects.map(p => (
            <Card key={p.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center text-xs">
              <div>
                <span className="font-semibold text-sm">{p.name} ({p.key})</span>
                <p className="text-[var(--color-text-secondary)]">Target: {p.targetDate} • Progress: {p.lastProgressPercent}%</p>
              </div>
              <span className="font-mono text-primary-600 font-bold">{p.lifecycle}</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
