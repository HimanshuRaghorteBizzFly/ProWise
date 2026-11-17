"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function LeadActivityPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { gitEvents } = useProjects(orgId);

  return (
    <PanelLayout title="Team Engineering Stream" breadcrumb={[{ label: "Team Lead", href: `/org/${orgId}/lead` }, { label: "Activity" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Team Commit & Review Stream</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Recent repository and task actions from assigned team members</p>
        </div>
        <div className="space-y-2">
          {gitEvents.map(e => (
            <Card key={e.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] text-xs flex justify-between">
              <div>
                <span className="font-semibold">{e.actor}:</span> {e.title}
              </div>
              <span className="text-[var(--color-text-muted)] font-mono">{e.repoName}</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
