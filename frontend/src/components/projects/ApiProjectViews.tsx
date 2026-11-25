"use client";

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  FolderKanban,
  FolderPlus,
  GitBranch,
  MessageSquareText,
  Pencil,
  Search,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/store/auth-store";
import { isStaleVersion, type ApiError } from "@/lib/api";
import type {
  CreateProjectDto,
  ProjectDto,
  ProjectLifecycleDto,
  ProjectModeDto,
  ProjectOptionsDto,
  ProjectPriorityDto,
  UpdateProjectDto,
} from "@/types/api";
import type { PermissionKey } from "@/types/permission";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  ButtonLink,
  DataTable,
  EmptyStateView,
  ErrorBanner,
  NotFoundState,
  PageFrame,
  PageSkeleton,
  Panel,
  SegmentTabs,
  StatPill,
  StatusBadge,
  SurfaceCard,
  formatDateTime,
} from "@/components/delivery/DeliveryUI";
import { AccessDeniedState, AccessLostState, SessionExpiredState } from "@/components/org-console/AccessStates";
import { StaleVersionBanner } from "@/components/org-console/StaleVersionBanner";
import { formatDay } from "@/components/projects/formatDay";
import { endAfterStartChange, endDateError, isIsoDate, localToday, startDateError } from "@/components/projects/projectDates";
import { ProgressSummaryContent } from "@/components/progress/CheckInViews";
import { useProgressSummary } from "@/components/progress/useCheckInApi";
import { apiErrorMessage, type LoadState } from "@/components/org-console/useRoleApi";
import {
  type PortfolioFilters,
  useProject,
  useProjectDateHistory,
  useProjectMutations,
  useProjectOptions,
  usePortfolio,
  useReloadProjects,
} from "./useProjectApi";
import { ApproversPanel, DocumentsPanel, GitHubPanel, ProjectGitHubActivity, ProjectTasksPanel, StructuredProgressPanel } from "@/components/flow/ProjectFlowPanels";

/**
 * Task 2.1 project screens on the real API for the Owner, Admin and Project Manager route families.
 * Create and edit are full pages (no popups) with a back link and breadcrumb. The server decides which
 * projects a person may read; buttons only appear when the person holds the permission.
 */

export type ProjectBase = "owner" | "admin" | "manager";

const BASE_LABEL: Record<ProjectBase, string> = { owner: "Owner", admin: "Admin", manager: "Project Manager" };

export const LIFECYCLE_LABEL: Record<ProjectLifecycleDto, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  AWAITING_ACCEPTANCE: "Awaiting acceptance",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};
const LIFECYCLE_TONE: Record<ProjectLifecycleDto, "success" | "warning" | "danger" | "info" | "neutral" | "violet"> = {
  PLANNED: "info",
  ACTIVE: "success",
  ON_HOLD: "warning",
  AWAITING_ACCEPTANCE: "violet",
  DELIVERED: "success",
  CLOSED: "neutral",
  CANCELLED: "danger",
};
const MODE_LABEL: Record<ProjectModeDto, string> = { INDIVIDUAL: "Individual", STRUCTURED: "Structured" };
const PRIORITIES: ProjectPriorityDto[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
/** Lifecycle moves that are plain edits (2.1). Acceptance, delivery, closing and cancelling come with 2.4. */
const EDIT_TRANSITIONS: Partial<Record<ProjectLifecycleDto, ProjectLifecycleDto[]>> = {
  PLANNED: ["ACTIVE", "ON_HOLD"],
  ACTIVE: ["ON_HOLD"],
  ON_HOLD: ["ACTIVE"],
};

function useBaseHref(base: ProjectBase) {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  return useMemo(() => ({ orgId, href: (path = "dashboard") => `/org/${orgId}/${base}/${path}` }), [orgId, base]);
}

export { formatDay };

const createPath = (base: ProjectBase) => (base === "manager" ? "create-project" : "projects/new");

function timeZones(current?: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = ["UTC", "Europe/London", "America/New_York", "Asia/Kolkata"];
  }
  return current && !zones.includes(current) ? [current, ...zones] : zones;
}

function suggestKey(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const initials = words.length > 1 ? words.map((w) => w[0]).join("") : words[0];
  const key = initials.replace(/^[0-9]+/, "").slice(0, 6);
  return key.length >= 2 ? key : `${key}${words[0].slice(1, 3)}`.slice(0, 6);
}

