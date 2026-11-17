"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function LeadAssignmentsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { workItems } = useProjects(orgId);

  return (
    <PanelLayout title="Work Item Assignments" breadcrumb={[{ label: "Team Lead", href: `/org/${orgId}/lead` }, { label: "Assignments" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Assignee Distribution</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Primary assignees, reviewers, and collaborators</p>
        </div>
        <div className="space-y-2">
          {workItems.map(w => (
            <Card key={w.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center text-xs">
              <span className="font-semibold">{w.key}: {w.title}</span>
              <span className="text-[var(--color-text-secondary)]">Assignee: {w.primaryAssigneeId || "Unassigned"}</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
