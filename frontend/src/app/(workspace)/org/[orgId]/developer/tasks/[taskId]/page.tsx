"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardCheck, GitBranch, History, Link2, Play, Plus, Send, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PanelLayout } from "@/components/layouts/panel-layout";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  EmptyStateView,
  PageFrame,
  Panel,
  StatPill,
  StatusBadge,
} from "@/components/delivery/DeliveryUI";
import { DecisionBadge, DevGate, SectionGate, WorkStateBadge, changeError, dateText, dateTimeText, isOverdue } from "@/components/developer/DevUI";
import {
  useDependencies,
  useItemBlockers,
  useMe,
  useReviewHistory,
  useWorkItem,
  useWorkflowActions,
} from "@/components/developer/useDeveloperData";
import type { EvidenceItemDto, WorkItemDto } from "@/types/work";

/**
 * One Structured work item for the developer: Assignment → Development (start) → Evidence → Review → Changes /
 * Accepted. The server enforces every rule (assignee only, criteria required, expectedVersion, no self-review); this
 * page only offers the actions that apply and shows the server's answer.
 */
export default function DeveloperTaskDetailPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const taskId = (params?.taskId as string) || "";
  const base = `/org/${orgId}/developer`;
  const item = useWorkItem(taskId);

  return (
    <PanelLayout title="Task">
      <DevGate state={item} what="This task" back={{ href: `${base}/tasks`, label: "Back to my tasks" }} skeleton="detail">
        {(w) => <TaskDetail item={w} base={base} />}
      </DevGate>
    </PanelLayout>
  );
}

