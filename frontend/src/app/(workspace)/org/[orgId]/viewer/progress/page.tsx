"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { Activity, CircleDashed, Gauge } from "lucide-react";
import {
  ViewerPageHeader,
  ViewerSurfaceCard,
  ViewerKpiCard,
  EmptyState,
  LoadingSkeleton,
  ErrorState,
} from "../_components/ViewerPrimitives";
import { ViewerProjectTable } from "../_components/ViewerProjectTable";
import { useViewerProjects } from "../_services/useViewerProjects";

export default function ViewerProgressPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const { state, retry } = useViewerProjects(orgId);

  const summary = useMemo(() => {
    const projects = state.status === "ready" ? state.projects : [];
    const reported = projects.filter((p) => p.progress.percent !== null);
    return { total: projects.length, reported: reported.length, notReported: projects.length - reported.length };
  }, [state]);

  return (
    <div className="space-y-5">
      <ViewerPageHeader
        title="Progress Summaries"
        description="The current progress figure for each project. Progress is reported by people, never derived from activity."
      />

      {state.status === "loading" && <LoadingSkeleton type="metric" />}
      {state.status === "error" && <ErrorState description={state.message} onRetry={retry} />}

      {state.status === "ready" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <ViewerKpiCard label="Projects" value={summary.total} icon={Activity} tone="blue" />
            <ViewerKpiCard label="With reported progress" value={summary.reported} icon={Gauge} tone="emerald" />
            <ViewerKpiCard label="Not reported yet" value={summary.notReported} icon={CircleDashed} tone="slate" />
          </div>
          <ViewerSurfaceCard>
            {state.projects.length === 0 ? (
              <EmptyState icon={Activity} title="No projects yet" description="Progress appears here once projects are created and reported on." />
            ) : (
              <ViewerProjectTable projects={state.projects} showProgressDetail />
            )}
          </ViewerSurfaceCard>
        </>
      )}
    </div>
  );
}
