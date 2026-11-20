"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Users } from "lucide-react";

import { OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerKpiCard } from "@/components/owner/OwnerKpiCard";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { PageHeader } from "@/components/owner/primitives";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockApiProjectMembers, mockApiProjects, mockApiWorkItemsForOrg } from "@/lib/prowise-mock-adapters";
import { useManagerResource } from "@/hooks/useManagerResource";
import { ManagerResourceNotice } from "../_components/ManagerResourceNotice";

const loadWorkloadData = (
  orgId: string,
  grants: Parameters<typeof mockApiProjects>[1],
) => ({
  projects: mockApiProjects(orgId, grants).items,
  members: mockApiProjectMembers(orgId, grants).items,
  items: mockApiWorkItemsForOrg(orgId, grants).items,
});

export default function ManagerWorkloadPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const resource = useManagerResource({
    routeOrgId: orgId,
    name: "project-manager-workload",
    permission: "project.read",
    fixture: loadWorkloadData,
  });
  const data = resource.state.status === "ready" ? resource.state.data : null;
  const assignedItemCount = data?.items.filter((item) => item.primaryAssigneeId).length ?? 0;

  return (
    <PanelLayout
      title="Workload & capacity"
      breadcrumb={[{ label: "Project Manager", href: `/org/${orgId}/manager` }, { label: "Workload & capacity" }]}
    >
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Workload & capacity"
          description="Effort and available capacity are not provided in this fixture. No points-to-hours conversion is made."
          simulationLabel={data ? "Sample data" : undefined}
          actions={<OwnerLaterBadge task="5.4" />}
        />
        {data ? (
          <>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <OwnerKpiCard
                label="Planned effort"
                value="Not measurable"
                icon={<Users className="h-5 w-5" />}
                detail="No task-hour estimates · readable projects · hours"
              />
              <OwnerKpiCard
                label="Available capacity"
                value="Not measurable"
                icon={<Users className="h-5 w-5" />}
                detail="No member capacity records · readable projects · hours"
              />
            </div>
            <OwnerPanel
              title="Current assignments"
              description={`Scope: ${data.projects.length} readable projects · current mock assignments · unit: work items per member`}
            >
              {data.members.length === 0 ? (
                <OwnerPageState
                  state="empty"
                  title="No readable project members"
                  description="Active members of projects you can read will appear here."
                  icon={Users}
                />
              ) : (
                <OwnerTable label="Project Manager current assignments">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Assigned work items</TableHead>
                      <TableHead>Planned hours</TableHead>
                      <TableHead>Available hours</TableHead>
                      <TableHead>Measurement status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.members.map((member) => {
                      const assigned = data.items.filter((item) => item.primaryAssigneeId === member.id);
                      return (
                        <TableRow key={member.id}>
                          <TableCell>{member.name}</TableCell>
                          <TableCell>
                            <span className="font-medium">{assigned.length}</span>
                            {assigned.length > 0 && (
                              <span className="mt-1 block max-w-sm whitespace-normal text-xs text-app-text-muted">
                                {assigned.map((item) => item.key).join(", ")}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>Not measurable</TableCell>
                          <TableCell>Not measurable</TableCell>
                          <TableCell>No effort or capacity values in sample data</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell className="font-semibold">Readable assignments</TableCell>
                      <TableCell>{assignedItemCount} work items</TableCell>
                      <TableCell>Not measurable</TableCell>
                      <TableCell>Not measurable</TableCell>
                      <TableCell>Counts are not converted to hours</TableCell>
                    </TableRow>
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
            laterTask="5.4"
            retry={resource.retry}
            retryPermissions={resource.permissionRetry}
          />
        )}
      </div>
    </PanelLayout>
  );
}
