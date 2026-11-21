"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { apiClient } from "@/lib/api";
import { useProgressApi, CheckInAuditTrail } from "@/features/projects";
import type { ProjectDto } from "@/types/api";

export default function IndividualCheckInsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;

  const [project, setProject] = useState<ProjectDto | null>(null);
  const { summary, checkIns, refresh } = useProgressApi(projectId, orgId);

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

  return (
    <PanelLayout
      title="Check-In Audit Log"
      breadcrumb={[
        { label: "Developer", href: `/org/${orgId}/developer` },
        { label: project?.name || "Project", href: `/org/${orgId}/developer/projects/${projectId}/individual` },
        { label: "Check-Ins" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            Recorded Progress Check-In History
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Immutable log of submitted progress revisions, Team Lead verification decisions, and GitHub evidence.
          </p>
        </div>

        <CheckInAuditTrail
          checkIns={checkIns}
          currentProjectPercent={summary?.current_percent ?? 0}
          canReview={false}
          onRefresh={refresh}
        />
      </div>
    </PanelLayout>
  );
}
