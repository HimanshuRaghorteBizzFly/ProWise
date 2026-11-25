"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardList,
  FileUp,
  FolderPlus,
  GitBranch,
  Pencil,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AdminButton, AdminInput, AdminTextarea, EmptyStateView, PageFrame, Panel, StatusBadge } from "@/components/delivery/DeliveryUI";
import { DevGate, SectionGate, changeError, dateTimeText } from "@/components/developer/DevUI";
import { toState } from "@/components/org-console/useRoleApi";
import { endAfterStartChange, endDateError, isIsoDate, localToday, startDateError } from "@/components/projects/projectDates";
import { apiClient } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { AccessDeniedState } from "@/components/org-console/AccessStates";
import type { PermissionKey } from "@/types/permission";
import type { DeliveryModeChoice, DraftViewDto, FileViewDto, SetupOptionsDto } from "@/types/flow";
import { FileRow, formatBytes } from "./FlowUI";
import { PeoplePicker, PlanStep, suggestKey, totalPoints, type PhaseRow, type TaskRow } from "./ProjectSetupWizard";
import { useFlowMutation, useSetupOptions, useUploadFile } from "./useFlowApi";
import { GitHubRepoPicker } from "./GitHubIntegration";

/**
 * Create Project as separate pages: Basics -> Documents -> Phases & tasks (Team) -> GitHub -> People -> Approvers ->
 * Review & create. Step 1 saves a DRAFT that only its creator sees; every later step saves onto it. "Create project"
 * activates it in one transaction on the server, which re-validates everything. Nothing appears in project lists
 * until then.
 */

export type DraftStep = "basics" | "documents" | "plan" | "repository" | "people" | "approvers" | "review";
export type CreateBase = "owner" | "admin" | "manager";

const STEP_LABEL: Record<DraftStep, string> = {
  basics: "Basics",
  documents: "Documents",
  plan: "Phases & tasks",
  repository: "GitHub",
  people: "People",
  approvers: "Approvers",
  review: "Review & create",
};
const BASE_LABEL: Record<CreateBase, string> = { owner: "Owner", admin: "Admin", manager: "Manager" };

export function stepsFor(mode: DeliveryModeChoice | string): DraftStep[] {
  return mode === "SOLO"
    ? ["basics", "documents", "repository", "people", "approvers", "review"]
    : ["basics", "documents", "plan", "repository", "people", "approvers", "review"];
}

export function createPaths(orgId: string, base: CreateBase) {
  const home = `/org/${orgId}/${base}`;
  const start = base === "manager" ? `${home}/create-project` : `${home}/projects/new`;
  return {
    home,
    start,
    projects: `${home}/projects`,
    step: (draftId: string, step: DraftStep) => `${start}/${draftId}/${step}`,
    project: (projectId: string) => `${home}/projects/${projectId}`,
  };
}

