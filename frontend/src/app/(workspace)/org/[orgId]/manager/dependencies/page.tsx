"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Layers } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { PageHeader, StatusBadge } from "@/components/owner/primitives";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUtcTimestamp } from "@/components/owner/project-format";
import {
  mockApiBlockers,
  mockApiDependencies,
  mockApiProjectMembers,
  mockApiProjects,
  mockApiWorkItemsForOrg,
} from "@/lib/prowise-mock-adapters";
import { useManagerResource } from "@/hooks/useManagerResource";
import { ManagerResourceNotice } from "../_components/ManagerResourceNotice";

const loadFlowData = (
  orgId: string,
  grants: Parameters<typeof mockApiProjects>[1],
) => ({
  projects: mockApiProjects(orgId, grants).items,
  items: mockApiWorkItemsForOrg(orgId, grants).items,
  dependencies: mockApiDependencies(orgId, grants).items,
  blockers: mockApiBlockers(orgId, grants).items,
  members: mockApiProjectMembers(orgId, grants).items,
});

export default function ManagerDependenciesPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const resource = useManagerResource({
    routeOrgId: orgId,
    name: "project-manager-dependencies-blockers",
    permission: "project.read",
    fixture: loadFlowData,
  });
  const data = resource.state.status === "ready" ? resource.state.data : null;
  const projectById = new Map((data?.projects ?? []).map((project) => [project.id, project]));
  const itemById = new Map((data?.items ?? []).map((item) => [item.id, item]));
  const activeBlockers = (data?.blockers ?? []).filter((blocker) => !blocker.resolvedAt);

  return (
    <PanelLayout
      title="Dependencies & blockers"
      breadcrumb={[{ label: "Project Manager", href: `/org/${orgId}/manager` }, { label: "Dependencies & blockers" }]}
    >
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Dependencies & blockers"
          description="Finish-to-start links and blockers are distinct records. A blocker never changes the task state by itself."
          simulationLabel={data ? "Sample data" : undefined}
          actions={<OwnerLaterBadge task="3.4" />}
        />
        {data ? (
          <>
            <OwnerPanel
              title="Finish-to-start dependencies"
              description={`Scope: ${data.projects.length} readable projects · current saved links · unit: dependency links`}
            >
              {data.dependencies.length === 0 ? (
                <OwnerPageState
                  state="empty"
                  title="No dependencies recorded"
                  description="Dependencies for readable projects will appear here."
                  icon={Layers}
                />
              ) : (
                <OwnerTable label="Project Manager dependencies">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Predecessor</TableHead>
                      <TableHead>Successor</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.dependencies.map((dependency) => {
                      const project = projectById.get(dependency.projectId);
                      const predecessor = itemById.get(dependency.predecessorId);
                      const successor = itemById.get(dependency.successorId);
                      return (
                        <TableRow key={dependency.id}>
                          <TableCell>{project?.key ?? "Project not available"}</TableCell>
                          <TableCell>{predecessor ? `${predecessor.key} · ${predecessor.title}` : "Work item not available"}</TableCell>
                          <TableCell>{successor ? `${successor.key} · ${successor.title}` : "Work item not available"}</TableCell>
                          <TableCell>Finish to start</TableCell>
                          <TableCell>
                            {resource.can("task.update", { projectId: dependency.projectId }) ? (
                              <span className="inline-flex flex-wrap items-center gap-1">
                                <LaterActionButton title="Dependency changes ship with task 3.4">Manage</LaterActionButton>
                                <OwnerLaterBadge task="3.4" />
                              </span>
                            ) : (
                              <span className="text-xs text-app-text-muted">No task.update grant for this project</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </OwnerTable>
              )}
            </OwnerPanel>

            <OwnerPanel
              title="Active blockers"
              description={`Scope: readable projects · current unresolved blocker records · created time in UTC · unit: blockers`}
            >
              {activeBlockers.length === 0 ? (
                <OwnerPageState
                  state="empty"
                  title="No active blockers"
                  description="Unresolved blocker records for readable projects will appear here. Task state is not inferred."
                />
              ) : (
                <OwnerTable label="Project Manager active blockers">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project / work item</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Recorded (UTC)</TableHead>
                      <TableHead>Task state</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeBlockers.map((blocker) => {
                      const project = projectById.get(blocker.projectId);
                      const item = itemById.get(blocker.workItemId);
                      const owner = data.members.find((member) => member.id === blocker.ownerId);
                      return (
                        <TableRow key={blocker.id}>
                          <TableCell>{project?.key} · {item?.key ?? "Work item not available"}</TableCell>
                          <TableCell><StatusBadge label={blocker.severity} tone={blocker.severity === "CRITICAL" ? "danger" : "warning"} /></TableCell>
                          <TableCell>{blocker.reason}</TableCell>
                          <TableCell>{owner?.name ?? "Member not available"}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatUtcTimestamp(blocker.createdAt)} UTC</TableCell>
                          <TableCell>{item?.state.replace("_", " ") ?? "Unknown"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </OwnerTable>
              )}
            </OwnerPanel>
          </>
        ) : (
          <ManagerResourceNotice
            orgMatches={resource.orgMatches}
            permissionStatus={resource.permissionStatus}
            resourceStatus={resource.state.status}
            permission={resource.permission}
            permissionName="project.read"
            laterTask="3.4"
            retry={resource.retry}
            retryPermissions={resource.permissionRetry}
          />
        )}
      </div>
    </PanelLayout>
  );
}
