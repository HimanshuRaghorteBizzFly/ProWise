"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { LayoutGrid, List, Search, Sparkles } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { PageHeader, StatusBadge, SurfaceCard } from "@/components/owner/primitives";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { HealthBadge } from "@/components/ui/health-badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateOnly, formatLifecycle, formatUtcTimestamp, getUserName, deadlineStatus, DEADLINE_LABELS } from "@/components/owner/project-format";
import { mockApiProjectMembers, mockApiProjects } from "@/lib/prowise-mock-adapters";
import { useManagerResource } from "@/hooks/useManagerResource";
import { ManagerResourceNotice } from "../_components/ManagerResourceNotice";

const loadProjects = (orgId: string, grants: Parameters<typeof mockApiProjects>[1]) => ({
  projects: mockApiProjects(orgId, grants).items,
  members: mockApiProjectMembers(orgId, grants).items,
});

const SELECT =
  "h-9 min-w-0 rounded-lg border border-app-border bg-app-bg px-2 text-sm text-app-text-primary";

export default function ManagerProjectsListPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("ALL");
  const [health, setHealth] = useState("ALL");
  const [lifecycle, setLifecycle] = useState("ALL");
  const [deadline, setDeadline] = useState("ALL");
  const [ownerId, setOwnerId] = useState("ALL");
  const [layout, setLayout] = useState<"list" | "cards">("list");
  const resource = useManagerResource({
    routeOrgId: orgId,
    name: "project-manager-projects",
    permission: "project.read",
    fixture: loadProjects,
  });
  const data = resource.state.status === "ready" ? resource.state.data : null;
  const projects = useMemo(() => data?.projects ?? [], [data]);
  const members = data?.members ?? [];
  const owners = Array.from(new Set(projects.map((project) => project.accountableOwnerId)));

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return projects.filter((project) =>
      (!query || `${project.key} ${project.name}`.toLocaleLowerCase().includes(query)) &&
      (mode === "ALL" || project.mode === mode) &&
      (health === "ALL" || project.health === health) &&
      (lifecycle === "ALL" || project.lifecycle === lifecycle) &&
      (ownerId === "ALL" || project.accountableOwnerId === ownerId) &&
      (deadline === "ALL" || deadlineStatus(project, undefined) === deadline),
    );
  }, [projects, search, mode, health, lifecycle, ownerId, deadline]);

  const header = (
    <PageHeader
      title="Projects portfolio"
      description="Projects visible through your active permission scope. Progress methods stay separate and are never averaged."
      simulationLabel={data ? "Sample data" : undefined}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <OwnerLaterBadge task="5.3" />
          {resource.can("project.create") && (
            <LaterActionButton title="Project creation ships with task 2.1">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              Create project
            </LaterActionButton>
          )}
          {resource.can("project.create") && <OwnerLaterBadge task="2.1" />}
        </div>
      }
    />
  );

  return (
    <PanelLayout
      title="Projects portfolio"
      breadcrumb={[{ label: "Project Manager", href: `/org/${orgId}/manager` }, { label: "Projects" }]}
    >
      <div className="space-y-4 sm:space-y-6">
        {header}
        {data ? (
          <>
            {resource.partialVisibility && (
              <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-app-text-secondary">
                Partial visibility — totals include readable projects only; hidden project details are not exposed.
              </div>
            )}
            <OwnerPanel
              title="All readable projects"
              description={`${visible.length} of ${projects.length} readable projects · current project records · unit: projects`}
              actions={
                <div className="flex items-center gap-2">
                  <div role="group" aria-label="Portfolio layout" className="inline-flex rounded-lg border border-app-border p-0.5">
                    <button
                      type="button"
                      aria-pressed={layout === "list"}
                      onClick={() => setLayout("list")}
                      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
                    >
                      <List aria-hidden="true" className="h-3.5 w-3.5" /> List
                    </button>
                    <button
                      type="button"
                      aria-pressed={layout === "cards"}
                      onClick={() => setLayout("cards")}
                      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
                    >
                      <LayoutGrid aria-hidden="true" className="h-3.5 w-3.5" /> Cards
                    </button>
                  </div>
                </div>
              }
            >
              <div className="mb-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <label className="relative min-w-0">
                  <span className="sr-only">Search projects</span>
                  <Search aria-hidden="true" className="absolute left-2.5 top-2.5 h-4 w-4 text-app-text-muted" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search project key or name"
                    className={`${SELECT} w-full pl-8`}
                  />
                </label>
                <label className="sr-only" htmlFor="pm-mode-filter">Mode</label>
                <select id="pm-mode-filter" value={mode} onChange={(event) => setMode(event.target.value)} className={SELECT}>
                  <option value="ALL">All modes</option>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="STRUCTURED">Structured</option>
                </select>
                <label className="sr-only" htmlFor="pm-health-filter">Health</label>
                <select id="pm-health-filter" value={health} onChange={(event) => setHealth(event.target.value)} className={SELECT}>
                  <option value="ALL">All health</option>
                  <option value="ON_TRACK">On track</option>
                  <option value="AT_RISK">At risk</option>
                  <option value="DELAYED">Delayed</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
                <label className="sr-only" htmlFor="pm-lifecycle-filter">Lifecycle</label>
                <select id="pm-lifecycle-filter" value={lifecycle} onChange={(event) => setLifecycle(event.target.value)} className={SELECT}>
                  <option value="ALL">All lifecycle states</option>
                  {["PLANNED", "ACTIVE", "ON_HOLD", "DELIVERED", "CLOSED", "CANCELLED"].map((value) => (
                    <option key={value} value={value}>{formatLifecycle(value as Parameters<typeof formatLifecycle>[0])}</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="pm-owner-filter">Accountable owner</label>
                <select id="pm-owner-filter" value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={SELECT}>
                  <option value="ALL">All owners</option>
                  {owners.map((id) => <option key={id} value={id}>{getUserName(id, members)}</option>)}
                </select>
                <label className="sr-only" htmlFor="pm-deadline-filter">Deadline</label>
                <select id="pm-deadline-filter" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={SELECT}>
                  <option value="ALL">All deadlines</option>
                  {(["overdue", "due-soon", "later", "closed"] as const).map((value) => (
                    <option key={value} value={value}>{DEADLINE_LABELS[value]}</option>
                  ))}
                </select>
              </div>

              {visible.length === 0 ? (
                <OwnerPageState
                  state="empty"
                  title={projects.length ? "No projects match your filters" : "No readable projects"}
                  description={projects.length ? "Adjust or clear the filters." : "Projects you may read appear here."}
                />
              ) : layout === "cards" ? (
                <ul className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {visible.map((project) => {
                    const method = project.lastProgressMethod === "DEVELOPER_REPORTED"
                      ? "Developer reported"
                      : project.lastProgressMethod === "CALCULATED_BASELINE"
                        ? "Calculated baseline"
                        : "Not reported";
                    return (
                      <li key={project.id} className="min-w-0">
                        <SurfaceCard className="flex h-full flex-col gap-3 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-app-text-primary">{project.key}</span>
                            <HealthBadge health={project.health} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-app-text-primary">{project.name}</h3>
                            <p className="text-xs text-app-text-secondary">
                              {project.mode === "INDIVIDUAL" ? "Individual" : "Structured"} · {formatLifecycle(project.lifecycle)}
                            </p>
                          </div>
                          <p className="text-sm text-app-text-primary">
                            {project.lastProgressMethod === "NOT_REPORTED" ? "Not reported" : `${project.lastProgressPercent}%`}
                            <span className="ml-1 text-xs text-app-text-muted">· {method}</span>
                          </p>
                          <p className="text-xs text-app-text-secondary">
                            Target {formatDateOnly(project.targetDate, project.timezone)}
                          </p>
                          <div className="mt-auto flex flex-wrap gap-2 border-t border-app-border pt-3">
                            {resource.can("project.edit", { projectId: project.id }) && (
                              <LaterActionButton title="Project record editing ships with task 2.1">Edit project</LaterActionButton>
                            )}
                            {resource.can("project.mode.change", { projectId: project.id }) && (
                              <LaterActionButton title="Mode transitions ship with task 3.6">Change mode</LaterActionButton>
                            )}
                            {resource.can("project.deadline.edit", { projectId: project.id }) && (
                              <LaterActionButton title="Deadline and cadence changes ship with task 2.3">Change dates</LaterActionButton>
                            )}
                          </div>
                        </SurfaceCard>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <OwnerTable label="Project Manager project portfolio">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Mode / lifecycle</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Progress method</TableHead>
                      <TableHead>Target date</TableHead>
                      <TableHead>Accountable owner</TableHead>
                      <TableHead>Permitted actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((project) => {
                      const method = project.lastProgressMethod === "DEVELOPER_REPORTED"
                        ? "Developer reported"
                        : project.lastProgressMethod === "CALCULATED_BASELINE"
                          ? "Calculated baseline"
                          : "Not reported";
                      return (
                        <TableRow key={project.id}>
                          <TableCell>
                            <span className="block font-semibold text-app-text-primary">{project.key} · {project.name}</span>
                            <span className="text-xs text-app-text-muted">Progress as of {formatUtcTimestamp(project.lastReportedAt)} UTC</span>
                          </TableCell>
                          <TableCell>{project.mode === "INDIVIDUAL" ? "Individual" : "Structured"} · {formatLifecycle(project.lifecycle)}</TableCell>
                          <TableCell>
                            <HealthBadge health={project.health} />
                            <span className="mt-1 block max-w-xs text-xs text-app-text-muted">
                              {project.healthReasons.join(" · ") || "No health reason recorded"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="block font-medium text-app-text-primary">
                              {project.lastProgressMethod === "NOT_REPORTED" ? "Not reported" : `${project.lastProgressPercent}%`}
                            </span>
                            <span className="text-xs text-app-text-muted">{method}</span>
                          </TableCell>
                          <TableCell>{formatDateOnly(project.targetDate, project.timezone)}</TableCell>
                          <TableCell>{getUserName(project.accountableOwnerId, members)}</TableCell>
                          <TableCell>
                            <div className="flex min-w-28 flex-wrap gap-1">
                              {resource.can("project.edit", { projectId: project.id }) && (
                                <span className="inline-flex items-center gap-1">
                                  <LaterActionButton title="Project record editing ships with task 2.1">Edit</LaterActionButton>
                                  <OwnerLaterBadge task="2.1" />
                                </span>
                              )}
                              {resource.can("project.mode.change", { projectId: project.id }) && (
                                <span className="inline-flex items-center gap-1">
                                  <LaterActionButton title="Mode transitions ship with task 3.6">Mode</LaterActionButton>
                                  <OwnerLaterBadge task="3.6" />
                                </span>
                              )}
                              {resource.can("project.deadline.edit", { projectId: project.id }) && (
                                <span className="inline-flex items-center gap-1">
                                  <LaterActionButton title="Deadline changes ship with task 2.3">Dates</LaterActionButton>
                                  <OwnerLaterBadge task="2.3" />
                                </span>
                              )}
                            </div>
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
