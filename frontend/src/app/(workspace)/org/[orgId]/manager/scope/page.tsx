"use client";

import React from "react";
import { useParams } from "next/navigation";
import { FileCheck } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { PageHeader, StatusBadge } from "@/components/owner/primitives";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUtcTimestamp } from "@/components/owner/project-format";
import { mockApiBaselines, mockApiProjects } from "@/lib/prowise-mock-adapters";
import { useManagerResource } from "@/hooks/useManagerResource";
import { ManagerResourceNotice } from "../_components/ManagerResourceNotice";

const loadScopeHistory = (
  orgId: string,
  grants: Parameters<typeof mockApiProjects>[1],
) => ({
  projects: mockApiProjects(orgId, grants).items,
  baselines: mockApiBaselines(orgId, grants).items,
});

export default function ManagerScopePage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const resource = useManagerResource({
    routeOrgId: orgId,
    name: "project-manager-scope-history",
    permission: "project.read",
    fixture: loadScopeHistory,
  });
  const data = resource.state.status === "ready" ? resource.state.data : null;
  const projectById = new Map((data?.projects ?? []).map((project) => [project.id, project]));

  return (
    <PanelLayout
      title="Scope & baselines"
      breadcrumb={[{ label: "Project Manager", href: `/org/${orgId}/manager` }, { label: "Scope & baselines" }]}
    >
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Approved baselines"
          description="Scope versions preserve their reason and approval time. Changes affect future calculations only; historical snapshots are not rewritten."
          simulationLabel={data ? "Sample data" : undefined}
          actions={<OwnerLaterBadge task="3.2" />}
        />
        {data ? (
          data.baselines.length === 0 ? (
            <OwnerPageState
              state="empty"
              title="No approved baselines"
              description="Structured projects may show their active and superseded scope versions here."
              icon={FileCheck}
            />
          ) : (
            <div className="space-y-4">
              {data.baselines.map((baseline) => {
                const project = projectById.get(baseline.projectId);
                const isActive = project?.activeBaselineId === baseline.id;
                const canChangeScope = resource.can("project.scope.change", { projectId: baseline.projectId });
                return (
                  <OwnerPanel
                    key={baseline.id}
                    title={`${project?.key ?? "Project"} · Baseline v${baseline.version}`}
                    description={`${baseline.totalWeight} ${baseline.unit} · Approved ${formatUtcTimestamp(baseline.approvedAt)} UTC · ${baseline.reason}`}
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={isActive ? "Active baseline" : "Historical baseline"} tone={isActive ? "success" : "neutral"} />
                        {canChangeScope ? (
                          <>
                            <LaterActionButton title="Scope approval ships with task 3.2">Propose scope change</LaterActionButton>
                            <OwnerLaterBadge task="3.2" />
                          </>
                        ) : (
                          <span className="text-xs text-app-text-muted">No project.scope.change grant</span>
                        )}
                      </div>
                    }
                  >
                    <OwnerTable label={`Baseline ${baseline.version} scope leaves`}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Eligible leaf</TableHead>
                          <TableHead>Approved weight</TableHead>
                          <TableHead>Recorded credit state</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {baseline.leaves.map((leaf) => (
                          <TableRow key={`${baseline.id}-${leaf.workItemId}`}>
                            <TableCell>{leaf.title}</TableCell>
                            <TableCell>{leaf.weight} {baseline.unit}</TableCell>
                            <TableCell>
                              {!leaf.isEligible
                                ? "Not eligible"
                                : leaf.isDone
                                  ? "Credit recorded"
                                  : "No credit recorded"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </OwnerTable>
                  </OwnerPanel>
                );
              })}
            </div>
          )
        ) : (
          <ManagerResourceNotice
            orgMatches={resource.orgMatches}
            permissionStatus={resource.permissionStatus}
            resourceStatus={resource.state.status}
            permission={resource.permission}
            permissionName="project.read"
            laterTask="3.2"
            retry={resource.retry}
            retryPermissions={resource.permissionRetry}
          />
        )}
      </div>
    </PanelLayout>
  );
}
