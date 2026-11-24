"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Download, FileText, FolderPlus, Layers, ListChecks, Plus, Tags, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { apiClient, isStaleVersion } from "@/lib/api";
import type {
  AssignableItemDto,
  CreateProjectDto,
  ProjectDocumentDto,
  ProjectDto,
  ProjectOptionsDto,
  WorkItemDto,
  WorkLevelDto,
  WorkTypeDto,
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
  SegmentTabs,
  StatusBadge,
  SurfaceCard,
} from "@/components/delivery/DeliveryUI";
import { StaleVersionBanner } from "@/components/org-console/StaleVersionBanner";
import { apiErrorMessage, toState } from "@/components/org-console/useRoleApi";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * Task 3.1 screens. Create Project setup (documents, phases, tasks with points and a reviewer), the project's
 * breakdown and documents, the Team Lead's assignment page and work types. Pages, no popups.
 */

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const QUERY = { retry: false } as const;
const LEVEL_LABEL: Record<WorkLevelDto, string> = { MILESTONE: "Phase", DELIVERABLE: "Deliverable", TASK: "Task", SUBTASK: "Subtask" };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ================================================================== Create Project setup */

export interface DraftTask { title: string; points: string; reviewer: string }
export interface DraftPhase { title: string; tasks: DraftTask[] }
type SetupStep = "documents" | "phases" | "tasks" | "review";

/** What the final "Create project" needs: at least one document, one phase and one task with points and a reviewer. */
export function setupProblems(documents: ProjectDocumentDto[], phases: DraftPhase[]): string[] {
  const problems: string[] = [];
  if (documents.length === 0) problems.push("Upload at least one document.");
  if (phases.length === 0) problems.push("Add at least one phase.");
  const tasks = phases.flatMap((phase) => phase.tasks);
  if (tasks.length === 0) problems.push("Add at least one task with points.");
  if (tasks.some((task) => !(Number(task.points) > 0) || !task.reviewer)) problems.push("Every task needs points greater than 0 and a reviewer.");
  return problems;
}