function ProjectGate<T>({ state, base, notFound, children }: {
  state: LoadState<T>;
  base: ProjectBase;
  notFound?: boolean;
  children: (data: T) => React.ReactNode;
}) {
  const { href } = useBaseHref(base);
  if (state.kind === "loading") return <PageSkeleton variant="list" />;
  if (state.kind === "forbidden") return <AccessDeniedState permission="project.read" backHref={href()} />;
  if (state.kind === "access-lost") {
    return notFound ? <NotFoundState what="Project" back={{ href: href("projects"), label: "Back to projects" }} /> : <AccessLostState />;
  }
  if (state.kind === "unauthenticated") return <SessionExpiredState />;
  if (state.kind === "error") return <ErrorBanner message="Projects could not be loaded." onRetry={state.retry} />;
  return <>{children(state.data)}</>;
}

function ErrorLine({ message }: { message: string }) {
  if (!message) return null;
  return <p role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{message}</p>;
}

function ProgressLabel({ project }: { project: ProjectDto }) {
  if (project.progress.percent === null) {
    return <span className="text-[var(--color-text-muted)]">{project.progress.label}</span>;
  }
  return <span>{project.progress.percent}% · {project.progress.label}</span>;
}

/* ======================================================================
 * All Projects
 * ==================================================================== */

type ViewMode = "list" | "cards";
type SortKey = "name" | "target" | "updated";

export function ProjectsPortfolioView({ base }: { base: ProjectBase }) {
  const { orgId, href } = useBaseHref(base);
  const { can } = usePermissions();
  const [view, setView] = useState<ViewMode>("list");
  const [sort, setSort] = useState<SortKey>("name");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [owner, setOwner] = useState("");
  const [team, setTeam] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const q = useDeferredValue(search.trim());
  const filters: PortfolioFilters = { q, status, mode, owner, team, from, to };
  const filtered = Boolean(q || status || mode || owner || team || from || to);
  const portfolio = usePortfolio(orgId, filters);
  const options = useProjectOptions(orgId);
  const people = options.kind === "ready" ? options.data.members : [];
  const teams = options.kind === "ready" ? options.data.teams : [];

  return (
    <PageFrame
      crumbs={[{ label: BASE_LABEL[base], href: href() }, { label: "All projects" }]}
      title="All projects"
      description="Only projects you are allowed to read are listed. Progress shows “Not reported” until someone reports it."
      actions={can("project.create" as PermissionKey)
        ? <ButtonLink href={href(createPath(base))}><FolderPlus className="w-3.5 h-3.5" /> Create project</ButtonLink>
        : undefined}
    >
      <SurfaceCard className="p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-[1.85rem] w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <AdminInput label="Search name or key" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-36"><AdminSelect label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            {(Object.keys(LIFECYCLE_LABEL) as ProjectLifecycleDto[]).map((value) => <option key={value} value={value}>{LIFECYCLE_LABEL[value]}</option>)}
          </AdminSelect></div>
          <div className="w-32"><AdminSelect label="Mode" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="">Any mode</option>
            <option value="INDIVIDUAL">Individual</option>
            <option value="STRUCTURED">Structured</option>
          </AdminSelect></div>
          {people.length > 0 && (
            <div className="w-48"><AdminSelect label="Owner or PM" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Anyone</option>
              {people.map((person) => <option key={person.membership_id} value={person.membership_id}>{person.email}</option>)}
            </AdminSelect></div>
          )}
          {teams.length > 0 && (
            <div className="w-40"><AdminSelect label="Team" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">Any team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </AdminSelect></div>
          )}
          <div className="w-36"><AdminInput label="Target from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="w-36"><AdminInput label="Target to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentTabs<SortKey> value={sort} onChange={setSort} options={[
            { value: "name", label: "Name" },
            { value: "target", label: "Target date" },
            { value: "updated", label: "Recently updated" },
          ]} />
          <SegmentTabs<ViewMode> value={view} onChange={setView} options={[
            { value: "list", label: "List" },
            { value: "cards", label: "Cards" },
          ]} />
        </div>
      </SurfaceCard>
      <ProjectGate state={portfolio.state} base={base}>
        {(rows) => {
          const sorted = [...rows].sort((a, b) => {
            if (sort === "target") return (a.target_on ?? "9999").localeCompare(b.target_on ?? "9999") || a.name.localeCompare(b.name);
            if (sort === "updated") return b.updated_at.localeCompare(a.updated_at);
            return 0; // server order: name, then id
          });
          if (sorted.length === 0) {
            return (
              <SurfaceCard>
                <EmptyStateView
                  icon={FolderKanban}
                  title={filtered ? "No projects match your filters" : "No projects yet"}
                  description={filtered ? "Change or clear the filters to see more projects." : "Projects you can read will appear here."}
                />
              </SurfaceCard>
            );
          }
          return (
            <>
              {view === "list" ? (
                <DataTable<ProjectDto>
                  rows={sorted}
                  rowHref={(row) => href(`projects/${row.id}`)}
                  columns={[
                    { key: "name", header: "Project", render: (row) => (
                      <span className="min-w-0">
                        <span className="block font-medium truncate">{row.name}</span>
                        <span className="block text-[10px] text-[var(--color-text-muted)]">{row.key} · {MODE_LABEL[row.mode]}</span>
                      </span>
                    ) },
                    { key: "status", header: "Status", render: (row) => <StatusBadge label={LIFECYCLE_LABEL[row.lifecycle]} tone={LIFECYCLE_TONE[row.lifecycle]} dot /> },
                    { key: "owner", header: "Owner / PM", hideBelow: "md", render: (row) => row.accountable?.email ?? row.project_manager?.email ?? "—" },
                    { key: "target", header: "Target", hideBelow: "sm", render: (row) => formatDay(row.target_on) },
                    { key: "progress", header: "Progress", hideBelow: "lg", render: (row) => <ProgressLabel project={row} /> },
                  ]}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                  {sorted.map((row) => (
                    <Link key={row.id} href={href(`projects/${row.id}`)} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl">
                      <SurfaceCard className="p-4 h-full hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{row.key} · {MODE_LABEL[row.mode]}</p>
                            <p className="mt-0.5 font-semibold truncate">{row.name}</p>
                          </div>
                          <StatusBadge label={LIFECYCLE_LABEL[row.lifecycle]} tone={LIFECYCLE_TONE[row.lifecycle]} dot />
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                          <div><dt className="text-[var(--color-text-muted)]">Target</dt><dd className="font-medium">{formatDay(row.target_on)}</dd></div>
                          <div><dt className="text-[var(--color-text-muted)]">Progress</dt><dd className="font-medium"><ProgressLabel project={row} /></dd></div>
                          <div className="col-span-2 truncate"><dt className="text-[var(--color-text-muted)]">Owner / PM</dt><dd className="font-medium truncate">{row.accountable?.email ?? row.project_manager?.email ?? "—"}</dd></div>
                        </dl>
                      </SurfaceCard>
                    </Link>
                  ))}
                </div>
              )}
              {portfolio.hasMore && (
                <div className="flex justify-center">
                  <AdminButton variant="outline" isLoading={portfolio.loadingMore} onClick={portfolio.loadMore}>Load more</AdminButton>
                </div>
              )}
            </>
          );
        }}
      </ProjectGate>
    </PageFrame>
  );
}

