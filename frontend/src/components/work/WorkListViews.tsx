"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, FolderKanban, History, ListChecks, OctagonAlert, UsersRound } from "lucide-react";

import { ApiError, apiClient } from "@/lib/api";
import type { AssignableItemDto, MemberWorkDto, TeamWorkDto } from "@/types/api";
import {
  AdminSelect,
  EmptyStateView,
  ErrorBanner,
  PageFrame,
  PageSkeleton,
  Panel,
  StatusBadge,
} from "@/components/delivery/DeliveryUI";
import { toState } from "@/components/org-console/useRoleApi";
import { BreakdownTab } from "@/components/work/WorkViews";
import { BlockerList } from "@/components/work/DependencyViews";

/**
 * Task 3.1 screens across projects: work items, one work item, team work and project planning. Only projects the
 * signed-in member may read appear; the server filters, the page only presents.
 */

const QUERY = { retry: false } as const;
type Crumbs = { label: string; href?: string }[];
type Back = { href: string; label: string };
type Tone = "neutral" | "info" | "warning" | "success" | "danger";

export const STATE_LABEL: Record<string, { label: string; tone: Tone }> = {
  TODO: { label: "To do", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  BLOCKED: { label: "Blocked", tone: "danger" },
  IN_REVIEW: { label: "In review", tone: "warning" },
  DONE: { label: "Done", tone: "success" },
};

function useOrgId() {
  const params = useParams();
  return (params?.orgId as string) || "";
}

function StateBadge({ state }: { state: string }) {
  const s = STATE_LABEL[state] ?? { label: state, tone: "neutral" as const };
  return <StatusBadge label={s.label} tone={s.tone} />;
}

/* ================================================================== work items list */

export interface WorkFilters { state: string; assignee: string; project: string }

/** Applies the page filters (state, assignee "me"/"none"/all, project) to already-permitted rows. */
export function filterWork(items: AssignableItemDto[], filters: WorkFilters, myMembershipIds: readonly string[] = []) {
  return items.filter((entry) => {
    if (filters.project && entry.project_id !== filters.project) return false;
    if (filters.state && entry.item.state !== filters.state) return false;
    if (filters.assignee === "none" && entry.item.assignee) return false;
    if (filters.assignee === "me" && !(entry.item.assignee && myMembershipIds.includes(entry.item.assignee.membership_id))) return false;
    return true;
  });
}

export function WorkItemTable({ items, itemHref }: { items: AssignableItemDto[]; itemHref?: (entry: AssignableItemDto) => string }) {
  if (items.length === 0) {
    return <EmptyStateView icon={ListChecks} title="No tasks match" description="Tasks of Structured projects you can see appear here." />;
  }
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="work-items">
      {items.map((entry) => (
        <li key={entry.item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
          <span className="min-w-0">
            <span className="font-mono text-[var(--color-text-muted)]">{entry.item.key}</span>{" "}
            {itemHref ? <Link className="font-medium hover:underline" href={itemHref(entry)}>{entry.item.title}</Link> : <span className="font-medium">{entry.item.title}</span>}
            <span className="block text-[var(--color-text-muted)]">
              {entry.project_key} · {entry.project_name} · {Number(entry.item.points)} {entry.item.unit}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[var(--color-text-muted)]">{entry.item.assignee?.email ?? "Unassigned"}</span>
            <StateBadge state={entry.item.state} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function WorkItemsView({ crumbs, back, title = "Work items", itemHref, mineOnly = false }: {
  crumbs: Crumbs;
  back: Back;
  title?: string;
  itemHref?: (entry: AssignableItemDto) => string;
  mineOnly?: boolean;
}) {
  const orgId = useOrgId();
  const state = toState(useQuery({
    queryKey: ["org-work-items", orgId, mineOnly ? "me" : "all"],
    queryFn: () => apiClient.orgWorkItems(orgId, mineOnly ? { assignee: "me" } : {}),
    ...QUERY,
  }));
  const [filters, setFilters] = useState<WorkFilters>({ state: "", assignee: "", project: "" });
  const projects = useMemo(() => {
    if (state.kind !== "ready") return [];
    const seen = new Map<string, string>();
    state.data.forEach((entry) => seen.set(entry.project_id, `${entry.project_key} · ${entry.project_name}`));
    return [...seen.entries()];
  }, [state]);
  return (
    <PageFrame crumbs={[...crumbs, { label: title }]} back={back} title={title}
      description="Tasks of the Structured projects you can see. Phases are planning only; tasks carry the points.">
      {state.kind === "loading" ? <PageSkeleton variant="list" />
        : state.kind !== "ready" ? <ErrorBanner message="Tasks could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
          : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <AdminSelect label="Project" value={filters.project} onChange={(e) => setFilters({ ...filters, project: e.target.value })}>
                  <option value="">All projects</option>
                  {projects.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </AdminSelect>
                <AdminSelect label="State" value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })}>
                  <option value="">Any state</option>
                  {Object.entries(STATE_LABEL).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
                </AdminSelect>
                {!mineOnly && (
                  <AdminSelect label="Assignee" value={filters.assignee} onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}>
                    <option value="">Anyone</option>
                    <option value="none">Unassigned</option>
                  </AdminSelect>
                )}
              </div>
              <WorkItemTable items={filterWork(state.data, filters)} itemHref={itemHref} />
            </div>
          )}
    </PageFrame>
  );
}

/* ================================================================== one work item */

export function WorkItemDetail({ entry }: { entry: AssignableItemDto }) {
  const item = entry.item;
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs" data-testid="work-item-detail">
      <div><dt className="text-[var(--color-text-muted)]">Project</dt><dd className="font-medium">{entry.project_key} · {entry.project_name}</dd></div>
      <div><dt className="text-[var(--color-text-muted)]">State</dt><dd><StateBadge state={item.state} /></dd></div>
      <div><dt className="text-[var(--color-text-muted)]">Points</dt><dd className="font-medium">{Number(item.points)} {item.unit}</dd></div>
      <div><dt className="text-[var(--color-text-muted)]">Work type</dt><dd className="font-medium">{item.work_type_name ?? "None"}</dd></div>
      <div><dt className="text-[var(--color-text-muted)]">Assignee</dt><dd className="font-medium">{item.assignee?.email ?? "Unassigned"}</dd></div>
      <div><dt className="text-[var(--color-text-muted)]">Reviewer</dt><dd className="font-medium">{item.reviewer?.email ?? "None"}</dd></div>
      <div className="col-span-2"><dt className="text-[var(--color-text-muted)]">Collaborators</dt>
        <dd className="font-medium">{item.collaborators.length === 0 ? "None" : item.collaborators.map((c) => c.email).join(", ")}</dd></div>
      {item.description && <div className="col-span-full"><dt className="text-[var(--color-text-muted)]">Description</dt><dd>{item.description}</dd></div>}
    </dl>
  );
}

export function WorkItemView({ itemId, crumbs, back, projectHref }: {
  itemId: string;
  crumbs: Crumbs;
  back: Back;
  projectHref?: (projectId: string) => string;
}) {
  const orgId = useOrgId();
  const query = useQuery({ queryKey: ["org-work-item", orgId, itemId], queryFn: () => apiClient.orgWorkItem(orgId, itemId), ...QUERY });
  const state = toState(query);
  const notFound = query.error instanceof ApiError && query.error.status === 404;
  const entry = state.kind === "ready" ? state.data : null;
  const history = useQuery({
    queryKey: ["assignment-history", orgId, entry?.project_id, itemId],
    queryFn: () => apiClient.assignmentHistory(orgId, entry!.project_id, itemId),
    enabled: !!entry, ...QUERY,
  });
  const reviews = useQuery({
    queryKey: ["task-reviews", orgId, entry?.project_id, itemId],
    queryFn: () => apiClient.taskReviews(orgId, entry!.project_id, itemId),
    enabled: !!entry && entry.item.leaf, ...QUERY,
  });
  const blockers = useQuery({
    queryKey: ["item-blockers", orgId, entry?.project_id, itemId],
    queryFn: () => apiClient.itemBlockers(orgId, entry!.project_id, itemId),
    enabled: !!entry, ...QUERY,
  });
  return (
    <PageFrame crumbs={[...crumbs, { label: entry?.item.key ?? "Task" }]} back={back}
      title={entry ? `${entry.item.key} · ${entry.item.title}` : "Task"}
      description={entry && projectHref ? undefined : "Changes happen on the project's Breakdown, Scope and Dependencies tabs."}>
      {state.kind === "loading" ? <PageSkeleton variant="detail" />
        : notFound || state.kind === "forbidden"
          ? <EmptyStateView icon={ClipboardList} title="Task not found" description="This task doesn't exist or isn't in a project you can see." />
          : state.kind !== "ready" ? <ErrorBanner message="The task could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
            : (
              <div className="space-y-4">
                <Panel title="Task" icon={ClipboardList}
                  action={projectHref ? <Link className="text-xs text-blue-600 hover:underline" href={projectHref(state.data.project_id)}>Open project</Link> : undefined}>
                  <WorkItemDetail entry={state.data} />
                </Panel>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                  <Panel title="Blockers" icon={OctagonAlert}>
                    {blockers.isLoading ? <PageSkeleton variant="list" /> : blockers.isError ? <ErrorBanner message="Blockers could not be loaded." />
                      : <BlockerList blockers={(blockers.data ?? []).filter((b) => !b.resolved_at)} />}
                  </Panel>
                  <Panel title="Review history" icon={History}>
                    {reviews.isLoading ? <PageSkeleton variant="list" /> : (reviews.data ?? []).length === 0
                      ? <p className="text-xs text-[var(--color-text-muted)]">Not submitted yet.</p>
                      : (
                        <ul className="space-y-1 text-xs">
                          {(reviews.data ?? []).map((r, i) => (
                            <li key={i}><b>{r.kind.replace(/_/g, " ").toLowerCase()}</b> · revision {r.revision} · {r.actor_email}
                              {r.note && <span className="block text-[var(--color-text-muted)]">{r.note}</span>}</li>
                          ))}
                        </ul>
                      )}
                  </Panel>
                  <Panel title="Assignment history" icon={UsersRound}>
                    {history.isLoading ? <PageSkeleton variant="list" /> : (history.data ?? []).length === 0
                      ? <p className="text-xs text-[var(--color-text-muted)]">No changes yet.</p>
                      : (
                        <ul className="space-y-1 text-xs">
                          {(history.data ?? []).map((h, i) => (
                            <li key={i}>{h.previous_assignee?.email ?? "Unassigned"} → <b>{h.new_assignee?.email ?? "Unassigned"}</b>
                              <span className="block text-[var(--color-text-muted)]">{h.actor_email} · {new Date(h.occurred_at).toLocaleString()}</span></li>
                          ))}
                        </ul>
                      )}
                  </Panel>
                </div>
              </div>
            )}
    </PageFrame>
  );
}

/* ================================================================== team work */

export function TeamWorkPanels({ teams, memberHref }: { teams: TeamWorkDto[]; memberHref?: (member: MemberWorkDto) => string }) {
  if (teams.length === 0) {
    return <EmptyStateView icon={UsersRound} title="No team" description="You don't lead or belong to an active team." />;
  }
  return (
    <div className="space-y-4" data-testid="team-work">
      {teams.map((team) => (
        <Panel key={team.id} title={team.name} icon={UsersRound}
          description={`${team.you_lead ? "You lead this team" : `Lead: ${team.lead_email ?? "none"}`} · ${team.members.length} people`}>
          <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {team.members.map((member) => (
              <li key={member.membership_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className="flex items-center gap-2">
                  {memberHref ? <Link className="font-medium hover:underline" href={memberHref(member)}>{member.email}</Link> : <span className="font-medium">{member.email}</span>}
                  {member.lead && <StatusBadge label="Lead" tone="info" />}
                </span>
                <span className="text-[var(--color-text-secondary)]">
                  {member.open_tasks === 0 ? "No open tasks" : `${member.open_tasks} open task${member.open_tasks === 1 ? "" : "s"} · ${Number(member.open_points)} pts`}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

export function TeamWorkView({ crumbs, back, title = "My team", memberHref }: {
  crumbs: Crumbs;
  back: Back;
  title?: string;
  memberHref?: (member: MemberWorkDto) => string;
}) {
  const orgId = useOrgId();
  const state = toState(useQuery({ queryKey: ["my-teams", orgId], queryFn: () => apiClient.myTeams(orgId), ...QUERY }));
  return (
    <PageFrame crumbs={[...crumbs, { label: title }]} back={back} title={title}
      description="People in the teams you lead or belong to, with their open tasks in projects you can see.">
      {state.kind === "loading" ? <PageSkeleton variant="list" />
        : state.kind !== "ready" ? <ErrorBanner message="Your teams could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
          : <TeamWorkPanels teams={state.data} memberHref={memberHref} />}
    </PageFrame>
  );
}

export function TeamMemberView({ membershipId, crumbs, back, itemHref }: {
  membershipId: string;
  crumbs: Crumbs;
  back: Back;
  itemHref?: (entry: AssignableItemDto) => string;
}) {
  const orgId = useOrgId();
  const state = toState(useQuery({ queryKey: ["my-teams", orgId], queryFn: () => apiClient.myTeams(orgId), ...QUERY }));
  const member = state.kind === "ready"
    ? state.data.flatMap((team) => team.members).find((m) => m.membership_id === membershipId) ?? null : null;
  return (
    <PageFrame crumbs={[...crumbs, { label: member?.email ?? "Team member" }]} back={back} title={member?.email ?? "Team member"}
      description="Open tasks assigned to this person in projects you can see.">
      {state.kind === "loading" ? <PageSkeleton variant="list" />
        : state.kind !== "ready" ? <ErrorBanner message="The team could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
          : !member ? <EmptyStateView icon={UsersRound} title="Not in your team" description="This person isn't in a team you lead or belong to." />
            : <WorkItemTable items={member.tasks} itemHref={itemHref} />}
    </PageFrame>
  );
}

/* ================================================================== project planning */

export function ProjectPlanningView({ crumbs, back, projectHref }: { crumbs: Crumbs; back: Back; projectHref: (projectId: string) => string }) {
  const orgId = useOrgId();
  const list = toState(useQuery({
    queryKey: ["projects-structured", orgId],
    queryFn: () => apiClient.projects(orgId, { mode: "STRUCTURED", limit: 100 }),
    ...QUERY,
  }));
  const [selected, setSelected] = useState("");
  const projects = list.kind === "ready" ? list.data.items : [];
  const project = projects.find((p) => p.id === selected) ?? null;
  return (
    <PageFrame crumbs={[...crumbs, { label: "Project planning" }]} back={back} title="Project planning"
      description="The phases and tasks of each Structured project, with points, assignee and reviewer.">
      {list.kind === "loading" ? <PageSkeleton variant="list" />
        : list.kind !== "ready" ? <ErrorBanner message="Projects could not be loaded." onRetry={list.kind === "error" ? list.retry : undefined} />
          : projects.length === 0 ? <EmptyStateView icon={FolderKanban} title="No Structured projects" description="Create a Structured project to plan its phases and tasks." />
            : (
              <div className="space-y-4">
                <div className="max-w-md">
                  <AdminSelect label="Project" value={selected} onChange={(e) => setSelected(e.target.value)}>
                    <option value="">Choose a project…</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}
                  </AdminSelect>
                </div>
                {project ? (
                  <>
                    <Link className="text-xs text-blue-600 hover:underline" href={projectHref(project.id)}>Open the project (scope, dependencies, progress)</Link>
                    <BreakdownTab project={project} />
                  </>
                ) : <EmptyStateView icon={ListChecks} title="No project selected" description="Choose a project to see its breakdown." />}
              </div>
            )}
    </PageFrame>
  );
}
