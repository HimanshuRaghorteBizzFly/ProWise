"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, GitCompare, History, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ApiError, apiClient, isStaleVersion } from "@/lib/api";
import type { ProjectDto, ProjectScopeVersionDto, ScopeChangeKindDto, ScopeChangeRequestDto, ScopeVersionDto, WorkItemDto } from "@/types/api";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  EmptyStateView,
  ErrorBanner,
  PageFrame,
  PageSkeleton,
  Panel,
  SegmentTabs,
  StatusBadge,
  SurfaceCard,
  formatDateTime,
} from "@/components/delivery/DeliveryUI";
import { StaleVersionBanner } from "@/components/org-console/StaleVersionBanner";
import { apiErrorMessage, toState } from "@/components/org-console/useRoleApi";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * Task 3.2 Scope tab: the active version, drafts with their diff and effect, approval on the page (no dialog), and the
 * full version history. Approved versions never change.
 */

const QUERY = { retry: false } as const;
const KIND_LABEL: Record<ScopeChangeKindDto, string> = { ADD: "Add", REMOVE: "Remove", CANCEL: "Cancel", SPLIT: "Split", REWEIGHT: "Change points" };

export function scopeEffect(active: ScopeVersionDto | undefined, draft: ScopeVersionDto): string {
  const before = active ? Number(active.total_points) : 0;
  return `Total points ${before} becomes ${Number(draft.total_points)}`;
}