/* ======================================================================
 * Create project
 * ==================================================================== */

interface FormState {
  name: string;
  key: string;
  keyTouched: boolean;
  description: string;
  mode: ProjectModeDto;
  status: "PLANNED" | "ACTIVE";
  priority: ProjectPriorityDto;
  pm: string;
  accountable: string;
  members: string[];
  team: string;
  startOn: string;
  targetOn: string;
  timezone: string;
}

export function ProjectCreateView({ base }: { base: ProjectBase }) {
  const { orgId, href } = useBaseHref(base);
  const router = useRouter();
  const { can, status: permissionStatus } = usePermissions();
  const options = useProjectOptions(orgId);
  const { createProject } = useProjectMutations(orgId);
  const [error, setError] = useState("");

  if (permissionStatus === "ready" && !can("project.create" as PermissionKey)) {
    return (
      <PageFrame crumbs={[{ label: BASE_LABEL[base], href: href() }, { label: "Create project" }]} title="Create project">
        <AccessDeniedState permission="project.create" backHref={href("projects")} />
      </PageFrame>
    );
  }

  return (
    <PageFrame
      crumbs={[{ label: BASE_LABEL[base], href: href() }, { label: "All projects", href: href("projects") }, { label: "Create project" }]}
      back={{ href: href("projects"), label: "Back to projects" }}
      title="Create project"
      description="An Individual project needs one accountable developer and starts with zero tasks and no percentage."
    >
      <ProjectGate state={options} base={base}>
        {(data) => (
          <CreateForm
            options={data}
            saving={createProject.isPending}
            error={error}
            onSubmit={(body) => {
              setError("");
              createProject.mutate(body, {
                onSuccess: (project) => {
                  toast.success(`${project.key} created`);
                  router.push(href(`projects/${project.id}`));
                },
                onError: (failure) => setError(apiErrorMessage(failure)),
              });
            }}
            onInvalid={setError}
          />
        )}
      </ProjectGate>
    </PageFrame>
  );
}

