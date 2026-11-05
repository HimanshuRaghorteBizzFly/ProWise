"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { useProjects } from "@/hooks/useProjects";
import { ProgressHistory } from "@/components/developer/ProgressHistory";

export default function IndividualCheckInsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { checkIns, projects } = useProjects(orgId);
  const project = projects.find(p => p.id === projectId);
  const pCheckIns = checkIns.filter(c => c.projectId === projectId);

  return (
    <PanelLayout title="Check-In Audit Log" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: project?.name || "Project", href: `/org/${orgId}/developer/projects/${projectId}/individual` }, { label: "Check-Ins" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Recorded Check-In History</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Immutable log of submitted progress revisions</p>
        </div>
        <ProgressHistory checkIns={pCheckIns} />
      </div>
    </PanelLayout>
  );
}
