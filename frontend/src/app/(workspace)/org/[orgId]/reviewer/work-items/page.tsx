"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function ReviewerWorkItemsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { workItems } = useProjects(orgId);

  return (
    <PanelLayout title="Work Items In Review" breadcrumb={[{ label: "QA Reviewer", href: `/org/${orgId}/reviewer` }, { label: "Work Items" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Work Items Audit</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Inspect acceptance criteria versions and review logs</p>
        </div>
        <div className="space-y-2">
          {workItems.map(w => (
            <Card key={w.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center text-xs">
              <span className="font-semibold">{w.key}: {w.title}</span>
              <span className="font-mono text-primary-600 font-bold">{w.state}</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