function CreateForm({ options, saving, error, onSubmit, onInvalid }: {
  options: ProjectOptionsDto;
  saving: boolean;
  error: string;
  onSubmit: (body: CreateProjectDto) => void;
  onInvalid: (message: string) => void;
}) {
  // A Project Manager creating a project is its PM by default (still changeable): developers' submissions come to the
  // project's PM to accept or reject.
  const currentRole = useAuthStore((s) => s.currentRole);
  const myEmail = useAuthStore((s) => s.currentUser?.email ?? "");
  const selfMembership = currentRole === "PROJECT_MANAGER"
    ? options.members.find((m) => m.email.toLowerCase() === myEmail.toLowerCase())?.membership_id ?? ""
    : "";
  const [form, setForm] = useState<FormState>({
    name: "", key: "", keyTouched: false, description: "", mode: "INDIVIDUAL", status: "PLANNED", priority: "MEDIUM",
    pm: selfMembership, accountable: "", members: [], team: "", startOn: "", targetOn: "", timezone: options.default_timezone,
  });
  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((current) => ({ ...current, [field]: value }));
  const zones = useMemo(() => timeZones(form.timezone), [form.timezone]);
  // The user's local calendar day (not UTC).
  const today = useMemo(() => localToday(), []);

  return (
    <form
      className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start"
      onSubmit={(event) => {
        event.preventDefault();
        if (!form.name.trim()) return onInvalid("Enter a project name.");
        if (!/^[A-Z][A-Z0-9]{1,9}$/.test(form.key)) return onInvalid("The key needs 2 to 10 capital letters or digits and must start with a letter.");
        if (form.mode === "INDIVIDUAL" && !form.accountable) return onInvalid("Choose the accountable developer for an Individual project.");
        const startProblem = startDateError(form.startOn, today);
        if (startProblem) return onInvalid(startProblem);
        const endProblem = endDateError(form.targetOn, form.startOn);
        if (endProblem) return onInvalid(endProblem);
        onSubmit({
          name: form.name.trim(),
          key: form.key,
          description: form.description.trim() || null,
          mode: form.mode,
          status: form.status,
          priority: form.priority,
          project_manager_membership_id: form.pm || null,
          accountable_membership_id: form.accountable || null,
          member_membership_ids: form.members,
          team_id: form.team || null,
          start_on: form.startOn || null,
          target_on: form.targetOn || null,
          timezone: form.timezone,
        });
      }}
    >
      <div className="xl:col-span-2 space-y-4">
        <Panel title="Project" icon={FolderPlus}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <AdminInput label="Name" value={form.name} maxLength={200} onChange={(e) => {
                  const name = e.target.value;
                  setForm((current) => ({ ...current, name, key: current.keyTouched ? current.key : suggestKey(name) }));
                }} />
              </div>
              <AdminInput label="Key (stable, unique)" value={form.key} maxLength={10}
                onChange={(e) => setForm((current) => ({ ...current, key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""), keyTouched: true }))} />
            </div>
            <AdminTextarea label="Scope description" rows={4} value={form.description} maxLength={5000} onChange={(e) => set("description", e.target.value)} />
          </div>
        </Panel>
        <Panel title="Mode" icon={FolderKanban} description="Mode changes later go through an approved transition.">
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <legend className="sr-only">Mode</legend>
            {(["INDIVIDUAL", "STRUCTURED"] as ProjectModeDto[]).map((value) => (
              <label key={value} className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] p-3 cursor-pointer has-[:checked]:border-blue-500">
                <input type="radio" name="mode" checked={form.mode === value} onChange={() => set("mode", value)} />
                <span>
                  <b>{MODE_LABEL[value]}</b>
                  <span className="block text-[var(--color-text-muted)]">
                    {value === "INDIVIDUAL"
                      ? "One accountable developer reports progress. No tasks needed."
                      : "Weighted, approved and reviewed work breakdown (task 3.x)."}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </Panel>
        <Panel title="People" icon={Users}>
          <PeopleFields options={options} pm={form.pm} accountable={form.accountable} members={form.members} team={form.team}
            mode={form.mode} onPm={(value) => set("pm", value)} onAccountable={(value) => set("accountable", value)}
            onMembers={(value) => set("members", value)} onTeam={(value) => set("team", value)} />
        </Panel>
      </div>
      <div className="space-y-4">
        <Panel title="Schedule" icon={CalendarDays} description="Dates are calendar days in the project time zone.">
          <div className="space-y-3">
            <AdminInput label="Start date" type="date" value={form.startOn} min={today}
              error={startDateError(form.startOn, today) ?? undefined}
              onChange={(e) => {
                const startOn = e.target.value;
                // A start after the current end date clears the end date.
                setForm((current) => ({ ...current, startOn, targetOn: endAfterStartChange(current.targetOn, startOn) }));
              }} />
            <AdminInput label="Target date" type="date" value={form.targetOn}
              min={form.startOn && isIsoDate(form.startOn) ? form.startOn : today}
              disabled={!form.startOn || !isIsoDate(form.startOn)}
              helperText={!form.startOn ? "Pick a start date first." : undefined}
              error={endDateError(form.targetOn, form.startOn) ?? undefined}
              onChange={(e) => set("targetOn", e.target.value)} />
            <AdminSelect label="Time zone" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </AdminSelect>
          </div>
        </Panel>
        <Panel title="Status" icon={Settings}>
          <div className="space-y-3">
            <AdminSelect label="Priority" value={form.priority} onChange={(e) => set("priority", e.target.value as ProjectPriorityDto)}>
              {PRIORITIES.map((value) => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}
            </AdminSelect>
            <AdminSelect label="Start as" value={form.status} onChange={(e) => set("status", e.target.value as "PLANNED" | "ACTIVE")}>
              <option value="PLANNED">Planned</option>
              <option value="ACTIVE">Active</option>
            </AdminSelect>
          </div>
        </Panel>
        <ErrorLine message={error} />
        <AdminButton type="submit" isLoading={saving} className="w-full"><FolderPlus className="w-3.5 h-3.5" /> Create project</AdminButton>
      </div>
    </form>
  );
}

function PeopleFields(props: {
  options: ProjectOptionsDto;
  mode: ProjectModeDto;
  pm: string;
  accountable: string;
  members: string[];
  team: string;
  onPm: (value: string) => void;
  onAccountable: (value: string) => void;
  onMembers: (value: string[]) => void;
  onTeam: (value: string) => void;
}) {
  const people = props.options.members;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AdminSelect label={props.mode === "INDIVIDUAL" ? "Accountable developer (required)" : "Accountable developer (optional)"}
          value={props.accountable} onChange={(e) => props.onAccountable(e.target.value)}>
          <option value="">Choose…</option>
          {people.map((person) => <option key={person.membership_id} value={person.membership_id}>{person.email}</option>)}
        </AdminSelect>
        <AdminSelect label="Project manager" value={props.pm} onChange={(e) => props.onPm(e.target.value)}>
          <option value="">None</option>
          {people.map((person) => <option key={person.membership_id} value={person.membership_id}>{person.email}</option>)}
        </AdminSelect>
      </div>
      {props.options.teams.length > 0 && (
        <AdminSelect label="Team (optional)" value={props.team} onChange={(e) => props.onTeam(e.target.value)}>
          <option value="">No team</option>
          {props.options.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </AdminSelect>
      )}
      <fieldset>
        <legend className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Members (the owner and PM are added automatically)</legend>
        {people.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">No active members.</p>
        ) : (
          <div className="max-h-52 overflow-y-auto rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {people.map((person) => {
              const checked = props.members.includes(person.membership_id);
              return (
                <label key={person.membership_id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => props.onMembers(checked
                    ? props.members.filter((id) => id !== person.membership_id)
                    : [...props.members, person.membership_id])} />
                  <span className="truncate">{person.email}</span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
    </div>
  );
}

/* ======================================================================
 * Project workspace shell
 * ==================================================================== */

type WorkspaceTab = "overview" | "updates" | "tasks" | "progress" | "repositories" | "github" | "documents" | "approvers" | "activity" | "settings";

export function ProjectWorkspaceView({ base, projectId }: { base: ProjectBase; projectId: string }) {
  const { orgId, href } = useBaseHref(base);
  const state = useProject(orgId, projectId);
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const project = state.kind === "ready" ? state.data : null;

  return (
    <PageFrame
      crumbs={[{ label: BASE_LABEL[base], href: href() }, { label: "All projects", href: href("projects") }, { label: project?.key ?? "Project" }]}
      back={{ href: href("projects"), label: "Back to projects" }}
      title={project ? `${project.key} · ${project.name}` : "Project"}
      description={project?.description ?? undefined}
      actions={project?.can_edit ? <ButtonLink variant="outline" href={href(`projects/${project.id}/edit`)}><Pencil className="w-3.5 h-3.5" /> Edit</ButtonLink> : undefined}
    >
      <ProjectGate state={state} base={base} notFound>
        {(row) => {
          const tabs: { value: WorkspaceTab; label: string }[] = row.mode === "INDIVIDUAL"
            ? [
              { value: "overview", label: "Overview" },
              { value: "updates", label: "Updates" },
              { value: "repositories", label: "Repository" },
              { value: "github", label: "GitHub Activity" },
              { value: "documents", label: "Documents" },
              { value: "approvers", label: "Approvers" },
              { value: "activity", label: "Activity" },
              { value: "settings", label: "Settings" },
            ]
            : [
              { value: "overview", label: "Overview" },
              { value: "tasks", label: "Tasks" },
              { value: "progress", label: "Progress" },
              { value: "repositories", label: "Repository" },
              { value: "github", label: "GitHub Activity" },
              { value: "documents", label: "Documents" },
              { value: "approvers", label: "Approvers" },
              { value: "activity", label: "Activity" },
              { value: "settings", label: "Settings" },
            ];
          return (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={MODE_LABEL[row.mode]} tone="violet" />
                <StatusBadge label={LIFECYCLE_LABEL[row.lifecycle]} tone={LIFECYCLE_TONE[row.lifecycle]} dot />
                <StatusBadge label={`Priority ${row.priority.toLowerCase()}`} tone={row.priority === "CRITICAL" || row.priority === "HIGH" ? "warning" : "neutral"} />
                {row.archived && <StatusBadge label="Archived · read-only" tone="neutral" />}
              </div>
              <SegmentTabs<WorkspaceTab> value={tab} onChange={setTab} options={tabs} />
              {tab === "overview" && <OverviewTab project={row} />}
              {tab === "overview" && row.mode === "STRUCTURED" && <StructuredProgressPanel projectId={row.id} />}
              {tab === "updates" && <UpdatesTab projectId={row.id} />}
              {tab === "tasks" && <ProjectTasksPanel projectId={row.id} />}
              {tab === "progress" && <StructuredProgressPanel projectId={row.id} />}
              {tab === "repositories" && <GitHubPanel projectId={row.id} onViewActivity={() => setTab("github")} />}
              {tab === "github" && <ProjectGitHubActivity projectId={row.id} onConnect={() => setTab("repositories")} />}
              {tab === "documents" && <DocumentsPanel projectId={row.id} canEdit={row.can_edit} />}
              {tab === "approvers" && <ApproversPanel projectId={row.id} />}
              {tab === "activity" && <ActivityTab orgId={orgId} project={row} />}
              {tab === "settings" && (
                <Panel title="Settings" icon={Settings}>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <Detail label="Key" value={row.key} />
                    <Detail label="Mode" value={MODE_LABEL[row.mode]} />
                    <Detail label="Time zone" value={row.timezone} />
                    <Detail label="Version" value={row.version} />
                  </dl>
                  <div className="mt-3">
                    {row.can_edit
                      ? <ButtonLink href={href(`projects/${row.id}/edit`)}><Pencil className="w-3.5 h-3.5" /> Edit project</ButtonLink>
                      : <p className="text-[11px] text-[var(--color-text-muted)]">You can read this project but not edit it.</p>}
                  </div>
                </Panel>
              )}
            </>
          );
        }}
      </ProjectGate>
    </PageFrame>
  );
}

/** Task 2.2: approved figure, pending entry (shown separately) and the full check-in history. Read-only here. */
function UpdatesTab({ projectId }: { projectId: string }) {
  const state = useProgressSummary(projectId);
  if (state.kind === "loading") return <PageSkeleton variant="list" />;
  if (state.kind !== "ready") {
    return <ErrorBanner message="Progress updates could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />;
  }
  return <ProgressSummaryContent summary={state.data} />;
}

function OverviewTab({ project }: { project: ProjectDto }) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatPill label="Target date" value={formatDay(project.target_on)} />
        <StatPill label="Progress" value={project.progress.percent === null ? project.progress.label : `${project.progress.percent}%`}
          tone={project.progress.percent === null ? "neutral" : "success"} />
        <StatPill label="Tasks" value={project.task_count} />
        <StatPill label="Status" value={LIFECYCLE_LABEL[project.lifecycle]} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <Panel title="Schedule" icon={CalendarDays}>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <Detail label="Start" value={formatDay(project.start_on)} />
            <Detail label="Target" value={formatDay(project.target_on)} />
            <Detail label="Time zone" value={project.timezone} />
            <Detail label="Last updated" value={formatDateTime(project.updated_at)} />
          </dl>
          {project.progress.percent === null ? (
            <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
              Not reported: no approved check-in yet. Prowise never invents a percentage from tasks, time or code activity.
            </p>
          ) : (
            <p className="mt-3 text-[11px] text-[var(--color-text-secondary)]" data-testid="progress-source">
              {project.progress.percent}% · {project.progress.label}
              {project.progress.reported_at ? ` · reported ${formatDateTime(project.progress.reported_at)}` : ""}.
              See Updates for any check-in waiting for approval.
            </p>
          )}
        </Panel>
        <Panel title="People" icon={UserRound}>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <Detail label="Accountable developer" value={project.accountable?.email ?? "None"} />
            <Detail label="Project manager" value={project.project_manager?.email ?? "None"} />
            <Detail label="Team" value={project.team_name ?? "None"} />
            <Detail label="Members" value={project.members.length} />
          </dl>
          {project.members.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {project.members.map((member) => (
                <li key={member.membership_id} className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px]">{member.email}</li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function ActivityTab({ orgId, project }: { orgId: string; project: ProjectDto }) {
  const history = useProjectDateHistory(orgId, project.id);
  return (
    <Panel title="Target date changes" icon={Activity} description="Every change keeps the previous and new date, the reason and who changed it.">
      {history.kind === "loading" && <PageSkeleton variant="list" />}
      {history.kind === "error" && <ErrorBanner message="Activity could not be loaded." onRetry={history.retry} />}
      {history.kind === "ready" && (history.data.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">The target date has not changed since the project was created.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {history.data.map((change, index) => (
            <li key={`${change.occurred_at}-${index}`} className="py-2 text-xs">
              <span className="font-medium">{formatDay(change.previous_target_on)} → {formatDay(change.new_target_on)}</span>
              <span className="block text-[10px] text-[var(--color-text-muted)]">
                {change.reason} · {change.actor_email ?? "Unknown"} · {formatDateTime(change.occurred_at)}
              </span>
            </li>
          ))}
        </ul>
      ))}
    </Panel>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-0.5 font-medium truncate">{value}</dd>
    </div>
  );
}

/* ======================================================================
 * Edit project
 * ==================================================================== */

export function ProjectEditView({ base, projectId }: { base: ProjectBase; projectId: string }) {
  const { orgId, href } = useBaseHref(base);
  const state = useProject(orgId, projectId);
  const options = useProjectOptions(orgId);
  const project = state.kind === "ready" ? state.data : null;
  return (
    <PageFrame
      crumbs={[
        { label: BASE_LABEL[base], href: href() },
        { label: "All projects", href: href("projects") },
        { label: project?.key ?? "Project", href: href(`projects/${projectId}`) },
        { label: "Edit" },
      ]}
      back={{ href: href(`projects/${projectId}`), label: "Back to project" }}
      title={project ? `Edit ${project.key}` : "Edit project"}
    >
      <ProjectGate state={state} base={base} notFound>
        {(row) => row.can_edit ? (
          <ProjectGate state={options} base={base}>
            {(data) => <EditForm base={base} orgId={orgId} project={row} options={data} />}
          </ProjectGate>
        ) : (
          <AccessDeniedState permission="project.edit" backHref={href(`projects/${row.id}`)} />
        )}
      </ProjectGate>
    </PageFrame>
  );
}

function EditForm({ base, orgId, project, options }: { base: ProjectBase; orgId: string; project: ProjectDto; options: ProjectOptionsDto }) {
  const router = useRouter();
  const { href } = useBaseHref(base);
  const { updateProject } = useProjectMutations(orgId);
  const reload = useReloadProjects(orgId);
  const [stale, setStale] = useState<ApiError | null>(null);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [priority, setPriority] = useState<ProjectPriorityDto>(project.priority);
  const [pm, setPm] = useState(project.project_manager?.membership_id ?? "");
  const [accountable, setAccountable] = useState(project.accountable?.membership_id ?? "");
  const [members, setMembers] = useState<string[]>(project.members.map((m) => m.membership_id));
  const [team, setTeam] = useState(project.team_id ?? "");
  const [startOn, setStartOn] = useState(project.start_on ?? "");
  const [targetOn, setTargetOn] = useState(project.target_on ?? "");
  const [targetReason, setTargetReason] = useState("");
  const [timezone, setTimezone] = useState(project.timezone);
  const [lifecycle, setLifecycle] = useState<ProjectLifecycleDto>(project.lifecycle);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const zones = useMemo(() => timeZones(timezone), [timezone]);
  const today = useMemo(() => localToday(), []);
  const targetChanged = (targetOn || null) !== project.target_on && Boolean(targetOn);
  const lifecycleChanged = lifecycle !== project.lifecycle;

  useEffect(() => {
    // After a reload (stale version) start again from the latest record.
    setName(project.name);
    setDescription(project.description ?? "");
    setPriority(project.priority);
    setPm(project.project_manager?.membership_id ?? "");
    setAccountable(project.accountable?.membership_id ?? "");
    setMembers(project.members.map((m) => m.membership_id));
    setTeam(project.team_id ?? "");
    setStartOn(project.start_on ?? "");
    setTargetOn(project.target_on ?? "");
    setTimezone(project.timezone);
    setLifecycle(project.lifecycle);
  }, [project]);

  const submit = () => {
    if (!name.trim()) return setError("Enter a project name.");
    const startProblem = startDateError(startOn, today, project.start_on);
    if (startProblem) return setError(startProblem);
    const endProblem = endDateError(targetOn, startOn);
    if (endProblem) return setError(endProblem);
    if (targetChanged && !targetReason.trim()) return setError("Say why the target date changes.");
    if (lifecycleChanged && !lifecycleReason.trim()) return setError("Say why the status changes.");
    setError("");
    setStale(null);
    const body: UpdateProjectDto = {
      name: name.trim(),
      description: description.trim(),
      priority,
      project_manager_membership_id: pm || null,
      accountable_membership_id: accountable || null,
      member_membership_ids: members,
      team_id: team || null,
      start_on: startOn || null,
      timezone,
      expected_version: project.version,
    };
    if (targetChanged) {
      body.target_on = targetOn;
      body.previous_target_on = project.target_on;
      body.target_date_reason = targetReason.trim();
    }
    if (lifecycleChanged) {
      body.lifecycle = lifecycle;
      body.lifecycle_reason = lifecycleReason.trim();
    }
    updateProject.mutate({ id: project.id, body }, {
      onSuccess: () => {
        toast.success("Project saved");
        router.push(href(`projects/${project.id}`));
      },
      onError: (failure) => {
        if (isStaleVersion(failure)) setStale(failure as ApiError);
        else setError(apiErrorMessage(failure));
      },
    });
  };

  const transitions = EDIT_TRANSITIONS[project.lifecycle] ?? [];
  return (
    <form className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      {stale && (
        <div className="xl:col-span-3">
          <StaleVersionBanner requestId={stale.requestId} reloading={reloading} onReload={() => {
            setReloading(true);
            void reload().finally(() => { setReloading(false); setStale(null); });
          }} />
        </div>
      )}
      <div className="xl:col-span-2 space-y-4">
        <Panel title="Project" icon={FolderKanban} description={`Key ${project.key} and mode ${MODE_LABEL[project.mode]} do not change here.`}>
          <div className="space-y-3">
            <AdminInput label="Name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
            <AdminTextarea label="Scope description" rows={4} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
            <AdminSelect label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as ProjectPriorityDto)}>
              {PRIORITIES.map((value) => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}
            </AdminSelect>
          </div>
        </Panel>
        <Panel title="People" icon={Users}>
          <PeopleFields options={options} mode={project.mode} pm={pm} accountable={accountable} members={members} team={team}
            onPm={setPm} onAccountable={setAccountable} onMembers={setMembers} onTeam={setTeam} />
        </Panel>
      </div>
      <div className="space-y-4">
        <Panel title="Schedule" icon={CalendarDays}>
          <div className="space-y-3">
            {/* An already-past start date may stay; a changed start date must be today or later. */}
            <AdminInput label="Start date" type="date" value={startOn}
              min={project.start_on && project.start_on < today ? project.start_on : today}
              error={startDateError(startOn, today, project.start_on) ?? undefined}
              onChange={(e) => setStartOn(e.target.value)} />
            <AdminInput label={`Target date (now ${formatDay(project.target_on)})`} type="date" value={targetOn}
              min={startOn && isIsoDate(startOn) ? startOn : undefined}
              error={endDateError(targetOn, startOn) ?? undefined}
              onChange={(e) => setTargetOn(e.target.value)} />
            {targetChanged && (
              <AdminTextarea label="Why does the target date change? (kept in history)" value={targetReason} maxLength={500}
                onChange={(e) => setTargetReason(e.target.value)} />
            )}
            <AdminSelect label="Time zone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </AdminSelect>
          </div>
        </Panel>
        <Panel title="Status" icon={Settings} description="Acceptance, delivery, closing and cancelling arrive with task 2.4.">
          <div className="space-y-3">
            <AdminSelect label="Status" value={lifecycle} onChange={(e) => setLifecycle(e.target.value as ProjectLifecycleDto)} disabled={transitions.length === 0}>
              <option value={project.lifecycle}>{LIFECYCLE_LABEL[project.lifecycle]} (current)</option>
              {transitions.map((value) => <option key={value} value={value}>{LIFECYCLE_LABEL[value]}</option>)}
            </AdminSelect>
            {lifecycleChanged && (
              <AdminTextarea label="Reason for the status change" value={lifecycleReason} maxLength={500} onChange={(e) => setLifecycleReason(e.target.value)} />
            )}
          </div>
        </Panel>
        <ErrorLine message={error} />
        <div className="flex gap-2">
          <AdminButton type="submit" isLoading={updateProject.isPending}>Save changes</AdminButton>
          <ButtonLink variant="outline" href={href(`projects/${project.id}`)}>Cancel</ButtonLink>
        </div>
      </div>
    </form>
  );
}

