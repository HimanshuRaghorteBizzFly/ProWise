"use client";

import React from "react";
import { useParams } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { PageHeader, StatusBadge } from "@/components/owner/primitives";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { HealthBadge } from "@/components/ui/health-badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deadlineStatus, formatDateOnly, formatUtcTimestamp } from "@/components/owner/project-format";
import { mockApiHealth, mockApiProjects, mockApiWorkItemsForOrg } from "@/lib/prowise-mock-adapters";
import { useManagerResource } from "@/hooks/useManagerResource";
import { ManagerResourceNotice } from "../_components/ManagerResourceNotice";

const loadDeliveryHealth = (
  orgId: string,
  grants: Parameters<typeof mockApiProjects>[1],
) => ({
  projects: mockApiProjects(orgId, grants).items,
  health: mockApiHealth(orgId, grants).items,
  workItems: mockApiWorkItemsForOrg(orgId, grants).items,
});

export default function ManagerDeadlinesPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const resource = useManagerResource({
    routeOrgId: orgId,
    name: "project-manager-deadlines-health",
    permission: "project.read",
    fixture: loadDeliveryHealth,
  });
  const data = resource.state.status === "ready" ? resource.state.data : null;
  const healthByProject = new Map((data?.health ?? []).map((health) => [health.projectId, health]));

  return (
    <PanelLayout
      title="Deadlines & health"
      breadcrumb={[{ label: "Project Manager", href: `/org/${orgId}/manager` }, { label: "Deadlines & health" }]}
    >
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Schedule and delivery health"
          description="Date-only deadlines retain each project’s IANA timezone. Health is shown with its recorded reasons and affected items."
          simulationLabel={data ? "Sample data" : undefined}
          actions={<OwnerLaterBadge task="2.3" />}
        />
        {data ? (
          data.projects.length === 0 ? (
            <OwnerPageState
              state="empty"
              title="No readable project schedules"
              description="Schedule records for projects you can read will appear here."
              icon={CalendarDays}
            />
          ) : (
            <>
              {resource.partialVisibility && (
                <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-app-text-secondary">
                  Partial visibility — only readable projects are included in this schedule view.
                </p>
              )}
              <OwnerPanel
                title="Delivery schedule"
                description={`Scope: readable projects · health calculated at the timestamp shown · unit: projects`}
              >
                <OwnerTable label="Project Manager deadlines and health">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Target date</TableHead>
                      <TableHead>Deadline state</TableHead>
                      <TableHead>Health and reasons</TableHead>
                      <TableHead>Affected work</TableHead>
                      <TableHead>Reporting cadence</TableHead>
                      <TableHead>Permitted action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.projects.map((project) => {
                      const health = healthByProject.get(project.id);
                      const affectedIds = health?.affectedItemIds ?? [];
                      const affected = affectedIds
                        .map((id) => data.workItems.find((item) => item.id === id))
                        .filter((item) => item !== undefined);
                      return (
                        <TableRow key={project.id}>
                          <TableCell>{project.key} · {project.name}</TableCell>
                          <TableCell>{formatDateOnly(project.targetDate, project.timezone)}</TableCell>
                          <TableCell>
                            <StatusBadge label={deadlineStatus(project, undefined).replace("-", " ")} tone="neutral" />
                          </TableCell>
                          <TableCell>
                            <HealthBadge health={health?.status ?? project.health} />
                            <span className="mt-1 block max-w-sm whitespace-normal text-xs text-app-text-muted">
                              {(health?.reasons ?? project.healthReasons).join(" · ") || "No reason recorded"}
                            </span>
                            <span className="mt-1 block text-xs text-app-text-muted">
                              {health?.calculatedAt ? `${formatUtcTimestamp(health.calculatedAt)} UTC` : "Health time not recorded"}
                              {health?.timeBasis ? ` · ${health.timeBasis}` : ""}
                            </span>
                          </TableCell>
                          <TableCell>
                            {affected.length
                              ? affected.map((item) => `${item.key} · ${item.title}`).join(", ")
                              : "No affected item recorded"}
                          </TableCell>
                          <TableCell>{project.cadence} · {project.timezone}</TableCell>
                          <TableCell>
                            {resource.can("project.deadline.edit", { projectId: project.id }) ? (
                              <span className="inline-flex flex-wrap items-center gap-1">
                                <LaterActionButton title="Deadline and cadence changes ship with task 2.3">Change dates</LaterActionButton>
                                <OwnerLaterBadge task="2.3" />
                              </span>
                            ) : (
                              <span className="text-xs text-app-text-muted">No project.deadline.edit grant</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </OwnerTable>
              </OwnerPanel>
            </>
          )
        ) : (
          <ManagerResourceNotice
            orgMatches={resource.orgMatches}
            permissionStatus={resource.permissionStatus}
            resourceStatus={resource.state.status}
            permission={resource.permission}
            permissionName="project.read"
            laterTask="2.3"
            retry={resource.retry}
            retryPermissions={resource.permissionRetry}
          />
        )}
      </div>
    </PanelLayout>
  );
}
