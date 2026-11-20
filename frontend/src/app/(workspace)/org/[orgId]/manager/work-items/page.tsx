"use client";

import React from "react";
import { useParams } from "next/navigation";
import { CheckSquare } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { PageHeader } from "@/components/owner/primitives";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { StatusBadge } from "@/components/owner/primitives";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockApiBlockers, mockApiProjectMembers, mockApiProjects, mockApiWorkItemsForOrg } from "@/lib/prowise-mock-adapters";
import { useManagerResource } from "@/hooks/useManagerResource";
import { ManagerResourceNotice } from "../_components/ManagerResourceNotice";

const loadWorkItemRegister = (
  orgId: string,
  grants: Parameters<typeof mockApiProjects>[1],
) => ({
  projects: mockApiProjects(orgId, grants).items,
  items: mockApiWorkItemsForOrg(orgId, grants).items,
  blockers: mockApiBlockers(orgId, grants).items,
  members: mockApiProjectMembers(orgId, grants).items,
});

export default function ManagerWorkItemsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const resource = useManagerResource({
    routeOrgId: orgId,
    name: "project-manager-work-items",
    permission: "project.read",
    fixture: loadWorkItemRegister,
  });
  const data = resource.state.status === "ready" ? resource.state.data : null;
  const projectById = new Map((data?.projects ?? []).map((project) => [project.id, project]));
  const blockersByItem = new Map<string, NonNullable<typeof data>["blockers"]>();
  for (const blocker of data?.blockers ?? []) {
    if (blocker.resolvedAt) continue;
    blockersByItem.set(blocker.workItemId, [...(blockersByItem.get(blocker.workItemId) ?? []), blocker]);
  }

  return (
    <PanelLayout
      title="Work items"
      breadcrumb={[{ label: "Project Manager", href: `/org/${orgId}/manager` }, { label: "Work items" }]}
    >
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Work items"
          description="Scope, task state and blockers are listed separately. Git activity is evidence only and never marks work done."
          simulationLabel={data ? "Sample data" : undefined}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <OwnerLaterBadge task="3.1" />
              {data?.projects.some((project) => resource.can("task.create", { projectId: project.id })) && (
                <LaterActionButton title="Work-item creation ships with task 3.1">Create work item</LaterActionButton>
              )}
            </div>
          }
        />
        {data ? (
          <OwnerPanel
            title="Readable scope"
            description={`Scope: ${data.projects.length} readable projects · as of the mock snapshot · unit: work items`}
          >
            {data.items.length === 0 ? (
              <OwnerPageState
                state="empty"
                title="No readable work items"
                description="Work items for projects you can read will appear here. Individual projects may have no compulsory tasks."
                icon={CheckSquare}
              />
            ) : (
              <OwnerTable label="Project Manager work items">
                <TableHeader>
                  <TableRow>
                    <TableHead>Work item</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Blockers</TableHead>
                    <TableHead>Approved weight</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Permitted action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => {
                    const project = projectById.get(item.projectId);
                    const blockers = blockersByItem.get(item.id) ?? [];
                    const assignee = data.members.find((member) => member.id === item.primaryAssigneeId);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <span className="block font-semibold text-app-text-primary">{item.key} · {item.title}</span>
                          <span className="text-xs text-app-text-muted">{item.type}</span>
                        </TableCell>
                        <TableCell>{project?.key ?? "Project not available"}</TableCell>
                        <TableCell>{assignee?.name ?? (item.primaryAssigneeId ? "Member not available" : "Unassigned")}</TableCell>
                        <TableCell><StatusBadge label={item.state.replace("_", " ")} tone={item.state === "DONE" ? "success" : "neutral"} /></TableCell>
                        <TableCell>
                          {blockers.length === 0
                            ? "None recorded"
                            : blockers.map((blocker) => `${blocker.severity}: ${blocker.reason}`).join("; ")}
                        </TableCell>
                        <TableCell>{item.weight} {item.weightUnit}</TableCell>
                        <TableCell>
                          {item.dueDate
                            ? `${item.dueDate} · ${project?.timezone ?? "timezone not recorded"}`
                            : "Not scheduled"}
                        </TableCell>
                        <TableCell>
                          {resource.can("task.update", { projectId: item.projectId }) ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              <LaterActionButton title="Work-item updates ship with task 3.1">Update</LaterActionButton>
                              <OwnerLaterBadge task="3.1" />
                            </span>
                          ) : (
                            <span className="text-xs text-app-text-muted">No task.update grant</span>
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