function StepIndicator({ steps, current, draftId, paths }: {
  steps: DraftStep[]; current: DraftStep; draftId: string | null; paths: ReturnType<typeof createPaths>;
}) {
  const index = steps.indexOf(current);
  return (
    <nav aria-label="Create project steps" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
      <ol className="flex gap-1 overflow-x-auto">
        {steps.map((s, i) => {
          const done = i < index;
          const active = s === current;
          const label = <><span className="mr-1 tabular-nums text-[var(--color-text-muted)]">{i + 1}.</span>{STEP_LABEL[s]}</>;
          const cls = `block shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${active
            ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : done ? "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
              : "text-[var(--color-text-muted)]"}`;
          return (
            <li key={s}>
              {draftId && (done || active)
                ? <Link href={paths.step(draftId, s)} aria-current={active ? "step" : undefined} className={cls}>{label}</Link>
                : <span aria-current={active ? "step" : undefined} className={cls}>{label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ================================================================== start page (step 1, no draft yet) */

export function CreateProjectStart({ orgId, base }: { orgId: string; base: CreateBase }) {
  const { can, status } = usePermissions();
  const paths = createPaths(orgId, base);
  if (status === "ready" && !can("project.create" as PermissionKey)) {
    return (
      <PageFrame crumbs={[{ label: BASE_LABEL[base], href: paths.home }, { label: "Create project" }]} title="Create project">
        <AccessDeniedState permission="project.create" backHref={paths.projects} />
      </PageFrame>
    );
  }
  return <CreateProjectStartContent orgId={orgId} base={base} />;
}

function CreateProjectStartContent({ orgId, base }: { orgId: string; base: CreateBase }) {
  const router = useRouter();
  const paths = createPaths(orgId, base);
  const drafts = useQuery({ queryKey: ["flow", "drafts", orgId], queryFn: () => apiClient.flow.drafts.mine(orgId), retry: false });
  const client = useQueryClient();
  const create = useFlowMutation((body: Parameters<typeof apiClient.flow.drafts.create>[1]) => apiClient.flow.drafts.create(orgId, body));
  return (
    <PageFrame crumbs={[{ label: BASE_LABEL[base], href: paths.home }, { label: "Projects", href: paths.projects }, { label: "Create project" }]}
      back={{ href: paths.projects, label: "Back to projects" }} title="Create project"
      description="Step by step. Your answers are saved as a private draft; the project is created only on the last step.">
      <StepIndicator steps={stepsFor("TEAM")} current="basics" draftId={null} paths={paths} />
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Prefer a single form without tasks? <Link href={`${paths.start}/quick`} className="text-blue-600 dark:text-blue-400 hover:underline">Quick create</Link>
      </p>
      <BasicsForm submitting={create.isPending} onSubmit={(body, setError) => create.mutate(body, {
        onSuccess: (draft) => router.push(paths.step(draft.id, "documents")),
        onError: (e) => setError(changeError(e)),
      })} />
      <Panel title="Your drafts" icon={ClipboardList} description="Only you can see these. Resume or discard them.">
        <SectionGate state={toState(drafts)} what="your drafts">
          {(rows) => rows.length === 0 ? <p className="text-xs text-[var(--color-text-muted)]">No drafts.</p> : (
            <ul className="divide-y divide-[var(--color-border)]">
              {rows.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
                  <span className="font-mono text-blue-600 dark:text-blue-400">{d.key}</span>
                  <span className="font-medium">{d.name}</span>
                  <StatusBadge label={d.mode === "TEAM" ? "Team" : "Solo"} tone={d.mode === "TEAM" ? "info" : "violet"} />
                  <span className="text-[var(--color-text-muted)]">saved {dateTimeText(d.updated_at)}</span>
                  <span className="ml-auto flex gap-2">
                    <Link href={paths.step(d.id, "basics")} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">Resume</Link>
                    <button type="button" className="text-rose-600 hover:underline" onClick={() => apiClient.flow.drafts.discard(d.id, d.version)
                      .then(() => { toast.success("Draft discarded."); void client.invalidateQueries({ queryKey: ["flow", "drafts", orgId] }); })
                      .catch((e) => toast.error(changeError(e)))}>Discard</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionGate>
      </Panel>
    </PageFrame>
  );
}

function BasicsForm({ initial, submitting, onSubmit, cancel }: {
  initial?: DraftViewDto;
  submitting: boolean;
  onSubmit: (body: { name: string; key: string; description: string | null; mode: DeliveryModeChoice; start_on: string; target_on: string },
    setError: (message: string) => void) => void;
  cancel?: React.ReactNode;
}) {
  const today = useMemo(() => localToday(), []);
  const [name, setName] = useState(initial?.name ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(!!initial);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [mode, setMode] = useState<DeliveryModeChoice>(initial?.mode ?? "TEAM");
  const [startOn, setStartOn] = useState(initial?.start_on ?? "");
  const [targetOn, setTargetOn] = useState(initial?.target_on ?? "");
  const [error, setError] = useState<string | null>(null);
  const startError = startDateError(startOn, today);
  const endError = endDateError(targetOn, startOn);
  return (
    <Panel title="Basics" icon={FolderPlus} description="Mode changes later only through an approved transition.">
      <form className="space-y-3" noValidate onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Enter a project name.");
        if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) return setError("The key needs 2 to 10 capital letters or digits and must start with a letter.");
        if (!startOn) return setError("Choose a start date.");
        if (startError) return setError(startError);
        if (!targetOn) return setError("Choose an end date.");
        if (endError) return setError(endError);
        if (initial && initial.mode === "TEAM" && mode === "SOLO" && initial.tasks.length > 0
          && !window.confirm("Switching to Solo removes the phases and tasks of this draft. Continue?")) return;
        setError(null);
        onSubmit({ name: name.trim(), key, description: description.trim() || null, mode, start_on: startOn, target_on: targetOn }, setError);
      }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <AdminInput label="Project name" value={name} maxLength={200} onChange={(e) => {
              setName(e.target.value);
              if (!keyTouched) setKey(suggestKey(e.target.value));
            }} />
          </div>
          <AdminInput label="Key (task keys like KEY-12)" value={key} maxLength={10}
            onChange={(e) => { setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setKeyTouched(true); }} />
        </div>
        <AdminTextarea label="Description" rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <legend className="mb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">Mode</legend>
          {(["TEAM", "SOLO"] as DeliveryModeChoice[]).map((value) => (
            <label key={value} className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] p-3 cursor-pointer has-[:checked]:border-blue-500">
              <input type="radio" name="mode" checked={mode === value} onChange={() => setMode(value)} />
              <span>
                <b>{value === "TEAM" ? "Team · Structured Delivery" : "Solo · Individual Ownership"}</b>
                <span className="block text-[var(--color-text-muted)]">{value === "TEAM"
                  ? "Phases and tasks with points (at most 100). Progress = approved points / total."
                  : "One developer submits work with a %; an approver approves it. No phases or tasks."}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AdminInput label="Start date" type="date" value={startOn} min={today} error={startError ?? undefined}
            onChange={(e) => { setStartOn(e.target.value); setTargetOn((end) => endAfterStartChange(end, e.target.value)); }} />
          <AdminInput label="End date" type="date" value={targetOn} min={startOn && isIsoDate(startOn) ? startOn : today}
            disabled={!startOn || !isIsoDate(startOn)} helperText={!startOn ? "Pick a start date first." : undefined}
            error={endError ?? undefined} onChange={(e) => setTargetOn(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          <div>{cancel}</div>
          <AdminButton type="submit" isLoading={submitting}>{initial ? "Save & continue" : "Save draft & continue"}</AdminButton>
        </div>
      </form>
    </Panel>
  );
}

/* ================================================================== a step of an existing draft */

export function DraftStepView({ orgId, base, draftId, step }: { orgId: string; base: CreateBase; draftId: string; step: DraftStep }) {
  const paths = createPaths(orgId, base);
  const draft = useQuery({ queryKey: ["flow", "draft", draftId], queryFn: () => apiClient.flow.drafts.get(draftId), retry: false });
  const back = { href: paths.start, label: "Back to create project" };
  return (
    <DevGate state={toState<DraftViewDto>(draft)} what="This draft" back={back} skeleton="detail">
      {(d) => <DraftStepContent orgId={orgId} base={base} draft={d} step={step} paths={paths} />}
    </DevGate>
  );
}

function DraftStepContent({ orgId, base, draft, step, paths }: {
  orgId: string; base: CreateBase; draft: DraftViewDto; step: DraftStep; paths: ReturnType<typeof createPaths>;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const steps = stepsFor(draft.mode);
  const current: DraftStep = steps.includes(step) ? step : "basics";
  const index = steps.indexOf(current);
  const prev = index > 0 ? steps[index - 1] : null;
  const next = index < steps.length - 1 ? steps[index + 1] : null;
  const goNext = (saved?: DraftViewDto) => {
    if (saved) client.setQueryData(["flow", "draft", draft.id], saved);
    const target = saved ? stepsFor(saved.mode)[stepsFor(saved.mode).indexOf(current) + 1] : next;
    if (target) router.push(paths.step(draft.id, target));
  };
  const save = useFlowMutation((args: { step: Parameters<typeof apiClient.flow.drafts.save>[1]; body: Record<string, unknown> }) =>
    apiClient.flow.drafts.save(draft.id, args.step, { ...args.body, expected_version: draft.version }));
  const options = useSetupOptions(orgId);

  if (draft.status !== "DRAFT") {
    return (
      <PageFrame crumbs={[{ label: BASE_LABEL[base], href: paths.home }, { label: "Create project" }]} title="Draft closed">
        <EmptyStateView icon={CheckCircle2} title={draft.status === "ACTIVATED" ? "This project was created" : "This draft was discarded"}
          description={draft.status === "ACTIVATED" ? "Open it from your project list." : "Start a new project instead."} />
        {draft.project_id && <Link href={paths.project(draft.project_id)} className="text-xs text-blue-600 hover:underline">Open the project</Link>}
      </PageFrame>
    );
  }

  const run = (stepName: Parameters<typeof apiClient.flow.drafts.save>[1], body: Record<string, unknown>, setError?: (m: string) => void) =>
    save.mutate({ step: stepName, body }, {
      onSuccess: (saved) => { toast.success("Saved."); goNext(saved); },
      onError: (e) => (setError ? setError(changeError(e)) : toast.error(changeError(e))),
    });

  return (
    <PageFrame
      crumbs={[{ label: BASE_LABEL[base], href: paths.home }, { label: "Create project", href: paths.start }, { label: `${draft.key} · ${STEP_LABEL[current]}` }]}
      back={prev ? { href: paths.step(draft.id, prev), label: `Back to ${STEP_LABEL[prev]}` } : { href: paths.start, label: "Back to create project" }}
      title={`Create ${draft.name}`} description={`Draft · step ${index + 1} of ${steps.length}: ${STEP_LABEL[current]}. Only you can see it.`}>
      <StepIndicator steps={steps} current={current} draftId={draft.id} paths={paths} />
      {current === "basics" && (
        <BasicsForm initial={draft} submitting={save.isPending} onSubmit={(body, setError) => run("basics", body, setError)} />
      )}
      {current === "documents" && <DocumentsStep orgId={orgId} draft={draft} saving={save.isPending} onSave={(ids) => run("documents", { document_file_ids: ids })} />}
      {current === "plan" && (
        <SectionGate state={options} what="people">
          {(o) => <PlanStepPage draft={draft} options={o} saving={save.isPending}
            onSave={(body, setError) => run("plan", body, setError)} />}
        </SectionGate>
      )}
      {current === "repository" && <RepositoryStep orgId={orgId} returnTo={paths.step(draft.id, "repository")} draft={draft}
        saving={save.isPending} onContinue={() => goNext()}
        onSave={(body, setError) => run("repository", body, setError)} />}
      {current === "people" && (
        <SectionGate state={options} what="people">
          {(o) => <PeopleStep draft={draft} options={o} saving={save.isPending} onSave={(body) => run("people", body)} />}
        </SectionGate>
      )}
      {current === "approvers" && (
        <SectionGate state={options} what="people">
          {(o) => <ApproversStep draft={draft} options={o} saving={save.isPending} onSave={(body) => run("approvers", body)} />}
        </SectionGate>
      )}
      {current === "review" && (
        <SectionGate state={options} what="people">
          {(o) => <ReviewStep draft={draft} options={o} paths={paths} />}
        </SectionGate>
      )}
    </PageFrame>
  );
}

/* ================================================================== steps */

function DocumentsStep({ orgId, draft, saving, onSave }: { orgId: string; draft: DraftViewDto; saving: boolean; onSave: (ids: string[]) => void }) {
  const [documents, setDocuments] = useState<FileViewDto[]>(draft.documents);
  const upload = useUploadFile(orgId);
  return (
    <Panel title="Documents (optional)" icon={FileUp} description={`PDF, Word, Excel, PowerPoint, text or images, up to ${formatBytes(20 * 1024 * 1024)} each.`}>
      <div className="space-y-3">
        <label className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-[var(--color-border)] p-6 text-xs cursor-pointer hover:bg-[var(--color-hover)]">
          <FileUp className="w-5 h-5 text-[var(--color-text-muted)]" aria-hidden="true" />
          <span className="font-medium">{upload.isPending ? "Uploading…" : "Choose files"}</span>
          <input type="file" multiple className="sr-only" aria-label="Upload project documents"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif"
            onChange={(e) => {
              Array.from(e.target.files ?? []).forEach((file) => {
                if (file.size > 20 * 1024 * 1024) return toast.error(`${file.name} is larger than 20 MB.`);
                upload.mutate({ file, kind: "PROJECT_DOCUMENT" }, {
                  onSuccess: (saved) => setDocuments((rows) => [...rows, saved]),
                  onError: (err) => toast.error(`${file.name}: ${changeError(err)}`),
                });
              });
              e.target.value = "";
            }} />
        </label>
        {documents.length === 0 ? <p className="text-xs text-[var(--color-text-muted)]">No documents yet. You can skip this step.</p> : (
          <ul className="divide-y divide-[var(--color-border)]">
            {documents.map((d) => <FileRow key={d.id} file={d} onRemove={() => setDocuments((rows) => rows.filter((r) => r.id !== d.id))} />)}
          </ul>
        )}
        <div className="flex justify-end"><AdminButton isLoading={saving} disabled={upload.isPending} onClick={() => onSave(documents.map((d) => d.id))}>Save & continue</AdminButton></div>
      </div>
    </Panel>
  );
}

function PlanStepPage({ draft, options, saving, onSave }: {
  draft: DraftViewDto; options: SetupOptionsDto; saving: boolean;
  onSave: (body: Record<string, unknown>, setError: (m: string) => void) => void;
}) {
  const [phases, setPhases] = useState<PhaseRow[]>(draft.phases.length > 0 ? draft.phases : [{ ref: `p${Date.now().toString(36)}`, name: "" }]);
  const [tasks, setTasks] = useState<TaskRow[]>(draft.tasks.map((t) => ({
    ref: t.ref, title: t.title, description: t.description ?? "", phaseRef: t.phase_ref, points: String(t.points),
    dependsOnRef: t.depends_on_ref ?? "", assignee: t.assignee_membership_id ?? "",
  })));
  const [error, setError] = useState<string | null>(null);
  const total = totalPoints(tasks);
  const developers = options.people.filter((p) => draft.developer_membership_ids.includes(p.membership_id));
  return (
    <div className="space-y-4">
      <PlanStep phases={phases} setPhases={setPhases} tasks={tasks} setTasks={setTasks} total={total} developers={developers} />
      {total > 0 && total < 100 && (
        <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
          Tasks total {total} points (below 100). That is allowed: progress will be approved points out of {total}.
        </p>
      )}
      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex justify-end">
        <AdminButton isLoading={saving} disabled={total > 100} onClick={() => {
          if (phases.some((p) => !p.name.trim())) return setError("Every phase needs a name.");
          for (const t of tasks) {
            const points = Number(t.points);
            if (!t.title.trim()) return setError("Every task needs a title.");
            if (!t.phaseRef) return setError(`Choose a phase for "${t.title}".`);
            if (!Number.isInteger(points) || points < 1 || points > 100) return setError(`"${t.title}" needs whole points from 1 to 100.`);
          }
          setError(null);
          onSave({
            phases: phases.map((p) => ({ ref: p.ref, name: p.name.trim() })),
            tasks: tasks.map((t) => ({ ref: t.ref, title: t.title.trim(), description: t.description.trim() || null, phase_ref: t.phaseRef,
              points: Number(t.points), depends_on_ref: t.dependsOnRef || null, assignee_membership_id: t.assignee || null })),
          }, setError);
        }}>Save & continue</AdminButton>
      </div>
    </div>
  );
}

function RepositoryStep({ orgId, returnTo, draft, saving, onSave, onContinue }: {
  orgId: string; returnTo: string; draft: DraftViewDto; saving: boolean; onContinue: () => void;
  onSave: (body: Record<string, unknown>, setError: (m: string) => void) => void;
}) {
  const [repository, setRepository] = useState(draft.repository.repository ?? "");
  const [token, setToken] = useState("");
  const [replacing, setReplacing] = useState(false);
  // The organization's GitHub (App) first; a fine-grained token stays available.
  const [useToken, setUseToken] = useState(draft.repository.provider === "GITHUB_TOKEN");
  const [error, setError] = useState<string | null>(null);
  const viaApp = draft.repository.provider === "GITHUB_APP";
  return (
    <Panel title="GitHub repository (optional)" icon={GitBranch}
      description="Commits are linked to tasks by key (e.g. KEY-12). Evidence only: they never set progress.">
      {!draft.can_connect_repository ? (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]" data-testid="admin-later">
            Your role cannot connect repositories. An admin can connect this later from the project&apos;s Repository tab.
          </p>
          <div className="flex justify-end"><AdminButton onClick={onContinue}>Continue</AdminButton></div>
        </div>
      ) : draft.repository.connected && viaApp && !replacing ? (
        <div className="space-y-3 text-xs" data-testid="repo-connected">
          <p>
            <StatusBadge label="Checked" tone="success" />{" "}
            <a href={draft.repository.url ?? "#"} target="_blank" rel="noreferrer noopener" className="ml-1 font-medium text-blue-600 dark:text-blue-400 hover:underline">
              {draft.repository.repository}
            </a>
            {" "}· branch <span className="font-mono">{draft.repository.branch}</span> · via {draft.repository.account}
          </p>
          <p className="text-[var(--color-text-muted)]">Connected through the organization&apos;s GitHub when you create the project; recent commits and pull requests are imported then.</p>
          {error && <p role="alert" className="text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <span className="flex gap-2">
              <AdminButton variant="outline" onClick={() => setReplacing(true)}>Change repository</AdminButton>
              <AdminButton variant="outline" isLoading={saving} onClick={() => onSave({ clear: true }, setError)}>
                <Trash2 className="w-3.5 h-3.5" /> Disconnect
              </AdminButton>
            </span>
            <AdminButton onClick={onContinue}>Continue</AdminButton>
          </div>
        </div>
      ) : !useToken && (!draft.repository.connected || viaApp) ? (
        <div className="space-y-3">
          <GitHubRepoPicker orgId={orgId} target={{ draftId: draft.id }} returnTo={returnTo}
            initial={{ installationId: draft.repository.installation_id ?? null }}
            onCancel={replacing ? () => setReplacing(false) : onContinue}
            onDone={({ choice }) => {
              setError(null);
              onSave({ installation_id: choice.installation_id, repository: choice.repository, branch: choice.branch }, setError);
              setReplacing(false);
            }} />
          {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className="text-xs text-[var(--color-text-muted)] hover:underline" onClick={() => setUseToken(true)}>
              Use a fine-grained personal access token instead
            </button>
            {!draft.repository.connected && <AdminButton variant="ghost" onClick={onContinue}>Skip</AdminButton>}
          </div>
        </div>
      ) : draft.repository.connected && !replacing ? (
        <div className="space-y-3 text-xs" data-testid="repo-connected">
          <p>
            <StatusBadge label="Verified" tone="success" />{" "}
            <a href={draft.repository.url ?? "#"} target="_blank" rel="noreferrer noopener" className="ml-1 font-medium text-blue-600 dark:text-blue-400 hover:underline">
              {draft.repository.repository}
            </a>
            {" "}· token ending in <span className="font-mono">…{draft.repository.token_last4}</span>
          </p>
          <p className="text-[var(--color-text-muted)]">Read access was checked with GitHub. The token is stored encrypted and is never shown again.</p>
          {error && <p role="alert" className="text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <span className="flex gap-2">
              <AdminButton variant="outline" onClick={() => setReplacing(true)}>Replace token</AdminButton>
              <AdminButton variant="outline" isLoading={saving} onClick={() => onSave({ clear: true }, setError)}>
                <Trash2 className="w-3.5 h-3.5" /> Disconnect
              </AdminButton>
            </span>
            <AdminButton onClick={onContinue}>Continue</AdminButton>
          </div>
        </div>
      ) : (
        <form className="space-y-3" noValidate onSubmit={(e) => {
          e.preventDefault();
          if (!repository.trim() || !token.trim()) return setError("Enter owner/repo and the token, or skip this step.");
          setError(null);
          onSave({ repository: repository.trim(), token: token.trim() }, setError);
          setToken("");
        }}>
          <AdminInput label="Repository (owner/name)" placeholder="acme/web" value={repository} onChange={(e) => setRepository(e.target.value)} />
          <AdminInput label="Fine-grained read-only token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)}
            helperText="Only this repository; Contents, Metadata and Pull requests read-only. Verified now, stored encrypted, never shown again." />
          {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          {!draft.repository.connected && (
            <button type="button" className="text-xs text-[var(--color-text-muted)] hover:underline" onClick={() => { setUseToken(false); setError(null); }}>
              Pick from the organization&apos;s GitHub instead
            </button>
          )}
          <div className="flex justify-between gap-2">
            {replacing
              ? <AdminButton type="button" variant="ghost" onClick={() => { setReplacing(false); setToken(""); setError(null); }}>Cancel</AdminButton>
              : <AdminButton type="button" variant="ghost" onClick={onContinue}>Skip</AdminButton>}
            <AdminButton type="submit" isLoading={saving}>{replacing ? "Verify & replace token" : "Verify & save"}</AdminButton>
          </div>
        </form>
      )}
    </Panel>
  );
}

function PeopleStep({ draft, options, saving, onSave }: {
  draft: DraftViewDto; options: SetupOptionsDto; saving: boolean; onSave: (body: Record<string, unknown>) => void;
}) {
  const team = draft.mode === "TEAM";
  const [lead, setLead] = useState(draft.team_lead_membership_id ?? "");
  const [developers, setDevelopers] = useState<string[]>(draft.developer_membership_ids);
  const [qa, setQa] = useState<string[]>(draft.qa_membership_ids);
  return (
    <Panel title="People (optional)" icon={Users} description="Members of this organization only. Owners and admins are never listed.">
      {options.people.length === 0 ? (
        <EmptyStateView icon={Users} title="No assignable members" description="Invite developers, team leads or QA from Members first." />
      ) : (
        <div className="space-y-4">
          {team && <PeoplePicker label="Team Lead" people={options.people} selected={lead ? [lead] : []} single onChange={(ids) => setLead(ids[0] ?? "")} />}
          <PeoplePicker label={team ? "Developers" : "Developer"} people={options.people} selected={team ? developers : developers.slice(0, 1)}
            single={!team} onChange={setDevelopers} />
          {team && <PeoplePicker label="QA" people={options.people} selected={qa} onChange={setQa} />}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <AdminButton isLoading={saving} onClick={() => onSave({
          team_lead_membership_id: team ? lead || null : null,
          developer_membership_ids: team ? developers : developers.slice(0, 1),
          qa_membership_ids: team ? qa : [],
        })}>Save & continue</AdminButton>
      </div>
    </Panel>
  );
}

function ApproversStep({ draft, options, saving, onSave }: {
  draft: DraftViewDto; options: SetupOptionsDto; saving: boolean; onSave: (body: Record<string, unknown>) => void;
}) {
  const [selected, setSelected] = useState<string[]>(draft.approver_membership_ids);
  return (
    <Panel title="Approvers" icon={ShieldCheck}
      description="Who approves this project's work. They get approval rights for this project only. Nobody can approve their own task.">
      <PeoplePicker label="Approvers" people={options.people} selected={selected} onChange={setSelected} />
      {selected.length === 0 && (
        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">No approver chosen: the project&apos;s Project Manager reviews submissions.</p>
      )}
      <div className="mt-4 flex justify-end"><AdminButton isLoading={saving} onClick={() => onSave({ approver_membership_ids: selected })}>Save & continue</AdminButton></div>
    </Panel>
  );
}

function ReviewStep({ draft, options, paths }: { draft: DraftViewDto; options: SetupOptionsDto; paths: ReturnType<typeof createPaths> }) {
  const router = useRouter();
  const activate = useFlowMutation(() => apiClient.flow.drafts.activate(draft.id, draft.version));
  const discard = useFlowMutation(() => apiClient.flow.drafts.discard(draft.id, draft.version));
  const [error, setError] = useState<string | null>(null);
  const name = (id: string | null | undefined) => options.people.find((p) => p.membership_id === id)?.name ?? "—";
  const names = (ids: string[]) => ids.map(name).join(", ") || "None";
  const total = draft.tasks.reduce((sum, t) => sum + t.points, 0);
  const section = (step: DraftStep, title: string, body: React.ReactNode) => (
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold">{title}</h3>
        <Link href={paths.step(draft.id, step)} className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
          <Pencil className="w-3 h-3" aria-hidden="true" /> Edit
        </Link>
      </div>
      <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{body}</div>
    </div>
  );
  return (
    <Panel title="Review & create" icon={ClipboardList} description="Everything is checked again on the server and saved in one step.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="draft-review">
        {section("basics", "Basics", <>{draft.key} · {draft.name}<br />{draft.mode === "TEAM" ? "Team" : "Solo"} · {draft.start_on} → {draft.target_on}</>)}
        {section("documents", "Documents", draft.documents.length === 0 ? "None" : draft.documents.map((d) => d.name).join(", "))}
        {draft.mode === "TEAM" && section("plan", "Phases & tasks", <>{draft.phases.length} phases · {draft.tasks.length} tasks · {total} of at most 100 points</>)}
        {section("repository", "GitHub", draft.repository.connected ? (
          <>
            <a href={draft.repository.url ?? "#"} target="_blank" rel="noreferrer noopener" className="text-blue-600 dark:text-blue-400 hover:underline">
              {draft.repository.repository}
            </a>{" "}
            {draft.repository.provider === "GITHUB_APP"
              ? <>· branch <span className="font-mono">{draft.repository.branch}</span> · via {draft.repository.account}</>
              : <>· token …{draft.repository.token_last4}</>}
          </>
        ) : "Not connected")}
        {section("people", "People", draft.mode === "TEAM"
          ? <>Team Lead: {name(draft.team_lead_membership_id)}<br />Developers: {names(draft.developer_membership_ids)}<br />QA: {names(draft.qa_membership_ids)}</>
          : <>Developer: {names(draft.developer_membership_ids)}</>)}
        {section("approvers", "Approvers", names(draft.approver_membership_ids))}
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <AdminButton variant="outline" isLoading={discard.isPending} onClick={() => discard.mutate(undefined, {
          onSuccess: () => { toast.success("Draft discarded."); router.push(paths.start); },
          onError: (e) => setError(changeError(e)),
        })}><Trash2 className="w-3.5 h-3.5" /> Discard draft</AdminButton>
        <AdminButton isLoading={activate.isPending} onClick={() => activate.mutate(undefined, {
          onSuccess: (result) => { toast.success(`${result.project.key} created`); router.push(paths.project(result.project.id)); },
          onError: (e) => setError(changeError(e)),
        })}><CheckCircle2 className="w-3.5 h-3.5" /> Create project</AdminButton>
      </div>
    </Panel>
  );
}
