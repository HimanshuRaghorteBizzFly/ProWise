"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Activity } from "lucide-react";

import { OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { PageHeader } from "@/components/owner/primitives";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUtcTimestamp } from "@/components/owner/project-format";
import { mockApiProgressForOrg, mockApiProjects } from "@/lib/prowise-mock-adapters";
import { useManagerResource } from "@/hooks/useManagerResource";
import { ManagerResourceNotice } from "../_components/ManagerResourceNotice";

const loadProgressHistory = (
  orgId: string,
  grants: Parameters<typeof mockApiProjects>[1],
) => ({
  projects: mockApiProjects(orgId, grants).items,
  snapshots: mockApiProgressForOrg(orgId, grants).items,
});

export default function ManagerProgressPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const resource = useManagerResource({
    routeOrgId: orgId,
    name: "project-manager-progress-history",
    permission: "project.read",
    fixture: loadProgressHistory,
  });
  const data = resource.state.status === "ready" ? resource.state.data : null;
  const projectById = new Map((data?.projects ?? []).map((project) => [project.id, project]));

  return (
    <PanelLayout
      title="Progress history"
      breadcrumb={[{ label: "Project Manager", href: `/org/${orgId}/manager` }, { label: "Progress history" }]}
    >
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Progress snapshots"
          description="Historical values retain their timestamp, method, and original scope version. Reported and calculated progress are never blended."
          simulationLabel={data ? "Sample data" : undefined}
          actions={<OwnerLaterBadge task="3.5" />}
        />
        {data ? (
          <OwnerPanel
            title="Snapshot ledger"
            description="Scope: readable projects · time basis: recorded event instant in UTC · unit: percent by the labelled method."
          >
            {data.snapshots.length === 0 ? (
              <OwnerPageState
                state="empty"
                title="No progress snapshots"
                description="Saved progress events for projects you can read will appear here."
                icon={Activity}
              />
            ) : (
              <OwnerTable label="Project Manager progress snapshot ledger">
                <TableHeader>
                  <TableRow>
                    <TableHead>Recorded (UTC)</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Scope version</TableHead>
                    <TableHead>Cause</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.snapshots.map((snapshot) => {
                    const project = projectById.get(snapshot.projectId);
                    const value = snapshot.isNotReported
                      ? "Not reported"
                      : snapshot.isNotMeasurable
                        ? "Not measurable"
                        : `${snapshot.value}%`;
                    const method = snapshot.method === "DEVELOPER_REPORTED"
                      ? "Developer reported"
                      : "Calculated baseline";
                    const scope = snapshot.baselineVersion === undefined
                      ? "Not applicable"
                      : `Baseline v${snapshot.baselineVersion}${snapshot.numerator !== undefined && snapshot.denominator !== undefined
                        ? ` · ${snapshot.numerator}/${snapshot.denominator}`
                        : ""}`;
                    return (
                      <TableRow key={snapshot.id}>
                        <TableCell className="whitespace-nowrap">{formatUtcTimestamp(snapshot.instant)} UTC</TableCell>
                        <TableCell>
                          {project ? `${project.key} · ${project.name}` : "Project not available"}
                        </TableCell>
                        <TableCell className="font-semibold">{value}</TableCell>
                        <TableCell>{method}</TableCell>
                        <TableCell>{scope}</TableCell>
                        <TableCell className="max-w-sm whitespace-normal">{snapshot.cause}</TableCell>
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
            laterTask="3.5"
            retry={resource.retry}
            retryPermissions={resource.permissionRetry}
          />
        )}
      </div>
    </PanelLayout>
  );
}