export function ScopeVersionCard({ version, active, onApprove, approving }: {
  version: ScopeVersionDto;
  active?: ScopeVersionDto;
  onApprove?: () => void;
  approving?: boolean;
}) {
  const tone = version.status === "ACTIVE" ? "success" : version.status === "DRAFT" ? "warning" : "neutral";
  return (
    <SurfaceCard className="p-4 space-y-2 text-xs" data-testid={`scope-${version.status.toLowerCase()}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{version.status === "DRAFT" ? `Draft for version ${version.version_no}` : `Version ${version.version_no}`}</span>
        <StatusBadge label={version.status.toLowerCase()} tone={tone} dot />
        <span className="text-[var(--color-text-muted)]">{Number(version.total_points)} points · {version.leaves.length} tasks</span>
      </div>
      <p className="text-[var(--color-text-secondary)]">“{version.reason}” · by {version.author_email}{version.approver_email ? ` · approved by ${version.approver_email}` : ""}
        {version.approved_at ? ` · ${formatDateTime(version.approved_at)}` : ` · ${formatDateTime(version.created_at)}`}</p>
      {version.changes.length > 0 && (
        <ul className="space-y-0.5" data-testid="scope-diff">
          {version.changes.map((change, index) => (
            <li key={index}>
              <b>{KIND_LABEL[change.kind]}</b> {change.key} {change.title}
              {change.kind === "REWEIGHT" && ` · ${Number(change.previous_points)} → ${Number(change.new_points)} pts`}
              {(change.kind === "ADD" || (change.kind === "SPLIT" && change.source_work_item_id)) && change.new_points !== null && ` · ${Number(change.new_points)} pts`}
            </li>
          ))}
        </ul>
      )}
      {version.status === "DRAFT" && onApprove && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="font-semibold">{scopeEffect(active, version)}.</span>
          <AdminButton size="sm" isLoading={approving} onClick={onApprove}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</AdminButton>
        </div>
      )}
    </SurfaceCard>
  );
}

interface DraftChange { kind: ScopeChangeKindDto; workItemId: string; title: string; points: string; parentId: string; parts: { title: string; points: string }[] }
const EMPTY_CHANGE: DraftChange = { kind: "ADD", workItemId: "", title: "", points: "", parentId: "", parts: [{ title: "", points: "" }, { title: "", points: "" }] };

export function toChangeRequest(change: DraftChange): ScopeChangeRequestDto {
  switch (change.kind) {
    case "ADD": return { kind: "ADD", title: change.title, points: Number(change.points), parent_id: change.parentId || null };
    case "REWEIGHT": return { kind: "REWEIGHT", work_item_id: change.workItemId, points: Number(change.points) };
    case "SPLIT": return { kind: "SPLIT", work_item_id: change.workItemId, parts: change.parts.map((p) => ({ title: p.title, points: Number(p.points) })) };
    default: return { kind: change.kind, work_item_id: change.workItemId };
  }
}

function DraftEditor({ items, onSubmit, saving }: { items: WorkItemDto[]; onSubmit: (reason: string, changes: ScopeChangeRequestDto[]) => void; saving: boolean }) {
  const [reason, setReason] = useState("");
  const [changes, setChanges] = useState<DraftChange[]>([]);
  const [draft, setDraft] = useState<DraftChange>(EMPTY_CHANGE);
  const leaves = items.filter((item) => item.leaf);
  const containers = items.filter((item) => item.type === "MILESTONE" || item.type === "DELIVERABLE");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
        <AdminSelect label="Change" value={draft.kind} onChange={(e) => setDraft({ ...EMPTY_CHANGE, kind: e.target.value as ScopeChangeKindDto })}>
          {(Object.keys(KIND_LABEL) as ScopeChangeKindDto[]).map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}
        </AdminSelect>
        {draft.kind === "ADD" ? (
          <>
            <AdminInput label="Task" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <AdminSelect label="Under" value={draft.parentId} onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}>
              <option value="">Project</option>
              {containers.map((item) => <option key={item.id} value={item.id}>{item.key} {item.title}</option>)}
            </AdminSelect>
          </>
        ) : (
          <AdminSelect label="Task" value={draft.workItemId} onChange={(e) => setDraft({ ...draft, workItemId: e.target.value })}>
            <option value="">Choose…</option>
            {leaves.map((item) => <option key={item.id} value={item.id}>{item.key} {item.title} ({Number(item.points)} pts)</option>)}
          </AdminSelect>
        )}
        {(draft.kind === "ADD" || draft.kind === "REWEIGHT") && (
          <AdminInput label="Points" type="number" min={0.01} step="0.01" value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value })} />
        )}
      </div>
      {draft.kind === "SPLIT" && (
        <div className="space-y-2">
          {draft.parts.map((part, index) => (
            <div key={index} className="grid grid-cols-2 gap-2">
              <AdminInput label={`Part ${index + 1}`} value={part.title}
                onChange={(e) => setDraft({ ...draft, parts: draft.parts.map((p, i) => (i === index ? { ...p, title: e.target.value } : p)) })} />
              <AdminInput label="Points" type="number" min={0.01} step="0.01" value={part.points}
                onChange={(e) => setDraft({ ...draft, parts: draft.parts.map((p, i) => (i === index ? { ...p, points: e.target.value } : p)) })} />
            </div>
          ))}
          <AdminButton variant="ghost" size="xs" onClick={() => setDraft({ ...draft, parts: [...draft.parts, { title: "", points: "" }] })}>Add part</AdminButton>
        </div>
      )}
      <AdminButton variant="outline" size="sm" onClick={() => { setChanges([...changes, draft]); setDraft(EMPTY_CHANGE); }}>
        <Plus className="h-3.5 w-3.5" /> Add to scope change
      </AdminButton>
      {changes.length > 0 && (
        <ul className="space-y-1 text-xs" data-testid="draft-changes">
          {changes.map((change, index) => (
            <li key={index} className="flex items-center justify-between gap-2">
              <span><b>{KIND_LABEL[change.kind]}</b> {change.kind === "ADD" ? change.title : items.find((i) => i.id === change.workItemId)?.key}
                {change.points && ` · ${change.points} pts`}</span>
              <AdminButton variant="ghost" size="xs" onClick={() => setChanges(changes.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></AdminButton>
            </li>
          ))}
        </ul>
      )}
      <AdminTextarea label="Reason (required)" rows={2} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
      <AdminButton size="sm" disabled={changes.length === 0 || !reason.trim()} isLoading={saving}
        onClick={() => onSubmit(reason.trim(), changes.map(toChangeRequest))}>
        <GitCompare className="h-3.5 w-3.5" /> Propose scope change
      </AdminButton>
    </div>
  );
}

export function ScopeTab({ project }: { project: ProjectDto }) {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canChange = can("project.scope.change") && !project.archived;
  const versions = toState(useQuery({ queryKey: ["scope", orgId, project.id], queryFn: () => apiClient.scopeVersions(orgId, project.id), ...QUERY }));
  const items = useQuery({ queryKey: ["work-items", orgId, project.id], queryFn: () => apiClient.workItems(orgId, project.id), ...QUERY });
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["scope", orgId, project.id] });
    void queryClient.invalidateQueries({ queryKey: ["work-items", orgId, project.id] });
  };
  const fail = (failure: unknown) => (isStaleVersion(failure) ? setStale(true) : setError(apiErrorMessage(failure)));
  if (versions.kind === "loading") return <PageSkeleton variant="list" />;
  if (versions.kind !== "ready") return <ErrorBanner message="The scope could not be loaded." onRetry={versions.kind === "error" ? versions.retry : undefined} />;
  const active = versions.data.find((v) => v.status === "ACTIVE");
  const drafts = versions.data.filter((v) => v.status === "DRAFT");
  const history = versions.data.filter((v) => v.status === "SUPERSEDED");
  return (
    <div className="space-y-4" data-testid="scope-tab">
      {stale && <StaleVersionBanner onReload={() => { setStale(false); reload(); }} />}
      {error && <ErrorBanner message={error} />}
      <Panel title="Current scope" icon={CheckCircle2} description="Approved tasks and points. Approved versions never change.">
        {active ? <ScopeVersionCard version={active} /> : <EmptyStateView icon={CheckCircle2} title="No approved scope yet" description="Progress shows Not measurable until a scope is approved." />}
      </Panel>
      {drafts.length > 0 && (
        <Panel title="Waiting for approval" icon={GitCompare}>
          <div className="space-y-2">
            {drafts.map((draft) => (
              <ScopeVersionCard key={draft.id} version={draft} active={active} approving={busy === draft.id}
                onApprove={canChange ? () => {
                  setBusy(draft.id);
                  setError("");
                  apiClient.approveScopeVersion(orgId, project.id, draft.id, draft.version)
                    .then(() => { toast.success(`Scope version ${draft.version_no} approved`); reload(); })
                    .catch(fail).finally(() => setBusy(null));
                } : undefined} />
            ))}
          </div>
        </Panel>
      )}
      {canChange && items.data && (
        <Panel title="Propose a scope change" icon={Plus} description="Add, remove, cancel, split or re-point tasks. It applies only after approval.">
          <DraftEditor items={items.data} saving={busy === "draft"} onSubmit={(reason, changes) => {
            setBusy("draft");
            setError("");
            apiClient.createScopeDraft(orgId, project.id, { reason, expected_base_version: active?.version_no ?? 0, changes })
              .then(() => { toast.success("Scope change proposed"); reload(); })
              .catch(fail).finally(() => setBusy(null));
          }} />
        </Panel>
      )}
      <Panel title="Version history" icon={History}>
        {history.length === 0 ? <p className="text-xs text-[var(--color-text-muted)]">No earlier versions.</p>
          : <div className="space-y-2">{history.map((version) => <ScopeVersionCard key={version.id} version={version} />)}</div>}
      </Panel>
    </div>
  );
}

/* ================================================================== cross-project scope (Project Manager) */

type ScopeFilter = "DRAFT" | "ACTIVE" | "";

/** One project's scope version as a card: project, effect on the total, and Approve when this member may approve it. */
export function ProjectScopeCard({ entry, detailHref, onApprove, approving, canApproveHere }: {
  entry: ProjectScopeVersionDto;
  detailHref?: string;
  onApprove?: () => void;
  approving?: boolean;
  canApproveHere: boolean;
}) {
  return (
    <div className="space-y-1" data-testid="project-scope">
      <p className="text-xs font-medium">
        {detailHref ? <Link className="hover:underline" href={detailHref}>{entry.project_key} · {entry.project_name}</Link> : <>{entry.project_key} · {entry.project_name}</>}
      </p>
      <ScopeVersionCard version={entry.version} active={entry.active ?? undefined} approving={approving}
        onApprove={entry.can_approve && canApproveHere ? onApprove : undefined} />
    </div>
  );
}

function useApproveScope(orgId: string, onDone: () => void) {
  const [pending, setPending] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const approve = (entry: ProjectScopeVersionDto) => {
    setPending(entry.version.id);
    setError("");
    apiClient.approveScopeVersion(orgId, entry.project_id, entry.version.id, entry.version.version)
      .then(() => { toast.success(`Version ${entry.version.version_no} of ${entry.project_key} approved`); onDone(); })
      .catch((failure) => (isStaleVersion(failure) ? setStale(true) : setError(apiErrorMessage(failure))))
      .finally(() => setPending(null));
  };
  return { approve, pending, stale, setStale, error };
}

export function ScopeListView({ crumbs, back, detailHref }: {
  crumbs: { label: string; href?: string }[];
  back: { href: string; label: string };
  detailHref: (entry: ProjectScopeVersionDto) => string;
}) {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const queryClient = useQueryClient();
  const { canAny } = usePermissions();
  const [filter, setFilter] = useState<ScopeFilter>("DRAFT");
  const state = toState(useQuery({ queryKey: ["org-scope", orgId, filter], queryFn: () => apiClient.orgScopeVersions(orgId, filter || undefined), retry: false }));
  const reload = () => void queryClient.invalidateQueries({ queryKey: ["org-scope", orgId] });
  const { approve, pending, stale, setStale, error } = useApproveScope(orgId, reload);
  return (
    <PageFrame crumbs={[...crumbs, { label: "Scope changes" }]} back={back} title="Scope changes"
      description="Drafts wait for approval. An approved version becomes the new total for progress; earlier versions never change.">
      {stale && <StaleVersionBanner onReload={() => { setStale(false); reload(); }} />}
      {error && <ErrorBanner message={error} />}
      <SegmentTabs value={filter} onChange={(value) => setFilter(value as ScopeFilter)}
        options={[{ value: "DRAFT", label: "Waiting for approval" }, { value: "ACTIVE", label: "Active" }, { value: "", label: "All versions" }]} />
      <div className="mt-4">
        {state.kind === "loading" ? <PageSkeleton variant="list" />
          : state.kind !== "ready" ? <ErrorBanner message="Scope versions could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
            : state.data.length === 0
              ? <EmptyStateView icon={GitCompare} title={filter === "DRAFT" ? "Nothing waiting" : "No scope versions"}
                  description={filter === "DRAFT" ? "Draft scope changes of your projects appear here." : "Structured projects get version 1 when they are created."} />
              : (
                <div className="space-y-4">
                  {state.data.map((entry) => (
                    <ProjectScopeCard key={entry.version.id} entry={entry} detailHref={detailHref(entry)} approving={pending === entry.version.id}
                      canApproveHere={canAny(["project.scope.change"], { projectId: entry.project_id })} onApprove={() => approve(entry)} />
                  ))}
                </div>
              )}
      </div>
    </PageFrame>
  );
}

export function ScopeDetailView({ versionId, crumbs, back, projectHref }: {
  versionId: string;
  crumbs: { label: string; href?: string }[];
  back: { href: string; label: string };
  projectHref?: (projectId: string) => string;
}) {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const queryClient = useQueryClient();
  const { canAny } = usePermissions();
  const query = useQuery({ queryKey: ["org-scope-version", orgId, versionId], queryFn: () => apiClient.orgScopeVersion(orgId, versionId), retry: false });
  const state = toState(query);
  const notFound = query.error instanceof ApiError && query.error.status === 404;
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["org-scope-version", orgId, versionId] });
    void queryClient.invalidateQueries({ queryKey: ["org-scope", orgId] });
  };
  const { approve, pending, stale, setStale, error } = useApproveScope(orgId, reload);
  const entry = state.kind === "ready" ? state.data : null;
  return (
    <PageFrame crumbs={[...crumbs, { label: entry ? `${entry.project_key} v${entry.version.version_no}` : "Scope version" }]} back={back}
      title={entry ? `${entry.project_key} · scope version ${entry.version.version_no}` : "Scope version"}>
      {stale && <StaleVersionBanner onReload={() => { setStale(false); reload(); }} />}
      {error && <ErrorBanner message={error} />}
      {state.kind === "loading" ? <PageSkeleton variant="detail" />
        : notFound || state.kind === "forbidden"
          ? <EmptyStateView icon={History} title="Scope version not found" description="It doesn't exist or belongs to a project you can't see." />
          : state.kind !== "ready" ? <ErrorBanner message="The scope version could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
            : (
              <div className="space-y-3">
                {projectHref && <Link className="text-xs text-blue-600 hover:underline" href={projectHref(state.data.project_id)}>Open the project</Link>}
                <ProjectScopeCard entry={state.data} approving={pending === state.data.version.id}
                  canApproveHere={canAny(["project.scope.change"], { projectId: state.data.project_id })} onApprove={() => approve(state.data)} />
              </div>
            )}
    </PageFrame>
  );
}
