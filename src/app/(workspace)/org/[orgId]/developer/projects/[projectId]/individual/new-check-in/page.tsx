"use client";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { useProjects } from "@/hooks/useProjects";
import { CheckInForm } from "@/components/developer/CheckInForm";

export default function IndividualNewCheckInPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { projects } = useProjects(orgId);
  const project = projects.find(p => p.id === projectId);

  if (!project) return null;

  return (
    <PanelLayout title="Submit Check-In" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: project.name, href: `/org/${orgId}/developer/projects/${projectId}/individual` }, { label: "New Check-In" }]}>
      <div className="max-w-2xl mx-auto space-y-6">
        <CheckInForm project={project} onSuccess={() => router.push(`/org/${orgId}/developer/projects/${projectId}/individual`)} />
      </div>
    </PanelLayout>
  );
}
