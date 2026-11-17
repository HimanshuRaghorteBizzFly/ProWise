"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { TaskBoard } from "@/components/developer/TaskBoard";
import { useProjects } from "@/hooks/useProjects";

export default function StructuredMyTasksPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { workItems } = useProjects(orgId);
  const pItems = workItems.filter(w => w.projectId === projectId);

  return (
    <PanelLayout title="Structured Tasks" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Structured", href: `/org/${orgId}/developer/projects/${projectId}/structured` }, { label: "My Tasks" }]}>
      <TaskBoard workItems={pItems} projectId={projectId} />
    </PanelLayout>
  );
}
