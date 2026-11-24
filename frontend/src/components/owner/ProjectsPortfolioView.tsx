"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FolderKanban, LayoutGrid, List, Plus, Edit2, Users } from "lucide-react";
import { toast } from "sonner";

import { apiClient, ApiError } from "@/lib/api";
import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { FilterBar, PageHeader, StatusBadge, type StatusTone } from "@/components/owner/primitives";
import {
  DEADLINE_LABELS,
  calendarDaysUntil,
  formatDateOnly,
  type DeadlineStatus,
} from "@/components/owner/project-format";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { PermissionKey } from "@/types/permission";
import type {
  ProjectDto,
  CreateProjectDto,
  UpdateProjectDto,
} from "@/types/api";
import { ProjectFormModal } from "@/features/projects/ProjectFormModal";
import { ProjectMembersModal } from "@/features/projects/ProjectMembersModal";
import { ProjectCard } from "@/features/projects/ProjectCard";

export interface ProjectsPortfolioViewProps {
  projects: ProjectDto[];
  users: Array<{ id: string; name: string; email: string }>;
  teams: Array<{ id: string; name: string }>;
  /** False while the archive/create endpoints are not available to this view: those actions show as "Later". */
  actionsAvailable?: boolean;
  can: (key: PermissionKey) => boolean;
  basePath?: string;
  now?: string;
  onRefresh?: () => void;
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
  mode: string;
  deadline: string;
}

const NO_FILTERS: Filters = { owner: "ALL", team: "ALL", lifecycle: "ALL", mode: "ALL", deadline: "ALL" };

function projectDeadlineStatus(project: ProjectDto, now?: string): DeadlineStatus {
  if (["DELIVERED", "CLOSED", "CANCELLED"].includes(project.lifecycle)) return "closed";
  if (!project.target_on) return "later";
  const days = calendarDaysUntil(project.target_on, project.timezone, now);
  if (days < 0) return "overdue";
  return days <= 14 ? "due-soon" : "later";
}

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

