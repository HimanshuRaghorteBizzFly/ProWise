"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileUp,
  FolderPlus,
  ListChecks,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AdminButton, AdminInput, AdminSelect, AdminTextarea, Panel, StatusBadge } from "@/components/delivery/DeliveryUI";
import { changeError } from "@/components/developer/DevUI";
import { apiClient, newClientId } from "@/lib/api";
import type { FileViewDto, SetupOptionsDto, SetupPersonDto, SetupRequestDto, SetupResultDto } from "@/types/flow";
import { FileRow, RoleBadge, formatBytes } from "./FlowUI";
import { useFlowMutation, useUploadFile } from "./useFlowApi";

/**
 * Guided project setup (a page, not a popup): Basics -> Documents -> Phases & tasks (Team only) -> People ->
 * Approvers -> Review & create. Everything is saved in one server transaction; the server re-checks every rule
 * (dates, points total at most 100, who can be assigned, who can approve). People come from this organization only and
 * never include the Organization Owner or Admin.
 */

type Mode = "TEAM" | "SOLO";
type StepId = "basics" | "documents" | "plan" | "people" | "approvers" | "review";

interface PhaseRow { ref: string; name: string }
interface TaskRow { ref: string; title: string; description: string; phaseRef: string; points: string; dependsOnRef: string; assignee: string }

const STEP_LABEL: Record<StepId, string> = {
  basics: "Basics",
  documents: "Documents",
  plan: "Phases & tasks",
  people: "People",
  approvers: "Approvers",
  review: "Review & create",
};

const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif";

export function suggestKey(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const initials = words.length > 1 ? words.map((w) => w[0]).join("") : words[0];
  const key = initials.replace(/^[0-9]+/, "").slice(0, 6);
  return key.length >= 2 ? key : `${key}${words[0].slice(1, 3)}`.slice(0, 6);
}

let refCounter = 0;
const nextRef = (prefix: string) => `${prefix}${Date.now().toString(36)}${(refCounter++).toString(36)}`;

/** Sum of task points; NaN-safe (empty fields count as 0). */
export function totalPoints(tasks: { points: string | number }[]): number {
  return tasks.reduce((sum, t) => sum + (Number.isFinite(Number(t.points)) ? Number(t.points) : 0), 0);
}

/** Client-side checks per step (the server checks again). Returns the first problem, or null. */
export function stepProblem(step: StepId, state: {
  mode: Mode; name: string; key: string; startOn: string; targetOn: string; today: string;
  phases: PhaseRow[]; tasks: TaskRow[]; developers: string[];
}): string | null {
  if (step === "basics") {
    if (!state.name.trim()) return "Enter a project name.";
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(state.key)) return "The key needs 2 to 10 capital letters or digits and must start with a letter.";
    if (!state.startOn) return "Choose a start date.";
    if (state.startOn < state.today) return "The start date must be today or later.";
    if (!state.targetOn) return "Choose an end date.";
    if (state.targetOn < state.startOn) return "The end date must be on or after the start date.";
  }
  if (step === "plan" && state.mode === "TEAM") {
    if (state.phases.some((p) => !p.name.trim())) return "Every phase needs a name.";
    if (state.tasks.length > 0 && state.phases.length === 0) return "Add a phase for the tasks.";
    for (const t of state.tasks) {
      if (!t.title.trim()) return "Every task needs a title.";
      if (!t.phaseRef) return `Choose a phase for "${t.title}".`;
      const points = Number(t.points);
      if (!Number.isInteger(points) || points < 1 || points > 100) return `"${t.title}" needs whole points from 1 to 100.`;
    }
    if (totalPoints(state.tasks) > 100) return `Task points total ${totalPoints(state.tasks)}. The total may not be above 100.`;
  }
  return null;
}

