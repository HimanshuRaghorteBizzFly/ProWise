"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, GitBranch, Link2, OctagonAlert, Unlink } from "lucide-react";
import { toast } from "sonner";

import { ApiError, apiClient, isStaleVersion } from "@/lib/api";
import type {
  BlockerDto,
  BlockerSeverityDto,
  DependencyBoardDto,
  DependencyItemRefDto,
  OrgBlockerDto,
  ProjectDto,
  WorkItemDto,
} from "@/types/api";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  EmptyStateView,
  ErrorBanner,
  PageFrame,
  PageSkeleton,
  Panel,
  StatusBadge,
} from "@/components/delivery/DeliveryUI";
import { StaleVersionBanner } from "@/components/org-console/StaleVersionBanner";
import { apiErrorMessage, toState } from "@/components/org-console/useRoleApi";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * Task 3.4 screens: Finish-to-Start links ("Blocked by" / "Blocks"), blockers with reason, owner, severity and age,
 * and the work affected by every change. Blocked is a separate flag; it never changes a task's state.
 */

const QUERY = { retry: false } as const;

/** Blocker age as shown in lists (feeds health in 5.1): minutes, hours or days since it was opened. */
export function blockerAge(openedAt: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(openedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Links of one task: what it waits on ("Blocked by") and what waits on it ("Blocks"). */
export function linksFor(itemId: string, board: DependencyBoardDto) {
  return {
    blockedBy: board.links.filter((link) => link.successor_id === itemId),
    blocks: board.links.filter((link) => link.predecessor_id === itemId),
  };
}

export function AffectedWarning({ affected, title }: { affected: DependencyItemRefDto[]; title: string }) {
  if (affected.length === 0) return null;
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs" data-testid="affected">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
      <span><b>{title}</b> Affected work: {affected.map((item) => item.key).join(", ")}</span>
    </div>
  );
}

export function BlockerList({ blockers, onResolve, now }: {
  blockers: BlockerDto[];
  onResolve?: (blocker: BlockerDto, resolution: string) => void;
  now?: Date;
}) {
  const [resolution, setResolution] = useState<Record<string, string>>({});
  if (blockers.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">No open blockers.</p>;
  return (
    <ul className="space-y-2" data-testid="blockers">
      {blockers.map((blocker) => (
        <li key={blocker.id} className="rounded-lg border border-[var(--color-border)] p-2 text-xs space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={blocker.severity === "CRITICAL" ? "Critical blocker" : "Blocker"} tone={blocker.severity === "CRITICAL" ? "danger" : "warning"} />
            <span className="font-mono text-[var(--color-text-muted)]">{blocker.work_item_key}</span>
            <span>{blocker.reason}</span>
          </div>
          <p className="text-[var(--color-text-muted)]">
            Owner: {blocker.owner?.email ?? "None"} · Open for {blockerAge(blocker.opened_at, now)} · Raised by {blocker.opened_by_email ?? "unknown"}
          </p>
          {onResolve && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <AdminInput label="Resolution" value={resolution[blocker.id] ?? ""}
                  onChange={(e) => setResolution((current) => ({ ...current, [blocker.id]: e.target.value }))} />
              </div>
              <AdminButton size="sm" variant="outline" disabled={!(resolution[blocker.id] ?? "").trim()}
                onClick={() => onResolve(blocker, (resolution[blocker.id] ?? "").trim())}>Clear blocker</AdminButton>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function useOrgId() {
  const params = useParams();
  return (params?.orgId as string) || "";
}

/** Project workspace tab (Structured): pick a task, see and change its links and blockers. */
export function DependenciesTab({ project }: { project: ProjectDto }) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const board = toState(useQuery({ queryKey: ["dependencies", orgId, project.id], queryFn: () => apiClient.dependencyBoard(orgId, project.id), ...QUERY }));
  const items = toState(useQuery({ queryKey: ["work-items", orgId, project.id], queryFn: () => apiClient.workItems(orgId, project.id), ...QUERY }));
  const people = useQuery({ queryKey: ["assignees", orgId, project.id], queryFn: () => apiClient.projectAssignees(orgId, project.id), ...QUERY });
  const [selected, setSelected] = useState("");
  const [predecessor, setPredecessor] = useState("");
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<BlockerSeverityDto>("NORMAL");
  const [owner, setOwner] = useState("");
  const [affected, setAffected] = useState<{ title: string; items: DependencyItemRefDto[] } | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (board.kind === "loading" || items.kind === "loading") return <PageSkeleton variant="list" />;
  if (board.kind !== "ready" || items.kind !== "ready") {
    return <ErrorBanner message="Dependencies could not be loaded." onRetry={board.kind === "error" ? board.retry : undefined} />;
  }
  const tasks = items.data.filter((item) => item.leaf);
  if (tasks.length === 0) return <EmptyStateView icon={GitBranch} title="No tasks yet" description="Add tasks to link them." />;
  const byId = new Map(items.data.map((item) => [item.id, item]));
  const task: WorkItemDto | undefined = byId.get(selected);
  const canEdit = project.can_edit && !project.archived;
  const canRaise = can("task.update") && !project.archived;
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["dependencies", orgId, project.id] });
    void queryClient.invalidateQueries({ queryKey: ["work-items", orgId, project.id] });
  };
  const run = (call: () => Promise<{ affected: DependencyItemRefDto[] }>, done: string) => {
    setBusy(true);
    setError("");
    call()
      .then((result) => { toast.success(done); setAffected({ title: done + ".", items: result.affected }); reload(); })
      .catch((failure) => (isStaleVersion(failure) ? setStale(true) : setError(apiErrorMessage(failure))))
      .finally(() => setBusy(false));
  };
  const keyOf = (id: string) => byId.get(id)?.key ?? "Removed task";
  const openBlockers = (id: string) => board.data.blockers.filter((blocker) => blocker.work_item_id === id);
  const flag = (id: string) => board.data.flags.find((f) => f.work_item_id === id);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Panel title="Tasks" icon={GitBranch} description="Choose a task to see what it waits on and what waits on it.">
        <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="dependency-tasks">
          {tasks.map((item) => {
            const { blockedBy, blocks } = linksFor(item.id, board.data);
            const critical = openBlockers(item.id).some((blocker) => blocker.severity === "CRITICAL");
            return (
              <li key={item.id}>
                <button type="button" onClick={() => { setSelected(item.id); setAffected(null); setError(""); }}
                  className={`flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-xs ${selected === item.id ? "bg-[var(--color-hover)]" : ""}`}>
                  <span className="font-mono text-[var(--color-text-muted)]">{item.key}</span>
                  <span className="flex-1 truncate">{item.title}</span>
                  {critical && <StatusBadge label="Critical" tone="danger" />}
                  {!critical && openBlockers(item.id).length > 0 && <StatusBadge label="Blocked" tone="warning" />}
                  {flag(item.id) && <StatusBadge label="Review" tone="info" />}
                  {(blockedBy.length > 0 || blocks.length > 0) && <span className="text-[var(--color-text-muted)]">{blockedBy.length}↑ {blocks.length}↓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="xl:col-span-2 space-y-4">
        {stale && <StaleVersionBanner onReload={() => { setStale(false); reload(); }} />}
        {error && <ErrorBanner message={error} />}
        {affected && <AffectedWarning title={affected.title} affected={affected.items} />}
        {!task ? (
          <EmptyStateView icon={Link2} title="No task selected" description="Pick a task on the left." />
        ) : (
          <>
            <Panel title={`${task.key} · ${task.title}`} icon={Link2} description="Finish-to-Start: a task cannot be submitted until every task it is blocked by is approved.">
              {(() => {
                const { blockedBy, blocks } = linksFor(task.id, board.data);
                const taskFlag = flag(task.id);
                return (
                  <div className="space-y-3 text-xs">
                    {taskFlag && (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2">
                        <span className="flex-1">{taskFlag.reason}</span>
                        <AdminButton size="sm" variant="outline" isLoading={busy}
                          onClick={() => run(async () => { await apiClient.clearDependencyFlag(orgId, project.id, task.id, task.version); return { affected: [] }; }, "Review flag cleared")}>
                          Mark reviewed
                        </AdminButton>
                      </div>
                    )}
                    <div>
                      <p className="font-medium">Blocked by</p>
                      {blockedBy.length === 0 ? <p className="text-[var(--color-text-muted)]">Nothing.</p> : (
                        <ul className="space-y-1">
                          {blockedBy.map((link) => (
                            <li key={link.id} className="flex items-center gap-2">
                              <span className="font-mono">{keyOf(link.predecessor_id)}</span>
                              <span className="flex-1 truncate">{byId.get(link.predecessor_id)?.title}</span>
                              <StatusBadge label={byId.get(link.predecessor_id)?.state === "DONE" ? "Done" : "Open"}
                                tone={byId.get(link.predecessor_id)?.state === "DONE" ? "success" : "warning"} />
                              {canEdit && (
                                <AdminButton size="sm" variant="ghost" aria-label={`Remove link from ${keyOf(link.predecessor_id)}`} disabled={busy}
                                  onClick={() => run(() => apiClient.removeDependency(orgId, project.id, task.id, link.id, task.version), "Link removed")}>
                                  <Unlink className="w-3.5 h-3.5" />
                                </AdminButton>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Blocks</p>
                      {blocks.length === 0 ? <p className="text-[var(--color-text-muted)]">Nothing.</p>
                        : <p>{blocks.map((link) => keyOf(link.successor_id)).join(", ")}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap items-end gap-2">
                        <select aria-label="Add a task it waits on" className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
                          value={predecessor} onChange={(e) => setPredecessor(e.target.value)}>
                          <option value="">Waits on…</option>
                          {tasks.filter((x) => x.id !== task.id && !blockedBy.some((l) => l.predecessor_id === x.id))
                            .map((x) => <option key={x.id} value={x.id}>{x.key} · {x.title}</option>)}
                        </select>
                        <AdminButton size="sm" disabled={!predecessor || busy}
                          onClick={() => { const p = predecessor; setPredecessor(""); run(() => apiClient.linkDependency(orgId, project.id, task.id, { predecessor_id: p, expected_version: task.version }), "Link added"); }}>
                          <Link2 className="w-3.5 h-3.5" /> Add link
                        </AdminButton>
                        {(blockedBy.length > 0 || blocks.length > 0) && (
                          <>
                            <AdminButton size="sm" variant="outline" disabled={busy}
                              onClick={() => run(() => apiClient.releaseDependencies(orgId, project.id, task.id, { treatment: "BRIDGE", expected_version: task.version }), "Links bridged")}>
                              Bridge links
                            </AdminButton>
                            <AdminButton size="sm" variant="outline" disabled={busy}
                              onClick={() => run(() => apiClient.releaseDependencies(orgId, project.id, task.id, { treatment: "DROP", expected_version: task.version }), "Links dropped")}>
                              Drop links
                            </AdminButton>
                          </>
                        )}
                      </div>
                    )}
                    {canEdit && (blockedBy.length > 0 || blocks.length > 0) && (
                      <p className="text-[var(--color-text-muted)]">
                        Before removing or cancelling this task, bridge its links (what it blocks then waits on what it was blocked by) or drop them.
                      </p>
                    )}
                  </div>
                );
              })()}
            </Panel>

            <Panel title="Blockers" icon={OctagonAlert} description="Blocked is a separate flag: raising or clearing a blocker never changes the task's state.">
              <div className="space-y-3">
                <BlockerList blockers={openBlockers(task.id)}
                  onResolve={(blocker, resolution) => run(() => apiClient.resolveBlocker(orgId, project.id, task.id, blocker.id, { resolution, expected_version: blocker.version }), "Blocker cleared")} />
                {canRaise && task.state !== "DONE" && (
                  <div className="space-y-2 border-t border-[var(--color-border)] pt-3 text-xs">
                    <AdminInput label="What blocks the work" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <div className="flex flex-wrap gap-2">
                      <select aria-label="Severity" className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
                        value={severity} onChange={(e) => setSeverity(e.target.value as BlockerSeverityDto)}>
                        <option value="NORMAL">Normal</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                      <select aria-label="Owner" className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
                        value={owner} onChange={(e) => setOwner(e.target.value)}>
                        <option value="">Owner who will clear it…</option>
                        {(people.data ?? []).map((person) => <option key={person.membership_id} value={person.membership_id}>{person.email}</option>)}
                      </select>
                      <AdminButton size="sm" disabled={!reason.trim() || !owner || busy}
                        onClick={() => run(() => apiClient.raiseBlocker(orgId, project.id, task.id, { reason: reason.trim(), severity, owner_membership_id: owner, expected_version: task.version })
                          .then((result) => { setReason(""); return result; }), "Blocker raised")}>
                        <OctagonAlert className="w-3.5 h-3.5" /> Raise blocker
                      </AdminButton>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================== cross-project pages (Team Lead, Project Manager, Developer) */

export function ProjectBlockerRow({ entry, detailHref, now, onResolve, busy }: {
  entry: OrgBlockerDto;
  detailHref?: string;
  now?: Date;
  onResolve?: (resolution: string) => void;
  busy?: boolean;
}) {
  const [resolution, setResolution] = useState("");
  const b = entry.blocker;
  return (
    <li className="space-y-1 px-3 py-3 text-xs" data-testid="project-blocker">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={b.severity === "CRITICAL" ? "Critical blocker" : "Blocker"} tone={b.severity === "CRITICAL" ? "danger" : "warning"} />
        {b.resolved_at && <StatusBadge label="Cleared" tone="success" />}
        <span className="font-mono text-[var(--color-text-muted)]">{entry.project_key} · {b.work_item_key}</span>
        {detailHref ? <Link className="font-medium hover:underline" href={detailHref}>{b.reason}</Link> : <span className="font-medium">{b.reason}</span>}
      </div>
      <p className="text-[var(--color-text-muted)]">
        {entry.project_name} · Owner: {b.owner?.email ?? "None"} · {b.resolved_at ? `Cleared by ${b.resolved_by_email ?? "unknown"}` : `Open for ${blockerAge(b.opened_at, now)}`}
      </p>
      {b.resolution && <p>Resolution: {b.resolution}</p>}
      {entry.affected.length > 0 && <p className="text-amber-600">Holds up: {entry.affected.map((x) => x.key).join(", ")}</p>}
      {onResolve && entry.can_resolve && !b.resolved_at && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1"><AdminInput label="Resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} /></div>
          <AdminButton size="sm" variant="outline" disabled={!resolution.trim() || busy} onClick={() => onResolve(resolution.trim())}>Clear blocker</AdminButton>
        </div>
      )}
    </li>
  );
}

function useResolveBlocker(orgId: string, onDone: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const resolve = (entry: OrgBlockerDto, resolution: string) => {
    setBusy(entry.blocker.id);
    setError("");
    apiClient.resolveBlocker(orgId, entry.project_id, entry.blocker.work_item_id, entry.blocker.id, { resolution, expected_version: entry.blocker.version })
      .then(() => { toast.success("Blocker cleared; the task keeps its state"); onDone(); })
      .catch((failure) => (isStaleVersion(failure) ? setStale(true) : setError(apiErrorMessage(failure))))
      .finally(() => setBusy(null));
  };
  return { resolve, busy, stale, setStale, error };
}

export function BlockersView({ crumbs, back, detailHref }: {
  crumbs: { label: string; href?: string }[];
  back: { href: string; label: string };
  detailHref?: (entry: OrgBlockerDto) => string;
}) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const state = toState(useQuery({ queryKey: ["org-blockers", orgId], queryFn: () => apiClient.orgBlockers(orgId), ...QUERY }));
  const reload = () => void queryClient.invalidateQueries({ queryKey: ["org-blockers", orgId] });
  const { resolve, busy, stale, setStale, error } = useResolveBlocker(orgId, reload);
  return (
    <PageFrame crumbs={[...crumbs, { label: "Blockers" }]} back={back} title="Blockers"
      description="Open blockers of the Structured projects you can see, critical first. Clearing a blocker never changes the task's state.">
      {stale && <StaleVersionBanner onReload={() => { setStale(false); reload(); }} />}
      {error && <ErrorBanner message={error} />}
      {state.kind === "loading" ? <PageSkeleton variant="list" />
        : state.kind !== "ready" ? <ErrorBanner message="Blockers could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
          : state.data.length === 0 ? <EmptyStateView icon={OctagonAlert} title="No open blockers" description="Blockers raised on tasks appear here until they are cleared." />
            : (
              <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="org-blockers">
                {state.data.map((entry) => (
                  <ProjectBlockerRow key={entry.blocker.id} entry={entry} detailHref={detailHref?.(entry)} busy={busy === entry.blocker.id}
                    onResolve={(resolution) => resolve(entry, resolution)} />
                ))}
              </ul>
            )}
    </PageFrame>
  );
}

export function BlockerDetailView({ blockerId, crumbs, back }: {
  blockerId: string;
  crumbs: { label: string; href?: string }[];
  back: { href: string; label: string };
}) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["org-blocker", orgId, blockerId], queryFn: () => apiClient.orgBlocker(orgId, blockerId), ...QUERY });
  const state = toState(query);
  const notFound = query.error instanceof ApiError && query.error.status === 404;
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["org-blocker", orgId, blockerId] });
    void queryClient.invalidateQueries({ queryKey: ["org-blockers", orgId] });
  };
  const { resolve, busy, stale, setStale, error } = useResolveBlocker(orgId, reload);
  return (
    <PageFrame crumbs={[...crumbs, { label: state.kind === "ready" ? state.data.blocker.work_item_key : "Blocker" }]} back={back} title="Blocker">
      {stale && <StaleVersionBanner onReload={() => { setStale(false); reload(); }} />}
      {error && <ErrorBanner message={error} />}
      {state.kind === "loading" ? <PageSkeleton variant="detail" />
        : notFound || state.kind === "forbidden"
          ? <EmptyStateView icon={OctagonAlert} title="Blocker not found" description="It doesn't exist or belongs to a project you can't see." />
          : state.kind !== "ready" ? <ErrorBanner message="The blocker could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
            : (
              <ul className="rounded-lg border border-[var(--color-border)]">
                <ProjectBlockerRow entry={state.data} busy={busy === state.data.blocker.id} onResolve={(resolution) => resolve(state.data, resolution)} />
              </ul>
            )}
    </PageFrame>
  );
}

/** Dependencies of one project chosen from the Structured projects the member can see. */
export function DependenciesPageView({ crumbs, back, projectId: fixedProject }: {
  crumbs: { label: string; href?: string }[];
  back: { href: string; label: string };
  /** When set (developer's project page) the picker is hidden. */
  projectId?: string;
}) {
  const orgId = useOrgId();
  const list = toState(useQuery({
    queryKey: ["projects-structured", orgId],
    queryFn: () => apiClient.projects(orgId, { mode: "STRUCTURED", limit: 100 }),
    ...QUERY,
  }));
  const [selected, setSelected] = useState("");
  const projects = list.kind === "ready" ? list.data.items : [];
  const chosen = fixedProject ?? selected;
  const project = projects.find((p) => p.id === chosen) ?? null;
  return (
    <PageFrame crumbs={[...crumbs, { label: "Dependencies" }]} back={back} title="Dependencies and blockers"
      description="What each task waits on, what waits on it, and the blockers holding work up.">
      {list.kind === "loading" ? <PageSkeleton variant="list" />
        : list.kind !== "ready" ? <ErrorBanner message="Projects could not be loaded." onRetry={list.kind === "error" ? list.retry : undefined} />
          : (
            <div className="space-y-4">
              {!fixedProject && (projects.length === 0
                ? <EmptyStateView icon={GitBranch} title="No Structured projects" description="Dependencies exist between tasks of Structured projects." />
                : (
                  <div className="max-w-md">
                    <AdminSelect label="Project" value={selected} onChange={(e) => setSelected(e.target.value)}>
                      <option value="">Choose a project…</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}
                    </AdminSelect>
                  </div>
                ))}
              {project ? <DependenciesTab project={project} />
                : fixedProject ? <EmptyStateView icon={GitBranch} title="Project not found" description="This project doesn't exist or you can't see it." />
                  : projects.length > 0 && <EmptyStateView icon={Link2} title="No project selected" description="Choose a project to see its links." />}
            </div>
          )}
    </PageFrame>
  );
}
