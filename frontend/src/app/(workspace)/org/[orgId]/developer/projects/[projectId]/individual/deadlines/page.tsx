"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { useProjects } from "@/hooks/useProjects";
import { Card } from "@/components/ui/card";

export default function IndividualDeadlinesPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { projects } = useProjects(orgId);
  const project = projects.find(p => p.id === projectId);

  return (
    <PanelLayout title="Deadlines & Cadence" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: project?.name || "Project", href: `/org/${orgId}/developer/projects/${projectId}/individual` }, { label: "Deadlines" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Delivery Cadence & Target Dates</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Check-in frequency, grace periods, and expected finish date</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
          <div className="text-xs">Target Date: <strong>{project?.targetDate}</strong></div>
          <div className="text-xs">Reporting Cadence: <strong>{project?.cadence}</strong></div>
          <div className="text-xs">Grace Working Days: <strong>{project?.graceWorkingDays} days</strong></div>
        </Card>
      </div>
    </PanelLayout>
  );
}