export function ProjectsPortfolioView({
  projects,
  users,
  teams,
  actionsAvailable = true,
  can,
  basePath,
  now,
  onRefresh,
}: ProjectsPortfolioViewProps) {
  let orgId: string | undefined;
  try {
    const params = useParams<{ orgId?: string }>();
    orgId = params?.orgId;
  } catch {
    // harmless in unit test rendering
  }

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showArchived, setShowArchived] = useState(false);
  const [layout, setLayout] = useState<"list" | "cards">("list");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectDto | null>(null);
  const [memberManagingProject, setMemberManagingProject] = useState<ProjectDto | null>(null);

  const canCreate = can("project.create");
  const canEdit = can("project.edit");
  const canArchive = can("project.archive");
  const setFilter = (key: keyof Filters) => (value: string) => setFilters((current) => ({ ...current, [key]: value }));

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter(
      (project) =>
        (showArchived || !project.archived) &&
        (!query || project.name.toLowerCase().includes(query) || project.key.toLowerCase().includes(query)) &&
        (filters.owner === "ALL" || project.accountable?.membership_id === filters.owner) &&
        (filters.team === "ALL" || project.team_id === filters.team) &&
        (filters.lifecycle === "ALL" || project.lifecycle === filters.lifecycle) &&
        (filters.mode === "ALL" || project.mode === filters.mode) &&
        (filters.deadline === "ALL" || projectDeadlineStatus(project, now) === filters.deadline),
    );
  }, [projects, search, filters, showArchived, now]);

  const owners = Array.from(new Set(
    projects.flatMap((project) => project.accountable ? [project.accountable.membership_id] : []),
  )).map((id) => ({
    value: id,
    label: users.find((user) => user.id === id)?.name ?? users.find((user) => user.id === id)?.email ?? id,
  }));
  const hasFilters = search !== "" || showArchived || Object.values(filters).some((value) => value !== "ALL");

  const orgMembersList = useMemo(
    () => users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
    [users]
  );

  const handleCreateSubmit = async (data: CreateProjectDto | UpdateProjectDto) => {
    if (!orgId) throw new Error("An organization is required to create a project.");
    if (!("key" in data)) throw new Error("The project create request is missing its key.");
    try {
      await apiClient.createProject(orgId, data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create project.";
      toast.error("Project creation failed", { description: message });
      throw err;
    }

    toast.success("Project created successfully");
    onRefresh?.();
    setIsCreateOpen(false);
  };

  const handleEditSubmit = async (data: CreateProjectDto | UpdateProjectDto) => {
    if (!orgId || !editingProject || !("expected_version" in data)) {
      throw new Error("The project update request is incomplete.");
    }
    try {
      await apiClient.updateProject(orgId, editingProject.id, data);
      toast.success("Project updated successfully");
      onRefresh?.();
      setEditingProject(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update project.";
      toast.error("Project update failed", { description: msg });
      throw err;
    }
  };

  const handleToggleArchive = (project: ProjectDto) => {
    toast.error(`Archive/restore is not available for "${project.name}" because the backend has no corresponding endpoint.`);
  };

  const header = (
    <PageHeader
      title="Projects portfolio"
      description="Every project you may read in this organization. Individual and Structured progress are shown separately and never combined into one figure."
      actions={
        canCreate ? (
          basePath ? (
            <Link
              href={`${basePath}/projects/new`}
              className="inline-flex min-h-9 items-center rounded-lg bg-[#1A73E8] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1557B0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Create project
            </Link>
          ) : actionsAvailable ? (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#1A73E8] px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1557B0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              <Plus className="w-4 h-4" /> Create project
            </button>
          ) : (
            <>
              <LaterActionButton>Create project</LaterActionButton>
              <OwnerLaterBadge task="2.1" />
            </>
          )
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
        <OwnerPageState
          state="empty"
          icon={FolderKanban}
          title="No projects yet"
          description="Projects you can read will appear here."
        />

        {isCreateOpen && (
          <ProjectFormModal
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onSubmit={handleCreateSubmit}
            members={orgMembersList}
          />
        )}
      </div>
    );
  }

  const deadlineBadge = (project: ProjectDto) => {
    const status = projectDeadlineStatus(project, now);
    return <StatusBadge label={DEADLINE_LABELS[status]} tone={DEADLINE_TONES[status]} />;
  };

  const archiveAction = (project: ProjectDto) => {
    if (!canArchive) return null;
    if (!actionsAvailable) {
      return (
        <LaterActionButton title="Available when task 2.4 ships">
          {project.archived ? "Restore" : "Archive"}
        </LaterActionButton>
      );
    }
    return (
      <button
        type="button"
        onClick={() => handleToggleArchive(project)}
        className={`p-1 rounded text-xs font-medium transition-colors ${
          project.archived
            ? "text-blue-600 hover:bg-blue-500/10"
            : "text-app-text-secondary hover:text-red-600 hover:bg-red-500/10"
        }`}
      >
        {project.archived ? "Restore" : "Archive"}
      </button>
    );
  };

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
                  options={["PLANNED", "ACTIVE", "ON_HOLD", "AWAITING_ACCEPTANCE", "DELIVERED", "CLOSED", "CANCELLED"].map((value) => ({
                    value,
                    label: value.toLowerCase().replace(/_/g, " "),
                  }))}
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
                <label className="col-span-2 inline-flex items-center gap-2 text-xs text-app-text-secondary cursor-pointer">
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
            <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {visible.map((project) => (
                <li key={project.id} className="min-w-0">
                  <ProjectCard
                    project={project}
                    canEdit={canEdit}
                    canArchive={canArchive}
                    onEdit={() => setEditingProject(project)}
                    onManageMembers={() => setMemberManagingProject(project)}
                    onArchive={() => handleToggleArchive(project)}
                    onRestore={() => handleToggleArchive(project)}
                  />
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
                  <TableHead>Progress</TableHead>
                  <TableHead>Target date</TableHead>
                  <TableHead>Accountable owner</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <span className="block text-caption font-semibold font-mono text-app-text-secondary">[{project.key}]</span>
                      {basePath ? (
                        <Link href={`${basePath}/projects/${project.id}`} className="font-medium text-app-text-primary hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:hover:text-blue-300">
                          {project.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-app-text-primary">{project.name}</span>
                      )}
                      {project.archived && <StatusBadge label="Archived" tone="neutral" className="ml-2" />}
                    </TableCell>
                    <TableCell>{project.mode === "INDIVIDUAL" ? "Individual" : "Structured"}</TableCell>
                    <TableCell className="capitalize">{project.lifecycle.toLowerCase().replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <span className="block font-medium text-app-text-primary">
                        {project.progress.percent === null ? project.progress.label : `${project.progress.percent}%`}
                      </span>
                      <span className="text-caption text-app-text-muted">{project.progress.label}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block whitespace-nowrap">
                        {project.target_on ? formatDateOnly(project.target_on, project.timezone) : "No target date"}
                      </span>
                      {deadlineBadge(project)}
                    </TableCell>
                    <TableCell>
                      {project.accountable
                        ? users.find((user) => user.id === project.accountable?.membership_id)?.name ?? project.accountable.email
                        : "Unassigned"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canEdit && !project.archived && (
                          <button
                            type="button"
                            onClick={() => setEditingProject(project)}
                            title="Edit Project"
                            className="p-1 rounded text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!project.archived && (
                          <button
                            type="button"
                            onClick={() => setMemberManagingProject(project)}
                            title="Manage Members"
                            className="p-1 rounded text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover transition-colors"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {archiveAction(project)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </OwnerTable>
          )}
        </div>
      </OwnerPanel>

      {/* Creation Modal */}
      {isCreateOpen && (
        <ProjectFormModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={handleCreateSubmit}
          members={orgMembersList}
        />
      )}

      {/* Edit Modal */}
      {editingProject && (
        <ProjectFormModal
          isOpen={Boolean(editingProject)}
          onClose={() => setEditingProject(null)}
          onSubmit={handleEditSubmit}
          project={editingProject}
          members={orgMembersList}
        />
      )}

      {/* Members Modal */}
      {memberManagingProject && orgId && (
        <ProjectMembersModal
          isOpen={Boolean(memberManagingProject)}
          onClose={() => setMemberManagingProject(null)}
          project={memberManagingProject}
          orgMembers={orgMembersList}
          orgId={orgId}
        />
      )}
    </div>
  );
}