function TaskDetail({ item, base }: { item: WorkItemDto; base: string }) {
  const me = useMe();
  const myId = me.kind === "ready" ? me.data.id : null;
  const isAssignee = !!myId && item.primary_assignee?.user_id === myId;
  const actions = useWorkflowActions(item);

  const start = () =>
    actions.start.mutate(item.version, {
      onSuccess: () => toast.success("Work started."),
      onError: (e) => toast.error(changeError(e)),
    });

  return (
    <PageFrame
      crumbs={[
        { label: "Developer", href: `${base}/dashboard` },
        { label: "My Tasks", href: `${base}/tasks` },
        { label: item.key },
      ]}
      back={{ href: `${base}/tasks`, label: "Back to my tasks" }}
      title={`${item.key} · ${item.title}`}
      description={item.description ?? undefined}
      actions={
        isAssignee && item.state === "TODO" && item.plan_status !== "RETIRED" ? (
          <AdminButton size="sm" onClick={start} isLoading={actions.start.isPending}>
            <Play className="w-3.5 h-3.5 mr-1" /> Start work
          </AdminButton>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <WorkStateBadge state={item.state} blocked={item.blocked} />
        <StatusBadge label={item.type} tone="neutral" />
        {item.dependency_flag && <StatusBadge label="A prerequisite was reopened: credit suspended" tone="warning" />}
        {item.plan_status === "RETIRED" && <StatusBadge label="Retired" tone="danger" />}
        <Link href={`${base}/projects/${item.project_id}/structured`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
          Open project
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatPill label="Due" value={item.due_on ? dateText(item.due_on) : "No date"} tone={isOverdue(item.due_on, item.state) ? "danger" : "neutral"} />
        <StatPill label="Weight" value={item.weight === null ? "Not set" : `${item.weight}${item.weight_unit ? ` ${item.weight_unit.toLowerCase()}` : ""}`} />
        <StatPill label="Revision" value={item.revision} />
        <StatPill label="Review" value={item.review_required ? "Required" : "Checks only"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Panel title="Acceptance criteria" description={`Version ${item.criteria_version}`} icon={ClipboardCheck} iconTone="emerald">
            {item.criteria ? (
              <p className="text-sm whitespace-pre-wrap">{item.criteria}</p>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">
                No acceptance criteria yet. Work cannot be submitted until your project manager adds them.
              </p>
            )}
          </Panel>

          {isAssignee && (item.state === "IN_PROGRESS" || item.state === "IN_REVIEW") && <SubmitPanel item={item} />}

          <ReviewHistoryPanel itemId={item.id} />
        </div>

        <div className="space-y-5">
          <Panel title="People" icon={CheckCircle2} iconTone="blue">
            <dl className="text-xs space-y-2">
              <div><dt className="text-[var(--color-text-muted)]">Primary assignee</dt><dd className="font-medium">{item.primary_assignee?.email ?? "Unassigned"}</dd></div>
              <div><dt className="text-[var(--color-text-muted)]">Reviewer</dt><dd className="font-medium">{item.reviewer?.email ?? "None"}</dd></div>
              {item.collaborators.length > 0 && (
                <div><dt className="text-[var(--color-text-muted)]">Collaborators</dt><dd>{item.collaborators.map((c) => c.email).join(", ")}</dd></div>
              )}
            </dl>
            <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">Weights change only through an approved scope version.</p>
          </Panel>
          <DependenciesPanel itemId={item.id} base={base} />
          <BlockersPanel item={item} isAssignee={isAssignee} />
        </div>
      </div>
    </PageFrame>
  );
}

/* ------------------------------------------------------------------ submit evidence */

const EVIDENCE_TYPES = ["PULL_REQUEST", "COMMIT", "LINK", "FILE", "NOTE"] as const;

function SubmitPanel({ item }: { item: WorkItemDto }) {
  const { submit } = useWorkflowActions(item);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<EvidenceItemDto[]>([{ type: "PULL_REQUEST", ref: "", label: "" }]);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<EvidenceItemDto>) =>
    setEvidence((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const rows = evidence.filter((r) => r.ref.trim() || (r.label ?? "").trim());
    if (rows.length === 0) return setError("Add at least one piece of evidence (pull request, commit, link, file or note).");
    if (rows.some((r) => !r.ref.trim())) return setError("Each evidence item needs a link or reference.");
    if (rows.some((r) => r.ref.trim().length > 500)) return setError("A reference is at most 500 characters.");
    if (note.length > 2000) return setError("The note is at most 2000 characters.");
    setError(null);
    submit.mutate(
      {
        expected_version: item.version,
        note: note.trim() || undefined,
        evidence: rows.map((r) => ({ type: r.type, ref: r.ref.trim(), label: r.label?.trim() || null })),
      },
      {
        onSuccess: (saved) => {
          toast.success(saved.state === "DONE" ? "Submitted: all checks passed, the work is done." : "Submitted for review.");
          setNote("");
          setEvidence([{ type: "PULL_REQUEST", ref: "", label: "" }]);
        },
        onError: (err) => setError(changeError(err)),
      },
    );
  };

  return (
    <Panel
      title={item.state === "IN_REVIEW" ? "Submit a new revision" : "Submit for review"}
      description={item.state === "IN_REVIEW"
        ? "A new revision replaces the one waiting for review."
        : item.review_required ? "Your reviewer decides: accepted or changes requested." : "Done when every required check passes."}
      icon={Send}
      iconTone="violet"
    >
      <form onSubmit={send} className="space-y-3" noValidate>
        {evidence.map((row, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[140px_1fr_1fr_auto] gap-2 items-end">
            <AdminSelect
              aria-label="Evidence type"
              value={row.type}
              onChange={(e) => update(i, { type: e.target.value })}
              options={EVIDENCE_TYPES.map((t) => ({ value: t, label: t.replace("_", " ").toLowerCase() }))}
            />
            <AdminInput aria-label="Link or reference" placeholder="https://… or commit SHA" value={row.ref} onChange={(e) => update(i, { ref: e.target.value })} />
            <AdminInput aria-label="Label" placeholder="Label (optional)" value={row.label ?? ""} onChange={(e) => update(i, { label: e.target.value })} />
            <AdminButton type="button" variant="ghost" size="sm" aria-label="Remove evidence"
              disabled={evidence.length === 1} onClick={() => setEvidence((rows) => rows.filter((_, idx) => idx !== i))}>
              <Trash2 className="w-3.5 h-3.5" />
            </AdminButton>
          </div>
        ))}
        {evidence.length < 20 && (
          <AdminButton type="button" variant="outline" size="xs" onClick={() => setEvidence((rows) => [...rows, { type: "LINK", ref: "", label: "" }])}>
            <Plus className="w-3 h-3 mr-1" /> Add evidence
          </AdminButton>
        )}
        <AdminTextarea label="Note for the reviewer" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <AdminButton type="submit" isLoading={submit.isPending} disabled={!item.criteria}>
          <Send className="w-3.5 h-3.5 mr-1" /> Submit
        </AdminButton>
        {!item.criteria && <p className="text-[11px] text-[var(--color-text-muted)]">Waiting for acceptance criteria.</p>}
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------ review history */

function ReviewHistoryPanel({ itemId }: { itemId: string }) {
  const history = useReviewHistory(itemId);
  return (
    <Panel title="Review history" description="Submissions, decisions, checks and reopen events" icon={History} iconTone="amber">
      <SectionGate state={history} what="review history">
        {(h) => (
          <div className="space-y-4">
            {h.checks.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">Required checks</p>
                <ul className="space-y-1">
                  {h.checks.map((c) => (
                    <li key={c.key} className="flex items-center gap-2 text-xs">
                      {c.satisfied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />}
                      <span>{c.label}</span>
                      {c.satisfied_at && <span className="text-[var(--color-text-muted)]">· {dateTimeText(c.satisfied_at)}</span>}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">A planner or reviewer marks checks; you cannot mark your own.</p>
              </div>
            )}
            {h.submissions.length === 0 && h.reviews.length === 0 && h.reopen_events.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">Nothing submitted yet.</p>
            ) : (
              <ol className="space-y-3">
                {h.reviews.map((r) => (
                  <li key={r.id} className="rounded-lg border border-[var(--color-border)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">Revision {r.revision} reviewed</span>
                      <DecisionBadge decision={r.decision} />
                    </div>
                    {r.reason && <p className="text-xs mt-1 whitespace-pre-wrap">{r.reason}</p>}
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{r.reviewer_email ?? "Reviewer"} · {dateTimeText(r.decided_at)}</p>
                  </li>
                ))}
                {h.submissions.map((s) => (
                  <li key={s.id} className="rounded-lg border border-[var(--color-border)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">Revision {s.revision} submitted</span>
                      <StatusBadge label={s.status.toLowerCase()} tone={s.status === "SUPERSEDED" ? "neutral" : "info"} />
                    </div>
                    {s.note && <p className="text-xs mt-1 whitespace-pre-wrap">{s.note}</p>}
                    {(s.evidence ?? []).length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {(s.evidence ?? []).map((ev, i) => (
                          <li key={i} className="text-xs flex items-center gap-1.5 min-w-0">
                            <Link2 className="w-3 h-3 shrink-0 text-[var(--color-text-muted)]" />
                            <span className="text-[10px] uppercase text-[var(--color-text-muted)]">{ev.type}</span>
                            {/^https?:\/\//.test(ev.ref) ? (
                              <a href={ev.ref} target="_blank" rel="noreferrer noopener" className="text-blue-600 dark:text-blue-400 hover:underline truncate">{ev.label || ev.ref}</a>
                            ) : (
                              <span className="truncate">{ev.label ? `${ev.label}: ` : ""}{ev.ref}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{s.submitted_by_email ?? "Developer"} · {dateTimeText(s.submitted_at)} · criteria v{s.criteria_version}</p>
                  </li>
                ))}
                {h.reopen_events.map((r, i) => (
                  <li key={`reopen-${i}`} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="text-xs font-semibold">Reopened{r.superseded_revision ? ` (revision ${r.superseded_revision} no longer accepted)` : ""}</p>
                    <p className="text-xs mt-1">{r.reason}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{r.actor_email ?? "Planner"} · {dateTimeText(r.occurred_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </SectionGate>
    </Panel>
  );
}

/* ------------------------------------------------------------------ dependencies */

function DependenciesPanel({ itemId, base }: { itemId: string; base: string }) {
  const deps = useDependencies(itemId);
  return (
    <Panel title="Dependencies" icon={GitBranch} iconTone="violet">
      <SectionGate state={deps} what="dependencies">
        {(d) =>
          d.blocked_by.length === 0 && d.blocks.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No dependencies.</p>
          ) : (
            <div className="space-y-3 text-xs">
              {d.blocked_by.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Waits for</p>
                  <ul className="space-y-1">
                    {d.blocked_by.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2">
                        <Link href={`${base}/tasks/${l.predecessor_id}`} className="truncate hover:underline">
                          <span className="font-mono text-blue-600 dark:text-blue-400">{l.predecessor_key}</span> {l.predecessor_title}
                        </Link>
                        <WorkStateBadge state={l.predecessor_state} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {d.blocks.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Needed by</p>
                  <ul className="space-y-1">
                    {d.blocks.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2">
                        <Link href={`${base}/tasks/${l.successor_id}`} className="truncate hover:underline">
                          <span className="font-mono text-blue-600 dark:text-blue-400">{l.successor_key}</span> {l.successor_title}
                        </Link>
                        <WorkStateBadge state={l.successor_state} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Done work earns progress only while every prerequisite is done; a reopened prerequisite suspends the credit.
              </p>
            </div>
          )
        }
      </SectionGate>
    </Panel>
  );
}

/* ------------------------------------------------------------------ blockers */

function BlockersPanel({ item, isAssignee }: { item: WorkItemDto; isAssignee: boolean }) {
  const blockers = useItemBlockers(item.id);
  const { raiseBlocker, resolveBlocker } = useWorkflowActions(item);
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<"NORMAL" | "CRITICAL">("NORMAL");
  const [error, setError] = useState<string | null>(null);
  const canRaise = isAssignee && item.state !== "DONE" && item.state !== "CANCELLED" && item.plan_status !== "RETIRED";

  const raise = (e: React.FormEvent) => {
    e.preventDefault();
    const text = reason.trim();
    if (!text) return setError("Describe what is blocking the work.");
    if (text.length > 2000) return setError("At most 2000 characters.");
    setError(null);
    raiseBlocker.mutate(
      { reason: text, severity },
      {
        onSuccess: () => {
          toast.success("Blocker raised. The task state does not change.");
          setReason("");
          setSeverity("NORMAL");
        },
        onError: (err) => setError(changeError(err)),
      },
    );
  };

  return (
    <Panel title="Blockers" icon={AlertTriangle} iconTone="rose">
      <SectionGate state={blockers} what="blockers">
        {(rows) => (
          <div className="space-y-3">
            {rows.length === 0 ? (
              <EmptyStateView icon={CheckCircle2} title="No blockers" description="Nothing is blocking this task." />
            ) : (
              <ul className="space-y-2">
                {rows.map((b) => (
                  <li key={b.id} className="rounded-lg border border-[var(--color-border)] p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge label={b.resolved ? "Resolved" : b.severity === "CRITICAL" ? "Critical" : "Open"}
                        tone={b.resolved ? "success" : b.severity === "CRITICAL" ? "danger" : "warning"} />
                      <span className="text-[10px] text-[var(--color-text-muted)]">{b.age_hours}h</span>
                    </div>
                    <p className="mt-1">{b.reason}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Owner: {b.owner?.email ?? "—"} · {dateTimeText(b.opened_at)}</p>
                    {b.resolution && <p className="text-[11px] mt-1 text-[var(--color-text-secondary)]">Resolution: {b.resolution}</p>}
                    {!b.resolved && (
                      <AdminButton size="xs" variant="outline" className="mt-2" isLoading={resolveBlocker.isPending}
                        onClick={() => resolveBlocker.mutate({ id: b.id }, {
                          onSuccess: () => toast.success("Blocker cleared."),
                          onError: (err) => toast.error(changeError(err)),
                        })}>
                        Mark resolved
                      </AdminButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canRaise && (
              <form onSubmit={raise} className="space-y-2 border-t border-[var(--color-border)] pt-3" noValidate>
                <AdminTextarea label="Raise a blocker" rows={2} maxLength={2000} placeholder="What is stopping the work?"
                  value={reason} onChange={(e) => setReason(e.target.value)} />
                <AdminSelect aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value as "NORMAL" | "CRITICAL")}
                  options={[{ value: "NORMAL", label: "Normal" }, { value: "CRITICAL", label: "Critical" }]} />
                {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
                <AdminButton type="submit" size="sm" variant="danger" isLoading={raiseBlocker.isPending}>Raise blocker</AdminButton>
              </form>
            )}
          </div>
        )}
      </SectionGate>
    </Panel>
  );
}
