"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { CheckSquare } from "lucide-react";

export default function ManagerWorkItemsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { workItems } = useProjects(orgId);

  return (
    <PanelLayout title="Work Items Hierarchy" breadcrumb={[{ label: "Manager", href: `/org/${orgId}/manager` }, { label: "Work Items" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Structured Scope Hierarchy</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">5-level hierarchy: Project → Milestone → Deliverable → Task → Subtask</p>
        </div>
        <div className="space-y-2">
          {workItems.map(w => (
            <Card key={w.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-primary-600">{w.key}</span>
                <span className="font-semibold">{w.title}</span>
                <span className="rounded bg-[var(--color-sidebar)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">{w.type}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono">{w.weight} {w.weightUnit}</span>
                <span className="font-semibold text-primary-600">{w.state}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
