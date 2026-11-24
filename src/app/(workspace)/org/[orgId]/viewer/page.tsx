"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FolderGit2, PlayCircle, CheckCircle2, PauseCircle } from "lucide-react";
import {
  ViewerPageHeader,
  ViewerSurfaceCard,
  ViewerKpiCard,
  EmptyState,
  LoadingSkeleton,
  ErrorState,
} from "./_components/ViewerPrimitives";
import { ViewerProjectTable } from "./_components/ViewerProjectTable";
import { useViewerProjects } from "./_services/useViewerProjects";

const RECENT_LIMIT = 8;

export default function ViewerDashboardPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const { state, retry } = useViewerProjects(orgId);

  const counts = useMemo(() => {
    const projects = state.status === "ready" ? state.projects : [];
    return {
      total: projects.length,
      active: projects.filter((p) => p.lifecycle === "ACTIVE").length,
      delivered: projects.filter((p) => p.lifecycle === "DELIVERED" || p.lifecycle === "CLOSED").length,
      onHold: projects.filter((p) => p.lifecycle === "ON_HOLD" || p.lifecycle === "AWAITING_ACCEPTANCE").length,
    };
  }, [state]);

  return (
    <div className="space-y-5">
      <ViewerPageHeader
        title="Dashboard"
        description="Read-only overview of the projects you can see in this organization."
      />

      {state.status === "loading" && <LoadingSkeleton type="metric" />}
      {state.status === "error" && <ErrorState description={state.message} onRetry={retry} />}

      {state.status === "ready" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <ViewerKpiCard label="Visible projects" value={counts.total} icon={FolderGit2} tone="blue" />
            <ViewerKpiCard label="Active" value={counts.active} icon={PlayCircle} tone="emerald" />
            <ViewerKpiCard label="On hold / awaiting acceptance" value={counts.onHold} icon={PauseCircle} tone="amber" />
            <ViewerKpiCard label="Delivered / closed" value={counts.delivered} icon={CheckCircle2} tone="violet" />
          </div>

          <ViewerSurfaceCard>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border,#E2E8F0)]">
              <h2 className="text-sm font-semibold">Projects</h2>
              <Link href={`/org/${orgId}/viewer/projects`} className="text-xs font-semibold text-blue-600 hover:underline">
                View all
              </Link>
            </div>
            {state.projects.length === 0 ? (
              <EmptyState
                icon={FolderGit2}
                title="No projects yet"
                description="Projects shared with you will appear here once they are created."
              />
            ) : (
              <ViewerProjectTable projects={state.projects.slice(0, RECENT_LIMIT)} />
            )}
          </ViewerSurfaceCard>
        </>
      )}
    </div>
  );
}
