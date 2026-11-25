"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, FileSearch, GitBranch, History, Inbox, MessageSquareWarning, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AdminButton, AdminTextarea, EmptyStateView, PageFrame, Panel, StatPill, StatusBadge } from "@/components/delivery/DeliveryUI";
import { DecisionBadge, DevGate, SectionGate, changeError, dateTimeText } from "@/components/developer/DevUI";
import { useMe, useReviewHistory, useWorkItem } from "@/components/developer/useDeveloperData";
import { useProgressSummary } from "@/components/progress/useCheckInApi";
import { apiClient } from "@/lib/api";
import type { CheckInDto, PendingReviewDto } from "@/types/api";
import type { QueueItemDto } from "@/types/flow";
import type { WorkItemDto } from "@/types/work";
import { CommitList, EvidenceList } from "./FlowUI";
import { TaskActivity, TaskCommits } from "./TaskPanels";
import { flowKeys, useApprovers, useFlowMutation, useItemFiles, useProjectCommits, useReviewDecision, useReviewQueue } from "./useFlowApi";
import { useQuery } from "@tanstack/react-query";
import { toState } from "@/components/org-console/useRoleApi";

/**
 * Review for the people chosen as a project's approvers. The queue lists only work of projects where the caller
 * approves (server-side), never their own. A decision records the reviewer, time, reason and the evidence reviewed;
 * requesting changes needs a reason; approving a Team task counts its points, approving a Solo submission makes its
 * percentage the project's progress.
 */

export type ReviewPanel = "manager" | "lead" | "reviewer" | "developer" | "viewer";

const PANEL_LABEL: Record<ReviewPanel, string> = {
  manager: "Project Manager",
  lead: "Team Lead",
  reviewer: "QA",
  developer: "Developer",
  viewer: "Viewer",
};

export function reviewPaths(orgId: string, panel: ReviewPanel) {
  const home = `/org/${orgId}/${panel}`;
  const list = panel === "reviewer" ? `${home}/review-queue` : panel === "developer" || panel === "viewer" ? `${home}/approvals` : `${home}/reviews`;
  const detail = (ref: string) => panel === "reviewer" ? `${home}/reviews/${encodeURIComponent(ref)}` : `${list}/${encodeURIComponent(ref)}`;
  return { home, list, detail };
}

/* ================================================================== queue */

export function ReviewQueueView({ orgId, panel }: { orgId: string; panel: ReviewPanel }) {
  const paths = reviewPaths(orgId, panel);
  const queue = useReviewQueue();
  return (
    <PageFrame crumbs={[{ label: PANEL_LABEL[panel], href: paths.home }, { label: "Reviews" }]} title="Reviews"
      description="Work waiting for your decision, only from projects where you were chosen as an approver.">
      <DevGate state={queue} what="Your review queue" back={{ href: paths.home, label: "Back to dashboard" }}>
        {(items) => <ReviewQueueList items={items} detail={paths.detail} />}
      </DevGate>
    </PageFrame>
  );
}

