"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Activity, AlertTriangle, BriefcaseBusiness, FolderKanban, Sparkles } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerKpiCard } from "@/components/owner/OwnerKpiCard";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { PageHeader, StatusBadge } from "@/components/owner/primitives";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { HealthBadge } from "@/components/ui/health-badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateOnly, formatUtcTimestamp } from "@/components/owner/project-format";
import {
  mockApiHealth,
  mockApiProjects,
  mockApiWorkItemsForOrg,
} from "@/lib/prowise-mock-adapters";
import { useManagerResource } from "@/hooks/useManagerResource";
import { ManagerResourceNotice } from "./_components/ManagerResourceNotice";

const loadDashboard = (orgId: string, grants: Parameters<typeof mockApiProjects>[1]) => ({
  projects: mockApiProjects(orgId, grants).items,
  health: mockApiHealth(orgId, grants).items,
  workItems: mockApiWorkItemsForOrg(orgId, grants).items,
});

export default function ProjectManagerDashboard() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [healthFilter, setHealthFilter] = useState("ALL");
  const resource = useManagerResource({
    routeOrgId: orgId,
    name: "project-manager-dashboard",
    permission: "project.read",
    fixture: loadDashboard,
  });

  const data = resource.state.status === "ready" ? resource.state.data : null;
  const projects = useMemo(() => data?.projects ?? [], [data]);
  const healthRecords = useMemo(() => data?.health ?? [], [data]);
  const workItems = data?.workItems ?? [];
  const healthByProject = useMemo(
    () => new Map(healthRecords.map((record) => [record.projectId, record])),
    [healthRecords],
  );
  const latestHealthAt = healthRecords
    .map((record) => record.calculatedAt)
    .sort()
    .at(-1);
  const latestHealthLabel = latestHealthAt ? formatUtcTimestamp(latestHealthAt) : "No health snapshot";

  const visibleProjects = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return projects.filter((project) =>
      (modeFilter === "ALL" || project.mode === modeFilter) &&
      (healthFilter === "ALL" && (!search ||
        project.key.toLocaleLowerCase().includes(search) ||
        project.name.toLocaleLowerCase().includes(search)) ||
        (healthFilter !== "ALL" && (healthByProject.get(project.id)?.status ?? project.health) === healthFilter &&
          (!search || project.key.toLocaleLowerCase().includes(search) ||
            project.name.toLocaleLowerCase().includes(search)))),
    );
  }, [projects, query, modeFilter, healthFilter, healthByProject]);

  const attentionProjects = projects.filter((project) => {
    const status = healthByProject.get(project.id)?.status ?? project.health;
    return status !== "ON_TRACK";
  });
  const structuredCount = projects.filter((project) => project.mode === "STRUCTURED").length;
  const individualCount = projects.filter((project) => project.mode === "INDIVIDUAL").length;
  const pageHeader = (
    <PageHeader
      title="Project Manager dashboard"
      description="Your permitted project portfolio, health reasons and next delivery actions. Progress methods remain separate."
      simulationLabel={data ? "Sample data" : undefined}
      actions={
        resource.can("project.create") ? (
          <div className="flex flex-wrap items-center gap-2">
            <LaterActionButton title="Project creation ships with task 2.1">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              Create &amp; plan
            </LaterActionButton>
            <OwnerLaterBadge task="2.1" />
          </div>
        ) : undefined
      }
    />
  );

  return (
    <PanelLayout
      title="Project Manager"
      breadcrumb={[{ label: "Project Manager" }, { label: "Dashboard" }]}
    >
      <div className="space-y-4 sm:space-y-6">
        {pageHeader}
        {data ? (
          <>
            {resource.partialVisibility && (
              <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-app-text-secondary">
                <StatusBadge label="Partial visibility" tone="warning" />
                Totals include only projects you can read; hidden projects are not counted or identified.
              </div>
            )}

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <OwnerKpiCard
                label="Readable projects"
                value={projects.length}
                icon={<FolderKanban className="h-5 w-5" />}
                detail="Permitted project scope · latest records · projects"
              />
              <OwnerKpiCard
                label="Need attention"
                value={attentionProjects.length}
                icon={<AlertTriangle className="h-5 w-5" />}
                detail={`Health records · as of ${latestHealthLabel} UTC · projects`}
              />
              <OwnerKpiCard
                label="Individual projects"
                value={individualCount}
                icon={<Activity className="h-5 w-5" />}
                detail="Developer-reported series only · projects"
              />
              <OwnerKpiCard
                label="Structured projects"
                value={structuredCount}
                icon={<BriefcaseBusiness className="h-5 w-5" />}
                detail="Calculated-baseline series only · projects"
              />
            </div>

            <OwnerPanel
              title="Need attention"
              description="Health is shown with its cause, affected work and source time; blocker status is separate from task state."
              actions={<OwnerLaterBadge task="5.1" />}
            >
              {attentionProjects.length === 0 ? (
                <OwnerPageState
                  state="empty"
                  title="No readable project currently needs attention"
                  description="Health is evaluated only from the latest permitted project records."
                  icon={AlertTriangle}
                />
              ) : (
                <ul className="space-y-3">
                  {attentionProjects.map((project) => {
                    const health = healthByProject.get(project.id);
                    const affected = (health?.affectedItemIds ?? [])
                      .map((id) => workItems.find((item) => item.id === id))
                      .filter((item) => item !== undefined);
                    const reasons = health?.reasons ?? project.healthReasons;
                    return (
                      <li key={project.id} className="rounded-lg border border-app-border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-app-text-primary">
                            {project.key} · {project.name}
                          </span>
                          <HealthBadge health={health?.status ?? project.health} />
                        </div>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-app-text-secondary">
                          {reasons.map((reason) => <li key={reason}>{reason}</li>)}
                        </ul>
                        <p className="mt-2 text-xs text-app-text-muted">
                          Affected work: {affected.length
                            ? affected.map((item) => `${item.key} · ${item.title}`).join(", ")
                            : "No affected item is recorded"}
                          {" · "}Basis: {health?.timeBasis ?? "Project health record"}
                          {" · "}Calculated: {health?.calculatedAt ? formatUtcTimestamp(health.calculatedAt) : "time not recorded"} UTC
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </OwnerPanel>

            <OwnerPanel
              title="Portfolio"
              description="Scope: readable projects · time: latest saved project records · progress unit: percent by the method shown."
            >
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto_auto]">
                <label className="sr-only" htmlFor="manager-project-search">Search projects</label>
                <input
                  id="manager-project-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search project key or name"
                  className="h-9 min-w-0 rounded-lg border border-app-border bg-app-bg px-3 text-sm text-app-text-primary"
                />
                <label className="sr-only" htmlFor="manager-project-mode">Filter by mode</label>
                <select
                  id="manager-project-mode"
                  value={modeFilter}
                  onChange={(event) => setModeFilter(event.target.value)}
                  className="h-9 rounded-lg border border-app-border bg-app-bg px-2 text-sm text-app-text-primary"
                >
                  <option value="ALL">All modes</option>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="STRUCTURED">Structured</option>
                </select>
                <label className="sr-only" htmlFor="manager-project-health">Filter by health</label>
                <select
                  id="manager-project-health"
                  value={healthFilter}
                  onChange={(event) => setHealthFilter(event.target.value)}
                  className="h-9 rounded-lg border border-app-border bg-app-bg px-2 text-sm text-app-text-primary"
                >
                  <option value="ALL">All health</option>
                  <option value="ON_TRACK">On track</option>
                  <option value="AT_RISK">At risk</option>
                  <option value="DELAYED">Delayed</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </div>
              {visibleProjects.length === 0 ? (
                <OwnerPageState
                  state="empty"
                  title={projects.length ? "No projects match these filters" : "No projects yet"}
                  description={projects.length ? "Change or reset the filters." : "Projects you may read appear here."}
                  icon={FolderKanban}
                />
              ) : (
                <OwnerTable label="Project Manager portfolio">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Target date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleProjects.map((project) => {
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
                          <TableCell>
                            <span className="block font-semibold text-app-text-primary">{project.key} · {project.name}</span>
                            <span className="text-xs text-app-text-muted">{project.lifecycle}</span>
                          </TableCell>
                          <TableCell>{project.mode === "INDIVIDUAL" ? "Individual" : "Structured"}</TableCell>
                          <TableCell>
                            <HealthBadge health={health?.status ?? project.health} />
                            <span className="mt-1 block max-w-xs text-xs text-app-text-muted">
                              {(health?.reasons ?? project.healthReasons).join(" · ") || "No reason recorded"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="block font-medium text-app-text-primary">{value}</span>
                            <span className="text-xs text-app-text-muted">{method} · {project.lastReportedAt ? formatUtcTimestamp(project.lastReportedAt) : "time not recorded"} UTC</span>
                          </TableCell>
                          <TableCell>
                            {formatDateOnly(project.targetDate, project.timezone)}
                          </TableCell>
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
            laterTask="5.3"
            retry={resource.retry}
            retryPermissions={resource.permissionRetry}
          />
        )}
      </div>
    </PanelLayout>
  );
}