export function StructuredSetupSteps({ orgId, details, options, onBack, onCreated }: {
  orgId: string;
  details: CreateProjectDto;
  options: ProjectOptionsDto;
  onBack: () => void;
  onCreated: (project: ProjectDto) => void;
}) {
  const [step, setStep] = useState<SetupStep>("documents");
  const [documents, setDocuments] = useState<ProjectDocumentDto[]>([]);
  const [uploading, setUploading] = useState(0);
  const [phases, setPhases] = useState<DraftPhase[]>([]);
  const [error, setError] = useState("");
  const create = useMutation({
    mutationFn: () => apiClient.createConfiguredProject(orgId, {
      project: details,
      document_ids: documents.map((document) => document.id),
      phases: phases.map((phase) => ({
        title: phase.title,
        tasks: phase.tasks.map((task) => ({ title: task.title, points: Number(task.points), reviewer_membership_id: task.reviewer })),
      })),
    }),
  });
  const problems = setupProblems(documents, phases);

  const upload = async (files: FileList | null) => {
    if (!files) return;
    setError("");
    for (const file of Array.from(files)) {
      if (file.size > MAX_DOCUMENT_BYTES) { setError(`${file.name} is larger than 10 MB.`); continue; }
      if (file.size === 0) { setError(`${file.name} is empty.`); continue; }
      setUploading((n) => n + 1);
      try {
        const stored = await apiClient.uploadProjectDocument(orgId, file);
        setDocuments((current) => [...current, stored]);
      } catch (failure) {
        setError(`${file.name}: ${apiErrorMessage(failure)}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  return (
    <div className="space-y-4" data-testid="structured-setup">
      <SurfaceCard className="p-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{details.key} · {details.name}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">Structured project. Complete the steps; the project is created at the end.</p>
        </div>
        <AdminButton variant="ghost" size="sm" onClick={onBack}>Edit details</AdminButton>
      </SurfaceCard>
      <SegmentTabs<SetupStep> value={step} onChange={setStep} options={[
        { value: "documents", label: `1. Documents (${documents.length})` },
        { value: "phases", label: `2. Phases (${phases.length})` },
        { value: "tasks", label: `3. Tasks (${phases.reduce((n, p) => n + p.tasks.length, 0)})` },
        { value: "review", label: "4. Create" },
      ]} />
      {error && <ErrorBanner message={error} />}

      {step === "documents" && (
        <Panel title="Upload documents" icon={Upload} description="Up to 10 MB each. At least one document is required.">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] p-6 text-xs text-[var(--color-text-secondary)] hover:border-blue-500">
            <Upload className="h-5 w-5" aria-hidden="true" />
            <span>{uploading > 0 ? `Uploading ${uploading} file(s)…` : "Choose files to upload"}</span>
            <input type="file" multiple className="sr-only" onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} />
          </label>
          <DocumentList documents={documents} onRemove={(id) => setDocuments((current) => current.filter((d) => d.id !== id))} />
          <StepNav onNext={() => setStep("phases")} />
        </Panel>
      )}

      {step === "phases" && (
        <Panel title="Add phases" icon={Layers} description="At least one phase. Tasks are added under each phase in the next step.">
          <PhaseEditor phases={phases} onChange={setPhases} />
          <StepNav onBack={() => setStep("documents")} onNext={() => setStep("tasks")} />
        </Panel>
      )}

      {step === "tasks" && (
        <Panel title="Add tasks" icon={ListChecks} description="Each task gets points and the reviewer who approves it. Progress counts the points of approved tasks.">
          {phases.length === 0 ? <p className="text-xs text-[var(--color-text-muted)]">Add a phase first.</p> : (
            <div className="space-y-4">
              {phases.map((phase, index) => (
                <TaskEditor key={index} phase={phase} options={options}
                  onChange={(next) => setPhases((current) => current.map((p, i) => (i === index ? next : p)))} />
              ))}
            </div>
          )}
          <StepNav onBack={() => setStep("phases")} onNext={() => setStep("review")} />
        </Panel>
      )}

      {step === "review" && (
        <Panel title="Create project" icon={FolderPlus}>
          <SetupSummary documents={documents} phases={phases} />
          {problems.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-rose-600 dark:text-rose-400" data-testid="setup-problems">
              {problems.map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <AdminButton variant="outline" onClick={() => setStep("tasks")}>Back</AdminButton>
            <AdminButton disabled={problems.length > 0} isLoading={create.isPending} onClick={() => {
              setError("");
              create.mutate(undefined, {
                onSuccess: (result) => { toast.success(`${result.project.key} created with ${result.items.filter((i) => i.leaf).length} tasks`); onCreated(result.project); },
                onError: (failure) => setError(apiErrorMessage(failure)),
              });
            }}>
              <FolderPlus className="w-3.5 h-3.5" /> Create project
            </AdminButton>
          </div>
        </Panel>
      )}
    </div>
  );
}

function StepNav({ onBack, onNext }: { onBack?: () => void; onNext?: () => void }) {
  return (
    <div className="mt-4 flex gap-2">
      {onBack && <AdminButton variant="outline" size="sm" onClick={onBack}>Back</AdminButton>}
      {onNext && <AdminButton size="sm" onClick={onNext}>Next</AdminButton>}
    </div>
  );
}

export function DocumentList({ documents, onRemove, onDownload }: {
  documents: ProjectDocumentDto[];
  onRemove?: (id: string) => void;
  onDownload?: (document: ProjectDocumentDto) => void;
}) {
  if (documents.length === 0) return <p className="mt-3 text-xs text-[var(--color-text-muted)]">No documents yet.</p>;
  return (
    <ul className="mt-3 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="document-list">
      {documents.map((document) => (
        <li key={document.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
          <span className="flex min-w-0 items-center gap-2"><FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{document.file_name}</span>
            <span className="text-[var(--color-text-muted)]">{formatBytes(document.file_size)}</span></span>
          <span className="flex gap-1">
            {onDownload && <AdminButton variant="ghost" size="xs" onClick={() => onDownload(document)}><Download className="h-3.5 w-3.5" /> Download</AdminButton>}
            {onRemove && <AdminButton variant="ghost" size="xs" onClick={() => onRemove(document.id)}><Trash2 className="h-3.5 w-3.5" /> Remove</AdminButton>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PhaseEditor({ phases, onChange }: { phases: DraftPhase[]; onChange: (phases: DraftPhase[]) => void }) {
  const [title, setTitle] = useState("");
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        onChange([...phases, { title: title.trim(), tasks: [] }]);
        setTitle("");
      }}>
        <div className="flex-1"><AdminInput label="Phase name" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="self-end"><AdminButton type="submit" size="sm"><Plus className="h-3.5 w-3.5" /> Add phase</AdminButton></div>
      </form>
      {phases.length === 0 ? <p className="text-xs text-[var(--color-text-muted)]">No phases yet.</p> : (
        <ol className="space-y-1 text-xs" data-testid="phase-list">
          {phases.map((phase, index) => (
            <li key={index} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2">
              <span><b>{index + 1}.</b> {phase.title} <span className="text-[var(--color-text-muted)]">· {phase.tasks.length} tasks</span></span>
              <AdminButton variant="ghost" size="xs" onClick={() => onChange(phases.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /> Remove</AdminButton>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function TaskEditor({ phase, options, onChange }: { phase: DraftPhase; options: ProjectOptionsDto; onChange: (phase: DraftPhase) => void }) {
  const [draft, setDraft] = useState<DraftTask>({ title: "", points: "", reviewer: "" });
  const [error, setError] = useState("");
  return (
    <SurfaceCard className="p-3 space-y-2">
      <p className="text-xs font-semibold">{phase.title}</p>
      {phase.tasks.length > 0 && (
        <ul className="space-y-1 text-xs">
          {phase.tasks.map((task, index) => (
            <li key={index} className="flex items-center justify-between gap-2">
              <span>{task.title} · <b>{task.points} pts</b> · reviewer {options.members.find((m) => m.membership_id === task.reviewer)?.email ?? "?"}</span>
              <AdminButton variant="ghost" size="xs" onClick={() => onChange({ ...phase, tasks: phase.tasks.filter((_, i) => i !== index) })}>
                <Trash2 className="h-3.5 w-3.5" /> Remove</AdminButton>
            </li>
          ))}
        </ul>
      )}
      <form className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end" onSubmit={(event) => {
        event.preventDefault();
        if (!draft.title.trim()) return setError("Enter the task title.");
        if (!(Number(draft.points) > 0)) return setError("Enter points greater than 0.");
        if (!draft.reviewer) return setError("Choose the reviewer.");
        setError("");
        onChange({ ...phase, tasks: [...phase.tasks, { ...draft, title: draft.title.trim() }] });
        setDraft({ title: "", points: "", reviewer: "" });
      }}>
        <AdminInput label="Task" value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <AdminInput label="Points" type="number" min={0.01} step="0.01" value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value })} />
        <AdminSelect label="Reviewer" value={draft.reviewer} onChange={(e) => setDraft({ ...draft, reviewer: e.target.value })}>
          <option value="">Choose…</option>
          {options.members.map((member) => <option key={member.membership_id} value={member.membership_id}>{member.email}</option>)}
        </AdminSelect>
        <AdminButton type="submit" size="sm"><Plus className="h-3.5 w-3.5" /> Add task</AdminButton>
      </form>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </SurfaceCard>
  );
}

function SetupSummary({ documents, phases }: { documents: ProjectDocumentDto[]; phases: DraftPhase[] }) {
  const total = phases.flatMap((p) => p.tasks).reduce((sum, task) => sum + (Number(task.points) || 0), 0);
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs" data-testid="setup-summary">
      <div><dt className="text-[var(--color-text-muted)]">Documents</dt><dd className="font-semibold">{documents.length}</dd></div>
      <div><dt className="text-[var(--color-text-muted)]">Phases</dt><dd className="font-semibold">{phases.length}</dd></div>
      <div><dt className="text-[var(--color-text-muted)]">Tasks</dt><dd className="font-semibold">{phases.reduce((n, p) => n + p.tasks.length, 0)}</dd></div>
      <div><dt className="text-[var(--color-text-muted)]">Total points</dt><dd className="font-semibold">{total}</dd></div>
    </dl>
  );
}

/* ================================================================== project breakdown + documents */

function useWorkItems(orgId: string, projectId: string) {
  return toState(useQuery({ queryKey: ["work-items", orgId, projectId], queryFn: () => apiClient.workItems(orgId, projectId), ...QUERY }));
}

function depthOf(item: WorkItemDto, byId: Map<string, WorkItemDto>) {
  let depth = 0;
  let parent = item.parent_id ? byId.get(item.parent_id) : undefined;
  while (parent && depth < 6) { depth += 1; parent = parent.parent_id ? byId.get(parent.parent_id) : undefined; }
  return depth;
}

/** The breakdown in tree order (the API returns it that way): phases, deliverables, tasks with points and people. */
export function BreakdownTree({ items, onAssign, assignees }: {
  items: WorkItemDto[];
  onAssign?: (item: WorkItemDto, membershipId: string) => void;
  assignees?: { membership_id: string; email: string | null }[];
}) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const total = items.filter((item) => item.leaf).reduce((sum, item) => sum + Number(item.points), 0);
  if (items.length === 0) return <EmptyStateView icon={ListChecks} title="No work yet" description="This project has no phases or tasks." />;
  return (
    <div className="space-y-2" data-testid="breakdown">
      <p className="text-[11px] text-[var(--color-text-muted)]">Total points: <b>{total}</b>. Phases never earn credit; only approved tasks count (tasks 3.3 and 3.5).</p>
      <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs" style={{ paddingLeft: `${12 + depthOf(item, byId) * 20}px` }}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="font-mono text-[var(--color-text-muted)]">{item.key}</span>
              <StatusBadge label={LEVEL_LABEL[item.type]} tone={item.type === "MILESTONE" ? "violet" : "neutral"} />
              <span className={item.type === "MILESTONE" ? "font-semibold" : ""}>{item.title}</span>
            </span>
            {item.leaf && (
              <span className="flex flex-wrap items-center gap-2 text-[var(--color-text-secondary)]">
                <b>{Number(item.points)} {item.unit}</b>
                <span>Assignee: {item.assignee?.email ?? "Unassigned"}</span>
                <span>Reviewer: {item.reviewer?.email ?? "None"}</span>
                {onAssign && assignees && (
                  <select aria-label={`Assign ${item.key}`} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5"
                    value={item.assignee?.membership_id ?? ""} onChange={(e) => e.target.value && onAssign(item, e.target.value)}>
                    <option value="">Assign…</option>
                    {assignees.map((person) => <option key={person.membership_id} value={person.membership_id}>{person.email}</option>)}
                  </select>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BreakdownTab({ project }: { project: ProjectDto }) {
  const orgId = useOrgId();
  const state = useWorkItems(orgId, project.id);
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canAssign = can("task.assign");
  const assignees = useQuery({ queryKey: ["assignees", orgId, project.id], queryFn: () => apiClient.projectAssignees(orgId, project.id), enabled: canAssign, ...QUERY });
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const assign = useMutation({
    mutationFn: ({ item, membershipId }: { item: WorkItemDto; membershipId: string }) =>
      apiClient.assignWorkItem(orgId, project.id, item.id, { assignee_membership_id: membershipId, expected_version: item.version }),
    onSuccess: () => { toast.success("Task assigned"); void queryClient.invalidateQueries({ queryKey: ["work-items", orgId, project.id] }); },
    onError: (failure) => (isStaleVersion(failure) ? setStale(true) : setError(apiErrorMessage(failure))),
  });
  if (state.kind === "loading") return <PageSkeleton variant="list" />;
  if (state.kind !== "ready") return <ErrorBanner message="The breakdown could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />;
  return (
    <Panel title="Breakdown" icon={ListChecks} description="Phases and tasks with points, assignee and reviewer.">
      {stale && <StaleVersionBanner onReload={() => { setStale(false); void queryClient.invalidateQueries({ queryKey: ["work-items", orgId, project.id] }); }} />}
      {error && <ErrorBanner message={error} />}
      <BreakdownTree items={state.data} assignees={assignees.data} onAssign={canAssign && assignees.data
        ? (item, membershipId) => { setError(""); assign.mutate({ item, membershipId }); } : undefined} />
    </Panel>
  );
}

export function DocumentsTab({ project }: { project: ProjectDto }) {
  const orgId = useOrgId();
  const state = toState(useQuery({ queryKey: ["project-documents", orgId, project.id], queryFn: () => apiClient.projectDocuments(orgId, project.id), ...QUERY }));
  const download = async (document: ProjectDocumentDto) => {
    try {
      const blob = await apiClient.downloadProjectDocument(orgId, project.id, document.id);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (failure) {
      toast.error(apiErrorMessage(failure));
    }
  };
  if (state.kind === "loading") return <PageSkeleton variant="list" />;
  if (state.kind !== "ready") return <ErrorBanner message="Documents could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />;
  return (
    <Panel title="Documents" icon={FileText}>
      <DocumentList documents={state.data} onDownload={(document) => void download(document)} />
    </Panel>
  );
}

/* ================================================================== Team Lead: assign work */

function useOrgId() {
  const params = useParams();
  return (params?.orgId as string) || "";
}

export function AssignWorkList({ items, people, onAssign, pending }: {
  items: AssignableItemDto[];
  people: Record<string, { membership_id: string; email: string | null }[]>;
  onAssign: (entry: AssignableItemDto, membershipId: string) => void;
  pending: string | null;
}) {
  if (items.length === 0) {
    return <EmptyStateView icon={CheckCircle2} title="Nothing to assign" description="No tasks of the projects you lead or manage need assigning." />;
  }
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="assign-work">
      {items.map((entry) => (
        <li key={entry.item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
          <span className="min-w-0">
            <span className="font-mono text-[var(--color-text-muted)]">{entry.item.key}</span> {entry.item.title}
            <span className="block text-[var(--color-text-muted)]">{entry.project_key} · {entry.project_name} · {Number(entry.item.points)} {entry.item.unit}</span>
          </span>
          <span className="flex items-center gap-2">
            {entry.item.assignee ? <StatusBadge label={entry.item.assignee.email ?? "Assigned"} tone="success" /> : <StatusBadge label="Unassigned" tone="warning" />}
            <select aria-label={`Assign ${entry.item.key}`} disabled={pending === entry.item.id}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5"
              value="" onChange={(e) => e.target.value && onAssign(entry, e.target.value)}>
              <option value="">{entry.item.assignee ? "Reassign…" : "Assign…"}</option>
              {(people[entry.project_id] ?? []).map((person) => <option key={person.membership_id} value={person.membership_id}>{person.email}</option>)}
            </select>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AssignWorkView({ crumbs, back }: { crumbs: { label: string; href?: string }[]; back: { href: string; label: string } }) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const state = toState(useQuery({ queryKey: ["assignable", orgId], queryFn: () => apiClient.assignableWork(orgId), ...QUERY }));
  const projectIds = state.kind === "ready" ? [...new Set(state.data.map((entry) => entry.project_id))] : [];
  const people = useQuery({
    queryKey: ["assignees-by-project", orgId, projectIds.join(",")],
    queryFn: async () => Object.fromEntries(await Promise.all(projectIds.map(async (id) => [id, await apiClient.projectAssignees(orgId, id)] as const))),
    enabled: projectIds.length > 0,
    ...QUERY,
  });
  const [pending, setPending] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const reload = () => void queryClient.invalidateQueries({ queryKey: ["assignable", orgId] });
  const onAssign = (entry: AssignableItemDto, membershipId: string) => {
    setPending(entry.item.id);
    setError("");
    apiClient.assignWorkItem(orgId, entry.project_id, entry.item.id, { assignee_membership_id: membershipId, expected_version: entry.item.version })
      .then(() => { toast.success(`${entry.item.key} assigned`); reload(); })
      .catch((failure) => (isStaleVersion(failure) ? setStale(true) : setError(apiErrorMessage(failure))))
      .finally(() => setPending(null));
  };
  return (
    <PageFrame crumbs={[...crumbs, { label: "Assign work" }]} back={back} title="Assign work"
      description="Tasks of the projects whose team you lead (or that you manage). Each task gets one developer from the project's team.">
      {stale && <StaleVersionBanner onReload={() => { setStale(false); reload(); }} />}
      {error && <ErrorBanner message={error} />}
      {state.kind === "loading" ? <PageSkeleton variant="list" />
        : state.kind !== "ready" ? <ErrorBanner message="Tasks could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
          : <AssignWorkList items={state.data} people={people.data ?? {}} onAssign={onAssign} pending={pending} />}
    </PageFrame>
  );
}

/* ================================================================== work types (T19) */

export function WorkTypesView({ crumbs, back }: { crumbs: { label: string; href?: string }[]; back: { href: string; label: string } }) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManage = can("project.create");
  const state = toState(useQuery({ queryKey: ["work-types", orgId], queryFn: () => apiClient.workTypes(orgId), ...QUERY }));
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const reload = () => void queryClient.invalidateQueries({ queryKey: ["work-types", orgId] });
  const run = (action: Promise<unknown>, done: string) => {
    setError("");
    action.then(() => { toast.success(done); reload(); }).catch((failure) => setError(apiErrorMessage(failure)));
  };
  return (
    <PageFrame crumbs={[...crumbs, { label: "Work types" }]} back={back} title="Work types" description="Types you can give to phases and tasks. Retired types stay on existing work.">
      {error && <ErrorBanner message={error} />}
      {canManage && (
        <form className="flex gap-2" onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          run(apiClient.createWorkType(orgId, { name: name.trim() }), "Work type created");
          setName("");
        }}>
          <div className="flex-1"><AdminInput label="New work type" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
          <div className="self-end"><AdminButton type="submit" size="sm"><Tags className="h-3.5 w-3.5" /> Add</AdminButton></div>
        </form>
      )}
      {state.kind === "loading" ? <PageSkeleton variant="list" />
        : state.kind !== "ready" ? <ErrorBanner message="Work types could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
          : state.data.length === 0 ? <EmptyStateView icon={ClipboardList} title="No work types" description="Add one to label phases and tasks." />
            : (
              <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="work-types">
                {state.data.map((type: WorkTypeDto) => (
                  <li key={type.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                    {editing?.id === type.id ? (
                      <form className="flex flex-1 gap-2" onSubmit={(event) => {
                        event.preventDefault();
                        run(apiClient.updateWorkType(orgId, type.id, { name: editing.name, expected_version: type.version }), "Work type renamed");
                        setEditing(null);
                      }}>
                        <input aria-label="Name" className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
                          value={editing.name} onChange={(e) => setEditing({ id: type.id, name: e.target.value })} />
                        <AdminButton type="submit" size="xs">Save</AdminButton>
                        <AdminButton variant="ghost" size="xs" onClick={() => setEditing(null)}>Cancel</AdminButton>
                      </form>
                    ) : (
                      <>
                        <span>{type.name} {type.retired && <StatusBadge label="Retired" tone="neutral" />}</span>
                        {canManage && !type.retired && (
                          <span className="flex gap-1">
                            <AdminButton variant="ghost" size="xs" onClick={() => setEditing({ id: type.id, name: type.name })}>Rename</AdminButton>
                            <AdminButton variant="ghost" size="xs" onClick={() => run(apiClient.retireWorkType(orgId, type.id, type.version), "Work type retired")}>Retire</AdminButton>
                          </span>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
    </PageFrame>
  );
}