export function ReviewQueueList({ items, detail }: { items: QueueItemDto[]; detail: (ref: string) => string }) {
  if (items.length === 0) {
    return <EmptyStateView icon={Inbox} title="Nothing to review" description="When a developer submits work in a project you approve, it appears here." />;
  }
  return (
    <ul className="space-y-2" data-testid="review-queue">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`}>
          <Link href={detail(item.review_ref)}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 hover:border-blue-500/50">
            <StatusBadge label={item.kind === "TASK" ? "Team task" : "Solo"} tone={item.kind === "TASK" ? "info" : "violet"} />
            <span className="text-xs font-semibold min-w-0">
              <span className="font-mono text-blue-600 dark:text-blue-400">{item.key}</span> · {item.title}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">{item.project.name}</span>
            <span className="ml-auto text-[11px] text-[var(--color-text-muted)]">
              {item.kind === "TASK" ? `${item.points ?? "—"} pts · round ${item.revision}` : `${Number(item.reported_percent)}% reported`}
              {" · "}{item.submitted_by ?? "Developer"} · {dateTimeText(item.submitted_at)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ================================================================== detail */

export function ReviewDetailView({ orgId, panel, reviewRef, context = "review" }: {
  orgId: string;
  panel: ReviewPanel;
  reviewRef: string;
  /** "task": opened as a task detail (e.g. from Progress) rather than from the review queue. */
  context?: "review" | "task";
}) {
  const ref = decodeURIComponent(reviewRef);
  return ref.startsWith("checkin-")
    ? <SoloReview orgId={orgId} panel={panel} checkinId={ref.slice("checkin-".length)} />
    : <TaskReview orgId={orgId} panel={panel} itemId={ref} context={context} />;
}

function TaskReview({ orgId, panel, itemId, context }: { orgId: string; panel: ReviewPanel; itemId: string; context: "review" | "task" }) {
  const paths = reviewPaths(orgId, panel);
  const item = useWorkItem(itemId);
  return (
    <DevGate state={item} what="This task" back={{ href: paths.list, label: "Back to reviews" }} skeleton="detail">
      {(w) => <TaskReviewContent item={w} panel={panel} paths={paths} context={context} />}
    </DevGate>
  );
}

function TaskReviewContent({ item, panel, paths, context }: {
  item: WorkItemDto; panel: ReviewPanel; paths: ReturnType<typeof reviewPaths>; context: "review" | "task";
}) {
  const progressHref = `${paths.home}/progress/${item.project_id}`;
  const crumbs = context === "task"
    ? [{ label: PANEL_LABEL[panel], href: paths.home }, { label: "Progress", href: `${paths.home}/progress` }, { label: item.key }]
    : [{ label: PANEL_LABEL[panel], href: paths.home }, { label: "Reviews", href: paths.list }, { label: item.key }];
  const back = context === "task" ? { href: progressHref, label: "Back to project progress" } : { href: paths.list, label: "Back to reviews" };
  const router = useRouter();
  const me = useMe();
  const approvers = useApprovers(item.project_id);
  const history = useReviewHistory(item.id);
  const files = useItemFiles(item.id);
  const decide = useReviewDecision();
  const myId = me.kind === "ready" ? me.data.id : null;
  const isApprover = approvers.kind === "ready" && approvers.data.caller_is_approver;
  const ownWork = !!myId && item.primary_assignee?.user_id === myId;
  const canDecide = item.state === "IN_REVIEW" && isApprover && !ownWork && item.submitted_revision !== null;
  const submission = history.kind === "ready"
    ? history.data.submissions.find((s) => s.revision === item.submitted_revision) ?? history.data.submissions[0]
    : undefined;

  return (
    <PageFrame
      crumbs={crumbs}
      back={back}
      title={`${item.key} · ${item.title}`}
      description={item.description ?? undefined}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatPill label="Points" value={item.weight ?? "—"} />
        <StatPill label="Status" value={item.state.replace("_", " ").toLowerCase()} />
        <StatPill label="Review round" value={item.submitted_revision ?? item.revision} />
        <StatPill label="Developer" value={item.primary_assignee?.email ?? "Unassigned"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Panel title="Submission" description={submission ? `Round ${submission.revision} · ${dateTimeText(submission.submitted_at)}` : undefined}
            icon={FileSearch} iconTone="violet">
            {history.kind !== "ready" ? (
              <SectionGate state={history} what="the submission">{() => null}</SectionGate>
            ) : !submission ? (
              <p className="text-xs text-[var(--color-text-muted)]">Nothing has been submitted yet.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Note</p>
                  <p className="text-sm whitespace-pre-wrap">{submission.note || "No note."}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Evidence</p>
                  <EvidenceList items={submission.evidence ?? []} files={files.kind === "ready" ? files.data : []} />
                </div>
              </div>
            )}
          </Panel>
          <Panel title="Acceptance criteria" icon={ClipboardCheck} iconTone="emerald">
            <p className="text-sm whitespace-pre-wrap">{item.criteria ?? "None."}</p>
          </Panel>
          <Panel title="Commits" description="From GitHub by the task key (evidence only)" icon={GitBranch} iconTone="violet">
            <TaskCommits itemId={item.id} itemKey={item.key} />
          </Panel>
          <Panel title="History" icon={History} iconTone="blue">
            <div className="space-y-4">
              {history.kind === "ready" && history.data.reviews.length > 0 && (
                <ul className="space-y-2">
                  {history.data.reviews.map((r) => (
                    <li key={r.id} className="rounded-lg border border-[var(--color-border)] p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">Round {r.revision}</span><DecisionBadge decision={r.decision} />
                      </div>
                      {r.reason && <p className="mt-1 whitespace-pre-wrap">{r.reason}</p>}
                      <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{r.reviewer_email ?? "Reviewer"} · {dateTimeText(r.decided_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <TaskActivity itemId={item.id} />
            </div>
          </Panel>
        </div>
        <div className="space-y-5">
          <DecisionPanel
            canDecide={canDecide}
            blockedReason={ownWork ? "You cannot approve your own task."
              : !isApprover ? "You are not an approver of this project."
                : item.state !== "IN_REVIEW" ? "This task is not waiting for review." : null}
            pending={decide.isPending}
            onDecide={(decision, reason) => decide.mutate(
              { id: item.id, revision: item.submitted_revision ?? 0, decision, reason },
              {
                onSuccess: (saved) => {
                  toast.success(decision === "APPROVED" ? `${saved.key} approved: its points now count.` : `${saved.key} returned to In progress.`);
                  router.push(paths.list);
                },
                onError: (e) => toast.error(changeError(e)),
              },
            )}
          />
        </div>
      </div>
    </PageFrame>
  );
}

function SoloReview({ orgId, panel, checkinId }: { orgId: string; panel: ReviewPanel; checkinId: string }) {
  const paths = reviewPaths(orgId, panel);
  const query = useQuery({
    queryKey: [...flowKeys.all, "checkin", checkinId],
    queryFn: () => apiClient.checkIn(checkinId),
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  return (
    <DevGate state={toState<PendingReviewDto>(query)} what="This submission" back={{ href: paths.list, label: "Back to reviews" }} skeleton="detail">
      {(data) => <SoloReviewContent data={data} panel={panel} paths={paths} />}
    </DevGate>
  );
}

function SoloReviewContent({ data, panel, paths }: { data: PendingReviewDto; panel: ReviewPanel; paths: ReturnType<typeof reviewPaths> }) {
  const router = useRouter();
  const summary = useProgressSummary(data.project_id);
  const commits = useProjectCommits(data.project_id);
  const refresh = useFlowMutation(() => apiClient.flow.refreshProjectCommits(data.project_id));
  const decide = useFlowMutation((args: { decision: "APPROVE" | "REJECT"; reason?: string; version: number }) =>
    apiClient.decideCheckIn(data.checkin.id, { decision: args.decision, reason: args.reason, expected_version: args.version }));
  const c: CheckInDto = data.checkin;
  const canDecide = summary.kind === "ready" && summary.data.can_decide && summary.data.pending?.id === c.id;

  return (
    <PageFrame
      crumbs={[{ label: PANEL_LABEL[panel], href: paths.home }, { label: "Reviews", href: paths.list }, { label: data.project_key }]}
      back={{ href: paths.list, label: "Back to reviews" }}
      title={`${data.project_key} · ${data.project_name}`}
      description="Solo project: the developer reports how complete the project is. Your approval makes it the project's progress."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatPill label="Reported" value={`${Number(c.percent)}%`} tone="warning" />
        <StatPill label="Approved now" value={data.current.percent === null ? data.current.label : `${Number(data.current.percent)}%`} />
        <StatPill label="Status" value={c.status.toLowerCase()} />
        <StatPill label="Developer" value={c.author.email ?? "—"} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Panel title="Submission" description={dateTimeText(c.submitted_at)} icon={FileSearch} iconTone="violet">
            <div className="space-y-3 text-sm">
              <div><p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">What was done</p><p className="whitespace-pre-wrap">{c.accomplished}</p></div>
              <div><p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Next steps</p><p className="whitespace-pre-wrap">{c.next_steps}</p></div>
              {c.blockers && <div><p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Blockers</p><p className="whitespace-pre-wrap">{c.blockers}</p></div>}
              {c.downward_reason && <div><p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Why lower</p><p>{c.downward_reason}</p></div>}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Evidence</p>
                <EvidenceList items={(c.evidence_items ?? []).concat(c.evidence ? [{ type: "NOTE", ref: c.evidence }] : [])} filesAreImages />
              </div>
            </div>
          </Panel>
          <Panel title="Commits" description="From GitHub, commits that mention the project key (evidence only)" icon={GitBranch} iconTone="violet">
            <SectionGate state={commits} what="commits">
              {(items) => (
                <CommitList items={items} refreshing={refresh.isPending}
                  empty={`No commits linked yet. Mention ${data.project_key} in a commit message or branch.`}
                  onRefresh={() => refresh.mutate(undefined, {
                    onSuccess: (r) => (r.connected ? toast.success(`${r.linked} new item(s) linked.`) : toast.info("No repository is connected to this project.")),
                    onError: (e) => toast.error(changeError(e)),
                  })} />
              )}
            </SectionGate>
          </Panel>
          {summary.kind === "ready" && (
            <Panel title="Earlier submissions" icon={History} iconTone="blue">
              <ul className="space-y-2">
                {summary.data.history.filter((h) => h.id !== c.id).map((h) => (
                  <li key={h.id} className="rounded-lg border border-[var(--color-border)] p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{Number(h.percent)}% reported</span>
                      <StatusBadge label={h.status === "REJECTED" ? "Changes requested" : h.status.toLowerCase()}
                        tone={h.status === "APPROVED" ? "success" : h.status === "REJECTED" ? "warning" : "neutral"} />
                    </div>
                    {h.decision_reason && <p className="mt-1">{h.decision_reason}</p>}
                    <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{h.decided_by?.email ?? h.author.email} · {dateTimeText(h.decided_at ?? h.submitted_at)}</p>
                  </li>
                ))}
                {summary.data.history.length <= 1 && <li className="text-xs text-[var(--color-text-muted)]">This is the first submission.</li>}
              </ul>
            </Panel>
          )}
        </div>
        <div className="space-y-5">
          <DecisionPanel
            canDecide={canDecide}
            blockedReason={c.status !== "PENDING" ? "This submission was already decided." : summary.kind === "ready" && !summary.data.can_decide
              ? "You cannot decide this submission (not an approver of this project, or it is your own)." : null}
            pending={decide.isPending}
            onDecide={(decision, reason) => decide.mutate(
              { decision: decision === "APPROVED" ? "APPROVE" : "REJECT", reason, version: c.version },
              {
                onSuccess: () => {
                  toast.success(decision === "APPROVED" ? `${Number(c.percent)}% is now the approved progress.` : "Changes requested. The developer can submit again.");
                  router.push(paths.list);
                },
                onError: (e) => toast.error(changeError(e)),
              },
            )}
          />
        </div>
      </div>
    </PageFrame>
  );
}

/** Approve or request changes; a reason is required for changes. Hidden (with the reason) when the caller cannot decide. */
export function DecisionPanel({ canDecide, blockedReason, pending, onDecide }: {
  canDecide: boolean;
  blockedReason: string | null;
  pending: boolean;
  onDecide: (decision: "APPROVED" | "CHANGES_REQUESTED", reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel title="Decision" icon={ShieldCheck} iconTone="emerald"
      description="Your decision, the time, your reason and the evidence you reviewed are recorded.">
      {!canDecide ? (
        <p className="text-xs text-[var(--color-text-muted)]" data-testid="decision-unavailable">{blockedReason ?? "No decision is possible right now."}</p>
      ) : (
        <div className="space-y-3">
          <AdminTextarea label="Reason (required to reject)" rows={4} maxLength={2000} value={reason}
            onChange={(e) => setReason(e.target.value)} error={error ?? undefined} />
          <div className="flex flex-wrap gap-2">
            <AdminButton onClick={() => { setError(null); onDecide("APPROVED", reason.trim() || undefined); }} isLoading={pending}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Accept
            </AdminButton>
            <AdminButton variant="outline" isLoading={pending} onClick={() => {
              if (!reason.trim()) return setError("Give a reason for rejecting: what needs to change.");
              setError(null);
              onDecide("CHANGES_REQUESTED", reason.trim());
            }}>
              <XCircle className="w-3.5 h-3.5" /> Reject
            </AdminButton>
          </div>
          <p className="flex items-start gap-1 text-[11px] text-[var(--color-text-muted)]">
            <MessageSquareWarning className="w-3 h-3 mt-px shrink-0" aria-hidden="true" />
            Rejecting returns the work to In progress with your reason visible to the developer. Accepting adds its points to the project progress.
          </p>
        </div>
      )}
    </Panel>
  );
}
