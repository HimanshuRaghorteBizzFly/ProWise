"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Users } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { PageHeader } from "@/components/owner/primitives";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockApiProjectMembers, mockApiProjects, mockApiWorkItemsForOrg } from "@/lib/prowise-mock-adapters";
import { useManagerResource } from "@/hooks/useManagerResource";
import { ManagerResourceNotice } from "../_components/ManagerResourceNotice";

const loadAssignments = (
  orgId: string,
  grants: Parameters<typeof mockApiProjects>[1],
) => ({
  projects: mockApiProjects(orgId, grants).items,
  items: mockApiWorkItemsForOrg(orgId, grants).items,
  members: mockApiProjectMembers(orgId, grants).items,
});

export default function ManagerTeamAssignmentsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const resource = useManagerResource({
    routeOrgId: orgId,
    name: "project-manager-team-assignments",
    permission: "project.read",
    fixture: loadAssignments,
  });
  const data = resource.state.status === "ready" ? resource.state.data : null;
  const projectById = new Map((data?.projects ?? []).map((project) => [project.id, project]));

  return (
    <PanelLayout
      title="Team assignments"
      breadcrumb={[{ label: "Project Manager", href: `/org/${orgId}/manager` }, { label: "Team assignments" }]}
    >
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Assignments"
          description="Current assignees are shown only for readable projects. Reassignment never changes task state or completion."
          simulationLabel={data ? "Sample data" : undefined}
          actions={<OwnerLaterBadge task="3.1" />}
        />
        {data ? (
          <OwnerPanel
            title="Project work assignments"
            description={`Scope: ${data.projects.length} readable projects · as of the mock snapshot · unit: assigned work items`}
          >
            {data.items.length === 0 ? (
              <OwnerPageState
                state="empty"
                title="No work items to assign"
                description="Structured work items for readable projects appear here. Individual projects may have no compulsory tasks."
                icon={Users}
              />
            ) : (
              <OwnerTable label="Project Manager team assignments">
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Work item</TableHead>
                    <TableHead>Primary assignee</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Collaborators</TableHead>
                    <TableHead>Task state</TableHead>
                    <TableHead>Assignment action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => {
                    const project = projectById.get(item.projectId);
                    const primary = data.members.find((member) => member.id === item.primaryAssigneeId);
                    const reviewer = data.members.find((member) => member.id === item.reviewerId);
                    const collaborators = item.collaboratorIds
                      .map((id) => data.members.find((member) => member.id === id)?.name)
                      .filter((name) => name !== undefined);
                    const canAssign = resource.can("task.assign", { projectId: item.projectId });
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{project?.key ?? "Project not available"}</TableCell>
                        <TableCell>
                          <span className="block font-medium text-app-text-primary">{item.key} · {item.title}</span>
                          <span className="text-xs text-app-text-muted">{item.type}</span>
                        </TableCell>
                        <TableCell>{primary?.name ?? (item.primaryAssigneeId ? "Member not available" : "Unassigned")}</TableCell>
                        <TableCell>{reviewer?.name ?? (item.reviewerId ? "Member not available" : "Not assigned")}</TableCell>
                        <TableCell>{collaborators.length ? collaborators.join(", ") : "None"}</TableCell>
                        <TableCell>{item.state.replace("_", " ")}</TableCell>
                        <TableCell>
                          {canAssign ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <LaterActionButton title="Assignment changes ship with task 3.1">Reassign</LaterActionButton>
                              <OwnerLaterBadge task="3.1" />
                            </span>
                          ) : (
                            <span className="text-xs text-app-text-muted">No task.assign grant for this project</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </OwnerTable>
            )}
          </OwnerPanel>
        ) : (
          <ManagerResourceNotice
            orgMatches={resource.orgMatches}
            permissionStatus={resource.permissionStatus}
            resourceStatus={resource.state.status}
            permission={resource.permission}
            permissionName="project.read"
            laterTask="3.1"
            retry={resource.retry}
            retryPermissions={resource.permissionRetry}
          />
        )}
      </div>
    </PanelLayout>
  );
}
