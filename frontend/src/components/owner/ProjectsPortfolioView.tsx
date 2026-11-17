"use client";

import React, { useMemo, useState } from "react";
import { FolderKanban, LayoutGrid, List } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { FilterBar, PageHeader, StatusBadge, SurfaceCard, type StatusTone } from "@/components/owner/primitives";
import {
  DEADLINE_LABELS,
  deadlineStatus,
  formatDateOnly,
  formatLifecycle,
  getOwnerName,
  getProgressMethodLabel,
  getProgressValue,
  type DeadlineStatus,
} from "@/components/owner/project-format";
import { HealthBadge } from "@/components/ui/health-badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PortfolioData } from "@/lib/fixtures/org-admin";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";
import type { PermissionKey } from "@/types/permission";

export interface ProjectsPortfolioViewProps extends PortfolioData {
  source: "api" | "fixture";
  can: (key: PermissionKey) => boolean;
  now?: string;
}

const DEADLINE_TONES: Record<DeadlineStatus, StatusTone> = {
  overdue: "danger",
  "due-soon": "warning",
  later: "neutral",
  closed: "neutral",
};

const SELECT =
  "h-9 w-full min-w-0 rounded-lg border border-app-border bg-app-bg px-2 text-xs text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent sm:w-auto sm:text-sm";

interface Filters {
  owner: string;
  team: string;
  lifecycle: string;
  health: string;
  mode: string;
  deadline: string;
}

