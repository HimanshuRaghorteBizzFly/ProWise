"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { apiClient } from "@/lib/api";
import { useProgressApi, CheckInSubmissionModal } from "@/features/projects";
import type { ProjectDto } from "@/types/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";

export default function IndividualNewCheckInPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;

  const [project, setProject] = useState<ProjectDto | null>(null);
  const { summary, gitHubActivity, refresh } = useProgressApi(projectId, orgId);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    async function loadProject() {
      if (!projectId) return;
      try {
        const p = await apiClient.project(projectId, orgId);
        setProject(p);
      } catch {
        // Fallback
      }
    }
    loadProject();
  }, [projectId, orgId]);

  const handleClose = () => {
    setIsOpen(false);
    router.push(`/org/${orgId}/developer/projects/${projectId}/individual`);
  };

  const handleSubmitted = () => {
    refresh();
    router.push(`/org/${orgId}/developer/projects/${projectId}/individual`);
  };

  return (
    <PanelLayout
      title="Submit Progress Check-In"
      breadcrumb={[
        { label: "Developer", href: `/org/${orgId}/developer` },
        { label: project?.name || "Project", href: `/org/${orgId}/developer/projects/${projectId}/individual` },
        { label: "New Check-In" },
      ]}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/org/${orgId}/developer/projects/${projectId}/individual`)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Project
        </Button>

        {project && (
          <CheckInSubmissionModal
            isOpen={isOpen}
            onClose={handleClose}
            projectId={project.id}
            projectName={project.name}
            projectKey={project.key}
            currentPercent={summary?.current_percent ?? project.lastProgressPercent ?? 0}
            requireVerification={summary?.require_verification ?? false}
            gitHubActivity={gitHubActivity}
            onSubmitted={handleSubmitted}
          />
        )}
      </div>
    </PanelLayout>
  );
}