export function ProjectSetupWizard({ orgId, options, onCreated, cancel }: {
  orgId: string;
  options: SetupOptionsDto;
  onCreated: (result: SetupResultDto) => void;
  cancel: React.ReactNode;
}) {
  const [step, setStep] = useState<StepId>("basics");
  const [mode, setMode] = useState<Mode>("TEAM");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [startOn, setStartOn] = useState(options.today);
  const [targetOn, setTargetOn] = useState("");
  const [documents, setDocuments] = useState<FileViewDto[]>([]);
  const [phases, setPhases] = useState<PhaseRow[]>([{ ref: nextRef("p"), name: "" }]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [teamLead, setTeamLead] = useState("");
  const [developers, setDevelopers] = useState<string[]>([]);
  const [qa, setQa] = useState<string[]>([]);
  const [approvers, setApprovers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(newClientId());

  const upload = useUploadFile(orgId);
  const create = useFlowMutation((body: SetupRequestDto) => apiClient.flow.createProject(orgId, body, idempotencyKey.current));

  const steps: StepId[] = mode === "TEAM"
    ? ["basics", "documents", "plan", "people", "approvers", "review"]
    : ["basics", "documents", "people", "approvers", "review"];
  const index = steps.indexOf(step);
  const total = totalPoints(tasks);
  const state = { mode, name, key, startOn, targetOn, today: options.today, phases, tasks, developers };
  const person = (membershipId: string) => options.people.find((p) => p.membership_id === membershipId);

  const go = (target: StepId) => {
    // Moving forward checks every step on the way; moving back is always allowed.
    if (steps.indexOf(target) > index) {
      for (const s of steps.slice(0, steps.indexOf(target))) {
        const problem = stepProblem(s, state);
        if (problem) {
          setError(problem);
          setStep(s);
          return;
        }
      }
    }
    setError(null);
    setStep(target);
  };

  const submit = () => {
    for (const s of steps) {
      const problem = stepProblem(s, state);
      if (problem) return go(s);
    }
    const body: SetupRequestDto = {
      name: name.trim(),
      key,
      description: description.trim() || null,
      mode,
      start_on: startOn,
      target_on: targetOn,
      timezone: options.default_timezone,
      team_lead_membership_id: mode === "TEAM" ? teamLead || null : null,
      developer_membership_ids: mode === "SOLO" ? developers.slice(0, 1) : developers,
      qa_membership_ids: mode === "TEAM" ? qa : [],
      approver_membership_ids: approvers,
      document_file_ids: documents.map((d) => d.id),
      phases: mode === "TEAM" ? phases.map((p) => ({ ref: p.ref, name: p.name.trim() })) : [],
      tasks: mode === "TEAM" ? tasks.map((t) => ({
        ref: t.ref,
        title: t.title.trim(),
        description: t.description.trim() || null,
        phase_ref: t.phaseRef,
        points: Number(t.points),
        depends_on_ref: t.dependsOnRef || null,
        assignee_membership_id: t.assignee || null,
      })) : [],
    };
    setError(null);
    create.mutate(body, {
      onSuccess: (result) => {
        toast.success(`${result.project.key} created`);
        onCreated(result);
      },
      onError: (failure) => {
        idempotencyKey.current = newClientId();
        setError(changeError(failure));
      },
    });
  };

  const addDocuments = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > options.limits.document_max_bytes) {
        toast.error(`${file.name} is larger than ${formatBytes(options.limits.document_max_bytes)}.`);
        return;
      }
      upload.mutate({ file, kind: "PROJECT_DOCUMENT" }, {
        onSuccess: (saved) => setDocuments((rows) => [...rows, saved]),
        onError: (failure) => toast.error(`${file.name}: ${changeError(failure)}`),
      });
    });
  };

  const removeDocument = (file: FileViewDto) => {
    setDocuments((rows) => rows.filter((d) => d.id !== file.id));
    apiClient.flow.discardFile(file.id).catch(() => undefined);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-5 items-start">
      <nav aria-label="Setup steps" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
        <ol className="flex xl:flex-col gap-1 overflow-x-auto">
          {steps.map((s, i) => (
            <li key={s} className="shrink-0">
              <button type="button" onClick={() => go(s)} aria-current={s === step ? "step" : undefined}
                className={`w-full text-left rounded-lg px-3 py-2 text-xs font-medium transition-colors ${s === step
                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"}`}>
                <span className="mr-1.5 tabular-nums text-[var(--color-text-muted)]">{i + 1}.</span>{STEP_LABEL[s]}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-4 min-w-0">
        {step === "basics" && (
          <Panel title="Basics" icon={FolderPlus} description="The delivery mode is chosen here and changes later only through an approved transition.">
            <div className="space-y-3">
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
                <legend className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">Delivery mode</legend>
                {(["TEAM", "SOLO"] as Mode[]).map((value) => (
                  <label key={value} className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] p-3 cursor-pointer has-[:checked]:border-blue-500">
                    <input type="radio" name="mode" checked={mode === value} onChange={() => setMode(value)} />
                    <span>
                      <b>{value === "TEAM" ? "Team · Structured Delivery" : "Solo · Individual Ownership"}</b>
                      <span className="block text-[var(--color-text-muted)]">
                        {value === "TEAM"
                          ? "Phases and tasks with points (total at most 100). Progress = approved points / total points."
                          : "One developer submits work with a reported %; an approver approves it. No phases or tasks."}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AdminInput label="Start date" type="date" value={startOn} min={options.today} onChange={(e) => setStartOn(e.target.value)} />
                <AdminInput label="End date" type="date" value={targetOn} min={startOn || options.today} onChange={(e) => setTargetOn(e.target.value)} />
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
                <CalendarDays className="w-3 h-3" aria-hidden="true" /> Calendar days in {options.default_timezone}. Start today or later.
              </p>
            </div>
          </Panel>
        )}

        {step === "documents" && (
          <Panel title="Project documents" icon={FileUp}
            description={`PDF, Word, Excel, PowerPoint, text or images, up to ${formatBytes(options.limits.document_max_bytes)} each. Optional.`}>
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--color-border)] p-6 text-xs cursor-pointer hover:bg-[var(--color-hover)]">
                <FileUp className="w-5 h-5 text-[var(--color-text-muted)]" aria-hidden="true" />
                <span className="font-medium">Choose files</span>
                <span className="text-[var(--color-text-muted)]">They are attached to the project when you create it.</span>
                <input type="file" multiple accept={DOCUMENT_ACCEPT} className="sr-only" aria-label="Upload project documents"
                  onChange={(e) => { addDocuments(e.target.files); e.target.value = ""; }} />
              </label>
              {upload.isPending && <p className="text-xs text-[var(--color-text-muted)]" role="status">Uploading…</p>}
              {documents.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">No documents yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {documents.map((d) => <FileRow key={d.id} file={d} onRemove={() => removeDocument(d)} />)}
                </ul>
              )}
            </div>
          </Panel>
        )}

        {step === "plan" && mode === "TEAM" && (
          <PlanStep phases={phases} setPhases={setPhases} tasks={tasks} setTasks={setTasks} total={total}
            developers={developers.map((id) => person(id)).filter((p): p is SetupPersonDto => !!p)} />
        )}

        {step === "people" && (
          <Panel title="People" icon={Users}
            description="Members of this organization only. Every role is optional. Organization owners and admins are never listed.">
            {options.people.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">No assignable members yet. Invite people from Members first.</p>
            ) : mode === "TEAM" ? (
              <div className="space-y-4">
                <PeoplePicker label="Team Lead" people={options.people} selected={teamLead ? [teamLead] : []} single
                  onChange={(ids) => setTeamLead(ids[0] ?? "")} />
                <PeoplePicker label="Developers" people={options.people} selected={developers} onChange={(ids) => {
                  setDevelopers(ids);
                  // A task can only be assigned to one of the chosen developers.
                  setTasks((rows) => rows.map((t) => (t.assignee && !ids.includes(t.assignee) ? { ...t, assignee: "" } : t)));
                }} />
                <PeoplePicker label="QA" people={options.people} selected={qa} onChange={setQa} />
                {tasks.length > 0 && developers.length > 1 && (
                  <fieldset className="space-y-1.5">
                    <legend className="text-xs font-medium text-[var(--color-text-secondary)]">Task assignments</legend>
                    <ul className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                      {tasks.map((t, i) => (
                        <li key={t.ref} className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-2 items-center px-3 py-2 text-xs">
                          <span className="truncate">{t.title || `Task ${i + 1}`} · {t.points || 0} pts</span>
                          <AdminSelect aria-label={`Assignee for ${t.title || `task ${i + 1}`}`} value={t.assignee}
                            onChange={(e) => setTasks((rows) => rows.map((r) => (r.ref === t.ref ? { ...r, assignee: e.target.value } : r)))}>
                            <option value="">Unassigned</option>
                            {developers.map((id) => <option key={id} value={id}>{person(id)?.name ?? id}</option>)}
                          </AdminSelect>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                )}
              </div>
            ) : (
              <PeoplePicker label="Developer" people={options.people} selected={developers.slice(0, 1)} single
                onChange={(ids) => setDevelopers(ids)} />
            )}
          </Panel>
        )}

        {step === "approvers" && (
          <Panel title="Approvers" icon={ShieldCheck}
            description="Who approves this project's work: Team Lead, QA or any member. They get approval rights for this project only. Nobody approves their own work.">
            <PeoplePicker label="Approvers" people={options.people} selected={approvers} onChange={setApprovers} />
            {approvers.length === 0 && (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                Without an approver, submitted work waits until someone with project edit rights adds one.
              </p>
            )}
          </Panel>
        )}

        {step === "review" && (
          <Panel title="Review & create" icon={ClipboardList} description="Saved in one step with a full audit trail.">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Summary label="Project" value={`${key || "—"} · ${name || "—"}`} />
              <Summary label="Mode" value={mode === "TEAM" ? "Team (Structured Delivery)" : "Solo (Individual Ownership)"} />
              <Summary label="Dates" value={`${startOn || "—"} → ${targetOn || "—"}`} />
              <Summary label="Documents" value={documents.length} />
              {mode === "TEAM" && <Summary label="Phases / tasks" value={`${phases.length} / ${tasks.length}`} />}
              {mode === "TEAM" && <Summary label="Task points" value={`${total} of at most 100`} />}
              {mode === "TEAM" && <Summary label="Team Lead" value={person(teamLead)?.name ?? "None"} />}
              <Summary label={mode === "TEAM" ? "Developers" : "Developer"} value={names(developers, person) || "None"} />
              {mode === "TEAM" && <Summary label="QA" value={names(qa, person) || "None"} />}
              <Summary label="Approvers" value={names(approvers, person) || "None"} />
            </dl>
            <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
              Progress starts as Not reported. {mode === "TEAM"
                ? "It becomes approved points / total points as approvers approve tasks."
                : "It becomes the percentage of the developer's latest approved submission."}
            </p>
          </Panel>
        )}

        {error && <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>{cancel}</div>
          <div className="flex gap-2">
            {index > 0 && <AdminButton variant="outline" onClick={() => go(steps[index - 1])}>Back</AdminButton>}
            {step !== "review" ? (
              <AdminButton onClick={() => go(steps[index + 1])} disabled={step === "plan" && total > 100}>Next</AdminButton>
            ) : (
              <AdminButton onClick={submit} isLoading={create.isPending}><CheckCircle2 className="w-3.5 h-3.5" /> Create project</AdminButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function names(ids: string[], person: (id: string) => SetupPersonDto | undefined) {
  return ids.map((id) => person(id)?.name).filter(Boolean).join(", ");
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-0.5 font-medium break-words">{value}</dd>
    </div>
  );
}

/** A people list with name, role and current workload; checkboxes (or radios for a single choice). */
export function PeoplePicker({ label, people, selected, onChange, single = false }: {
  label: string;
  people: SetupPersonDto[];
  selected: string[];
  onChange: (ids: string[]) => void;
  single?: boolean;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? people.filter((p) => `${p.name} ${p.email} ${p.role}`.toLowerCase().includes(q)) : people;
  }, [people, query]);
  const groupName = `picker-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-[var(--color-text-secondary)]">
        {label}{single ? " (one)" : ""} <span className="text-[var(--color-text-muted)]">· {selected.length} chosen</span>
      </legend>
      {people.length > 6 && (
        <AdminInput aria-label={`Search ${label}`} placeholder="Search by name, email or role" value={query} onChange={(e) => setQuery(e.target.value)} />
      )}
      <ul className="max-h-60 overflow-y-auto rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        {single && (
          <li>
            <label className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer">
              <input type="radio" name={groupName} checked={selected.length === 0} onChange={() => onChange([])} />
              <span className="text-[var(--color-text-muted)]">Nobody yet</span>
            </label>
          </li>
        )}
        {shown.map((p) => {
          const checked = selected.includes(p.membership_id);
          return (
            <li key={p.membership_id}>
              <label className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs cursor-pointer">
                <input type={single ? "radio" : "checkbox"} name={single ? groupName : undefined} checked={checked}
                  onChange={() => onChange(single ? [p.membership_id]
                    : checked ? selected.filter((id) => id !== p.membership_id) : [...selected, p.membership_id])} />
                <span className="font-medium">{p.name}</span>
                <RoleBadge role={p.role} />
                <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                  {p.open_tasks} open task{p.open_tasks === 1 ? "" : "s"} · {p.active_projects} project{p.active_projects === 1 ? "" : "s"}
                </span>
              </label>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-3 py-2 text-xs text-[var(--color-text-muted)]">No one matches.</li>}
      </ul>
    </fieldset>
  );
}

function PlanStep({ phases, setPhases, tasks, setTasks, total, developers }: {
  phases: PhaseRow[];
  setPhases: React.Dispatch<React.SetStateAction<PhaseRow[]>>;
  tasks: TaskRow[];
  setTasks: React.Dispatch<React.SetStateAction<TaskRow[]>>;
  total: number;
  developers: SetupPersonDto[];
}) {
  const updateTask = (ref: string, patch: Partial<TaskRow>) =>
    setTasks((rows) => rows.map((t) => (t.ref === ref ? { ...t, ...patch } : t)));
  const over = total > 100;
  return (
    <>
      <Panel title="Phases" icon={ListChecks} description="Phases group tasks and carry no points.">
        <div className="space-y-2">
          {phases.map((phase, i) => (
            <div key={phase.ref} className="flex items-end gap-2">
              <AdminInput label={i === 0 ? "Phase name" : undefined} aria-label={`Phase ${i + 1} name`} value={phase.name} maxLength={255}
                placeholder={`Phase ${i + 1}`}
                onChange={(e) => setPhases((rows) => rows.map((p) => (p.ref === phase.ref ? { ...p, name: e.target.value } : p)))} />
              <AdminButton type="button" variant="ghost" aria-label={`Remove phase ${i + 1}`}
                disabled={tasks.some((t) => t.phaseRef === phase.ref)}
                title={tasks.some((t) => t.phaseRef === phase.ref) ? "Move or remove its tasks first" : undefined}
                onClick={() => setPhases((rows) => rows.filter((p) => p.ref !== phase.ref))}>
                <Trash2 className="w-3.5 h-3.5" />
              </AdminButton>
            </div>
          ))}
          <AdminButton type="button" size="xs" variant="outline" onClick={() => setPhases((rows) => [...rows, { ref: nextRef("p"), name: "" }])}>
            <Plus className="w-3 h-3" /> Add phase
          </AdminButton>
        </div>
      </Panel>

      <Panel title="Tasks" icon={ClipboardList}
        description="Each task has a title, a phase, points and an optional dependency. The total may be below 100, never above."
        action={<StatusBadge label={`${total} / 100 points`} tone={over ? "danger" : total === 100 ? "success" : "info"} />}>
        <div className="space-y-3">
          <div aria-live="polite" className={`text-xs font-semibold ${over ? "text-rose-600 dark:text-rose-400" : "text-[var(--color-text-secondary)]"}`}
            data-testid="points-total">
            Running total: {total} of 100{over ? " — above the limit, remove points to continue" : ""}
          </div>
          {tasks.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">No tasks yet.</p>}
          {tasks.map((task, i) => (
            <div key={task.ref} className="rounded-lg border border-[var(--color-border)] p-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_100px] gap-2">
                <AdminInput label="Title" aria-label={`Task ${i + 1} title`} value={task.title} maxLength={255}
                  onChange={(e) => updateTask(task.ref, { title: e.target.value })} />
                <AdminSelect label="Phase" aria-label={`Task ${i + 1} phase`} value={task.phaseRef}
                  onChange={(e) => updateTask(task.ref, { phaseRef: e.target.value })}>
                  <option value="">Choose…</option>
                  {phases.map((p, pi) => <option key={p.ref} value={p.ref}>{p.name || `Phase ${pi + 1}`}</option>)}
                </AdminSelect>
                <AdminInput label="Points" aria-label={`Task ${i + 1} points`} type="number" min={1} max={100} step={1} value={task.points}
                  onChange={(e) => updateTask(task.ref, { points: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <AdminSelect label="Depends on (optional)" aria-label={`Task ${i + 1} dependency`} value={task.dependsOnRef}
                  onChange={(e) => updateTask(task.ref, { dependsOnRef: e.target.value })}>
                  <option value="">No dependency</option>
                  {tasks.filter((t) => t.ref !== task.ref).map((t) => (
                    <option key={t.ref} value={t.ref}>{t.title || "Untitled task"}</option>
                  ))}
                </AdminSelect>
                <AdminSelect label="Assignee (a developer, optional)" aria-label={`Task ${i + 1} assignee`} value={task.assignee}
                  onChange={(e) => updateTask(task.ref, { assignee: e.target.value })}>
                  <option value="">{developers.length === 1 ? `${developers[0].name} (the only developer)` : "Unassigned"}</option>
                  {developers.map((d) => <option key={d.membership_id} value={d.membership_id}>{d.name}</option>)}
                </AdminSelect>
              </div>
              <AdminTextarea label="Description (optional)" rows={2} maxLength={10000} value={task.description}
                onChange={(e) => updateTask(task.ref, { description: e.target.value })} />
              <div className="flex justify-end">
                <AdminButton type="button" size="xs" variant="ghost" onClick={() => setTasks((rows) => rows
                  .filter((t) => t.ref !== task.ref)
                  .map((t) => (t.dependsOnRef === task.ref ? { ...t, dependsOnRef: "" } : t)))}>
                  <Trash2 className="w-3 h-3" /> Remove task
                </AdminButton>
              </div>
            </div>
          ))}
          <AdminButton type="button" size="xs" variant="outline" disabled={phases.length === 0}
            onClick={() => setTasks((rows) => [...rows, {
              ref: nextRef("t"), title: "", description: "", phaseRef: phases[phases.length - 1]?.ref ?? "",
              points: "", dependsOnRef: "", assignee: "",
            }])}>
            <Plus className="w-3 h-3" /> Add task
          </AdminButton>
          {developers.length === 0 && (
            <p className="text-[11px] text-[var(--color-text-muted)]">Choose developers in the People step to assign tasks.</p>
          )}
        </div>
      </Panel>
    </>
  );
}