const NO_FILTERS: Filters = { owner: "ALL", team: "ALL", lifecycle: "ALL", health: "ALL", mode: "ALL", deadline: "ALL" };

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-app-text-muted sm:flex-row sm:items-center sm:gap-2 sm:text-xs">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={SELECT}>
        <option value="ALL">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ProjectsPortfolioView({ projects, users, teams, source, can, now }: ProjectsPortfolioViewProps) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showArchived, setShowArchived] = useState(false);
  const [layout, setLayout] = useState<"list" | "cards">("list");

  const canCreate = can("project.create");
  const canArchive = can("project.archive");
  const setFilter = (key: keyof Filters) => (value: string) => setFilters((current) => ({ ...current, [key]: value }));

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter(
      (project) =>
        (showArchived || !project.archived) &&
        (!query || project.name.toLowerCase().includes(query) || project.key.toLowerCase().includes(query)) &&
        (filters.owner === "ALL" || project.accountableOwnerId === filters.owner) &&
        (filters.team === "ALL" || project.teamIds.includes(filters.team)) &&
        (filters.lifecycle === "ALL" || project.lifecycle === filters.lifecycle) &&
        (filters.health === "ALL" || project.health === filters.health) &&
        (filters.mode === "ALL" || project.mode === filters.mode) &&
        (filters.deadline === "ALL" || deadlineStatus(project, now) === filters.deadline),
    );
  }, [projects, search, filters, showArchived, now]);

  const owners = Array.from(new Set(projects.map((project) => project.accountableOwnerId))).map((id) => ({
    value: id,
    label: users.find((user) => user.id === id)?.name ?? id,
  }));
  const hasFilters = search !== "" || showArchived || Object.values(filters).some((value) => value !== "ALL");

  const header = (
    <PageHeader
      title="Projects portfolio"
      description="Every project you may read in this organization. Individual and Structured progress are shown separately and never combined into one figure."
      simulationLabel={source === "fixture" ? "Sample data" : undefined}
      actions={
        canCreate ? (
          <>
            <LaterActionButton>Create project</LaterActionButton>
            <OwnerLaterBadge task="2.1" />
          </>
        ) : undefined
      }
    />
  );

  if (!can("project.read")) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState state="forbidden" requiredPermission="project.read" description="Viewing the portfolio requires project.read." />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState state="empty" icon={FolderKanban} title="No projects yet" description="Projects you can read will appear here." />
      </div>
    );
  }

  const deadlineBadge = (project: Project) => {
    const status = deadlineStatus(project, now);
    return <StatusBadge label={DEADLINE_LABELS[status]} tone={DEADLINE_TONES[status]} />;
  };
  const archiveAction = (project: Project) =>
    canArchive ? <LaterActionButton title="Available when task 2.4 ships">{project.archived ? "Restore" : "Archive"}</LaterActionButton> : null;

  return (
    <div className="space-y-4">
      {header}
      <OwnerPanel
        title="Projects"
        description={`${visible.length} of ${projects.length} projects`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Layout" className="inline-flex rounded-lg border border-app-border p-0.5">
              {(["list", "cards"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={layout === value}
                  onClick={() => setLayout(value)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent motion-reduce:transition-none",
                    layout === value ? "bg-blue-500/15 text-blue-700 dark:text-blue-300" : "text-app-text-secondary hover:bg-app-hover",
                  )}
                >
                  {value === "list" ? <List aria-hidden="true" className="h-3.5 w-3.5" /> : <LayoutGrid aria-hidden="true" className="h-3.5 w-3.5" />}
                  {value === "list" ? "List" : "Cards"}
                </button>
              ))}
            </div>
            <LaterActionButton>Save filters</LaterActionButton>
            <OwnerLaterBadge task="5.3" />
            {canArchive && <OwnerLaterBadge task="2.4" />}
          </div>
        }
      >
        <div className="space-y-3">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by project name or key"
            hasActiveFilters={hasFilters}
            onResetFilters={() => {
              setSearch("");
              setFilters(NO_FILTERS);
              setShowArchived(false);
            }}
            filters={
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                <FilterSelect label="Owner" value={filters.owner} onChange={setFilter("owner")} options={owners} />
                <FilterSelect label="Team" value={filters.team} onChange={setFilter("team")} options={teams.map((team) => ({ value: team.id, label: team.name }))} />
                <FilterSelect
                  label="Lifecycle"
                  value={filters.lifecycle}
                  onChange={setFilter("lifecycle")}
                  options={["PLANNED", "ACTIVE", "ON_HOLD", "DELIVERED", "CLOSED", "CANCELLED"].map((value) => ({
                    value,
                    label: formatLifecycle(value as Project["lifecycle"]),
                  }))}
                />
                <FilterSelect
                  label="Health"
                  value={filters.health}
                  onChange={setFilter("health")}
                  options={[
                    { value: "ON_TRACK", label: "On track" },
                    { value: "AT_RISK", label: "At risk" },
                    { value: "DELAYED", label: "Delayed" },
                    { value: "UNKNOWN", label: "Unknown" },
                  ]}
                />
                <FilterSelect
                  label="Mode"
                  value={filters.mode}
                  onChange={setFilter("mode")}
                  options={[
                    { value: "INDIVIDUAL", label: "Individual" },
                    { value: "STRUCTURED", label: "Structured" },
                  ]}
                />
                <FilterSelect
                  label="Deadline"
                  value={filters.deadline}
                  onChange={setFilter("deadline")}
                  options={(["overdue", "due-soon", "later", "closed"] as const).map((value) => ({ value, label: DEADLINE_LABELS[value] }))}
                />
                <label className="col-span-2 inline-flex items-center gap-2 text-xs text-app-text-secondary">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(event) => setShowArchived(event.target.checked)}
                    className="h-4 w-4 rounded border-app-border"
                  />
                  Show archived
                </label>
              </div>
            }
          />

          {visible.length === 0 ? (
            <OwnerPageState state="empty" title="No projects match your filters" description="Change or reset the filters." />
          ) : layout === "cards" ? (
            <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {visible.map((project) => (
                <li key={project.id} className="min-w-0">
                  <SurfaceCard className="flex h-full flex-col gap-2 p-4 transition-shadow hover:shadow-floating motion-reduce:transition-none">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-caption font-semibold text-app-text-secondary">{project.key}</span>
                      <HealthBadge health={project.health} showIcon={false} />
                      {project.archived && <StatusBadge label="Archived" tone="neutral" />}
                    </div>
                    <h3 className="text-sm font-semibold text-app-text-primary">{project.name}</h3>
                    <p className="text-caption text-app-text-secondary">
                      {project.mode === "INDIVIDUAL" ? "Individual" : "Structured"} · {formatLifecycle(project.lifecycle)}
                    </p>
                    <p className="text-sm text-app-text-primary">
                      {getProgressValue(project)} <span className="text-caption text-app-text-muted">· {getProgressMethodLabel(project)}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-caption text-app-text-secondary">
                      <span>Target {formatDateOnly(project.targetDate, project.timezone)}</span>
                      {deadlineBadge(project)}
                    </div>
                    <p className="text-caption text-app-text-muted">Owner: {getOwnerName(project, users)}</p>
                    {archiveAction(project) && <div className="mt-auto pt-1">{archiveAction(project)}</div>}
                  </SurfaceCard>
                </li>
              ))}
            </ul>
          ) : (
            <OwnerTable label="Projects">
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Lifecycle</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Target date</TableHead>
                  <TableHead>Accountable owner</TableHead>
                  {canArchive && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <span className="block text-caption font-semibold text-app-text-secondary">{project.key}</span>
                      <span className="font-medium text-app-text-primary">{project.name}</span>
                      {project.archived && <StatusBadge label="Archived" tone="neutral" className="ml-2" />}
                    </TableCell>
                    <TableCell>{project.mode === "INDIVIDUAL" ? "Individual" : "Structured"}</TableCell>
                    <TableCell className="capitalize">{formatLifecycle(project.lifecycle)}</TableCell>
                    <TableCell>
                      <HealthBadge health={project.health} showIcon={false} />
                    </TableCell>
                    <TableCell>
                      <span className="block font-medium text-app-text-primary">{getProgressValue(project)}</span>
                      <span className="text-caption text-app-text-muted">{getProgressMethodLabel(project)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block whitespace-nowrap">{formatDateOnly(project.targetDate, project.timezone)}</span>
                      {deadlineBadge(project)}
                    </TableCell>
                    <TableCell>{getOwnerName(project, users)}</TableCell>
                    {canArchive && <TableCell>{archiveAction(project)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </OwnerTable>
          )}
        </div>
      </OwnerPanel>
    </div>
  );
}
