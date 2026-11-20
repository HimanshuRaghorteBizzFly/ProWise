"use client";

import React from "react";
import { useParams } from "next/navigation";
import { BarChart3, Download } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerKpiCard } from "@/components/owner/OwnerKpiCard";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { PageHeader } from "@/components/owner/primitives";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { HealthBadge } from "@/components/ui/health-badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUtcTimestamp } from "@/components/owner/project-format";
import { mockApiHealth, mockApiProjects } from "@/lib/prowise-mock-adapters";
import { useManagerResource } from "@/hooks/useManagerResource";
import { ManagerResourceNotice } from "../_components/ManagerResourceNotice";

const loadPortfolioReport = (
  orgId: string,
  grants: Parameters<typeof mockApiProjects>[1],
) => ({
  projects: mockApiProjects(orgId, grants).items,
  health: mockApiHealth(orgId, grants).items,
});

export default function ManagerReportsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const resource = useManagerResource({
    routeOrgId: orgId,
    name: "project-manager-portfolio-report",
    permission: "project.read",
    fixture: loadPortfolioReport,
  });
  const data = resource.state.status === "ready" ? resource.state.data : null;
  const healthByProject = new Map((data?.health ?? []).map((health) => [health.projectId, health]));
  const structuredCount = data?.projects.filter((project) => project.mode === "STRUCTURED").length ?? 0;
  const individualCount = data?.projects.filter((project) => project.mode === "INDIVIDUAL").length ?? 0;
  const reportExportAllowed = resource.can("report.export");
  const asOf = data
    ? [...data.health.map((health) => health.calculatedAt), ...data.projects.map((project) => project.lastReportedAt ?? "")]
      .filter(Boolean)
      .sort()
      .at(-1)
    : undefined;

  return (
    <PanelLayout
      title="Reports"
      breadcrumb={[{ label: "Project Manager", href: `/org/${orgId}/manager` }, { label: "Reports" }]}
    >
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Portfolio report"
          description="Readable project records only. Individual reported progress and Structured baseline calculations are separately labelled."
          simulationLabel={data ? "Sample data" : undefined}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <OwnerLaterBadge task="5.5" />
              {reportExportAllowed && (
                <LaterActionButton title="Authorized report exports ship with task 5.5">
                  <Download aria-hidden="true" className="h-3.5 w-3.5" />
                  Export report
                </LaterActionButton>
              )}
            </div>
          )}
        />
        {data ? (
          data.projects.length === 0 ? (
            <OwnerPageState
              state="empty"
              title="No readable project data"
              description="Portfolio report rows appear only for projects you can read."
              icon={BarChart3}
            />
          ) : (
            <>
              {resource.partialVisibility && (
                <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-app-text-secondary">
                  Partial visibility — this report excludes projects outside your readable scope.
                </p>
              )}
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <OwnerKpiCard
                  label="Readable projects"
                  value={data.projects.length}
                  icon={<BarChart3 className="h-5 w-5" />}
                  detail="Current project records · unit: projects"
                />
                <OwnerKpiCard
                  label="Individual"
                  value={individualCount}
                  icon={<BarChart3 className="h-5 w-5" />}
                  detail="Developer-reported method only · projects"
                />
                <OwnerKpiCard
                  label="Structured"
                  value={structuredCount}
                  icon={<BarChart3 className="h-5 w-5" />}
                  detail="Calculated-baseline method only · projects"
                />
                <OwnerKpiCard
                  label="Health records"
                  value={data.health.length}
                  icon={<BarChart3 className="h-5 w-5" />}
                  detail={`Latest recorded health · ${asOf ? `${formatUtcTimestamp(asOf)} UTC` : "time not recorded"} · records`}
                />
              </div>
              <OwnerPanel
                title="As-of portfolio"
                description={`Scope: readable projects · as of ${asOf ? `${formatUtcTimestamp(asOf)} UTC` : "time not recorded"} · progress unit: percent by method`}
              >
                <OwnerTable label="Project Manager portfolio report">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Mode / lifecycle</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Progress method</TableHead>
                      <TableHead>Health and reason</TableHead>
                      <TableHead>Target date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.projects.map((project) => {
                      const health = healthByProject.get(project.id);
                      const method = project.lastProgressMethod === "DEVELOPER_REPORTED"
                        ? "Developer reported"
                        : project.lastProgressMethod === "CALCULATED_BASELINE"
                          ? "Calculated baseline"
                          : "Not reported";
                      const value = project.lastProgressMethod === "NOT_REPORTED"
                        ? "Not reported"
                        : `${project.lastProgressPercent}%`;
                      return (
                        <TableRow key={project.id}>
                          <TableCell>{project.key} · {project.name}</TableCell>
                          <TableCell>{project.mode} · {project.lifecycle}</TableCell>
                          <TableCell>{value}</TableCell>
                          <TableCell>
                            <span className="block">{method}</span>
                            <span className="text-xs text-app-text-muted">
                              {project.lastReportedAt ? `${formatUtcTimestamp(project.lastReportedAt)} UTC` : "Time not recorded"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <HealthBadge health={health?.status ?? project.health} />
                            <span className="mt-1 block max-w-xs whitespace-normal text-xs text-app-text-muted">
                              {(health?.reasons ?? project.healthReasons).join(" · ") || "No reason recorded"}
                            </span>
                          </TableCell>
                          <TableCell>{project.targetDate} · {project.timezone}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </OwnerTable>
              </OwnerPanel>
              {!reportExportAllowed && (
                <p className="text-sm text-app-text-muted" role="note">
                  Export is hidden because report.export is not granted for this membership.
                </p>
              )}
            </>
          )
        ) : (
          <ManagerResourceNotice
            orgMatches={resource.orgMatches}
            permissionStatus={resource.permissionStatus}
            resourceStatus={resource.state.status}
            permission={resource.permission}
            permissionName="project.read"
            laterTask="5.5"
            retry={resource.retry}
            retryPermissions={resource.permissionRetry}
          />
        )}
      </div>
    </PanelLayout>
  );
}
