"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, CheckSquare, FileSearch, Gavel, ListChecks, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS } from "@/mocks/delivery-dashboards";
import {
  AdminButton,
  AdminTextarea,
  Avatar,
  EVIDENCE_LABEL,
  LinkRow,
  NotFoundState,
  PageFrame,
  Panel,
  PriorityBadge,
  ReviewStatusBadge,
  StatPill,
  StatusBadge,
  formatDateTime,
  formatWaiting,
  hoursSince,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { cn } from "@/lib/utils";

type Decision = "APPROVED" | "CHANGES_REQUESTED";

export default function ReviewerReviewPage() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const href = useRoleHref("reviewer");
  const { status, retry } = useDemoLoad();
  const lk = useLookups();
  const review = useDeliveryStore((s) => s.reviews.find((r) => r.id === reviewId && r.reviewerId === VIEWERS.reviewer.id));
  const allEvidence = useDeliveryStore((s) => s.evidence);
  const allReviews = useDeliveryStore((s) => s.reviews);
  const decide = useDeliveryStore((s) => s.decideReview);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const back = { href: href("queue"), label: "Back to review queue" };
  const crumbs = [{ label: "QA", href: href() }, { label: "Review queue", href: href("queue") }, { label: review?.code ?? "Review" }];

  if (status === "ready" && !review) {
    return <PageFrame crumbs={crumbs} back={back} title="Review"><NotFoundState what="Review" back={back} /></PageFrame>;
  }

  const task = lk.task(review?.taskId);
  const evidence = allEvidence.filter((e) => e.reviewId === reviewId);
  const earlier = allReviews.filter((r) => review && r.taskId === review.taskId && r.id !== review.id);
  const done = review?.checklist.filter((c) => c.done).length ?? 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!review || !decision) return setError("Choose Approve or Request changes.");
    if (decision === "CHANGES_REQUESTED" && reason.trim().length < 15)
      return setError("Explain what must change (at least 15 characters) so the developer can act on it.");
    setError("");
    setSaving(true);
    window.setTimeout(() => {
      decide(review.id, decision, reason.trim() || "Meets acceptance criteria.");
      setSaving(false);
      toast.success(decision === "APPROVED" ? `${review.code} approved` : `Changes requested on ${review.code}`, {
        description: `${lk.person(review.submittedById)?.name} has been notified.`,
      });
    }, 500);
  };

  return (
    <PageFrame
      crumbs={crumbs}
      back={back}
      title={task?.title ?? "Review"}
      description={review && task ? `${review.code} · ${task.key} · ${lk.project(review.projectId)?.name} · round ${review.round}` : undefined}
      status={status}
      onRetry={retry}
      skeleton="detail"
    >
      {review && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatPill label="Status" value={<ReviewStatusBadge status={review.status} />} />
            <StatPill label="Priority" value={<PriorityBadge priority={review.priority} />} />
            <StatPill label="Submitted" value={formatDateTime(review.submittedAt)} />
            <StatPill label="Waiting" value={review.status === "PENDING" ? formatWaiting(hoursSince(review.submittedAt)) : "—"} tone={hoursSince(review.submittedAt) >= 48 && review.status === "PENDING" ? "warning" : "neutral"} />
            <StatPill label="Checklist" value={`${done}/${review.checklist.length}`} tone={done === review.checklist.length ? "success" : "warning"} />
            <StatPill label="Evidence" value={evidence.length} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 space-y-4">
              <Panel title="What was submitted">
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{review.summary}</p>
                {task && <p className="mt-3 text-xs text-[var(--color-text-muted)]"><b className="text-[var(--color-text-secondary)]">Acceptance:</b> {task.description}</p>}
                <div className="mt-4 flex items-center gap-2.5">
                  <Avatar person={lk.person(review.submittedById)} />
                  <div className="text-xs"><p className="font-semibold">{lk.person(review.submittedById)?.name}</p><p className="text-[var(--color-text-muted)]">{lk.person(review.submittedById)?.title}</p></div>
                </div>
              </Panel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Panel title="Checklist" icon={ListChecks} iconTone="blue">
                  <ul className="space-y-2">
                    {review.checklist.map((c) => (
                      <li key={c.label} className="flex items-start gap-2 text-xs">
                        {c.done ? <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" /> : <Square className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />}
                        <span className={c.done ? "" : "text-[var(--color-text-secondary)]"}>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
                <Panel title="Evidence" description="Open an item to inspect it" icon={FileSearch} iconTone="violet">
                  {evidence.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No evidence attached.</p>}
                  <div className="space-y-0.5">
                    {evidence.map((e) => (
                      <LinkRow key={e.id} href={href(`evidence/${e.id}`)}>
                        <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{e.title}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{EVIDENCE_LABEL[e.type]}</p></div>
                        <StatusBadge label={e.status === "TO_INSPECT" ? "To inspect" : e.status === "VERIFIED" ? "Verified" : "Flagged"} tone={e.status === "TO_INSPECT" ? "violet" : e.status === "VERIFIED" ? "success" : "danger"} />
                      </LinkRow>
                    ))}
                  </div>
                </Panel>
              </div>
              {earlier.length > 0 && (
                <Panel title="Earlier rounds" icon={RotateCcw} iconTone="rose">
                  <div className="space-y-0.5">
                    {earlier.map((r) => (
                      <LinkRow key={r.id} href={href(`reviews/${r.id}`)}>
                        <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{r.code} · round {r.round}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{r.reason}</p></div>
                        <ReviewStatusBadge status={r.status} />
                      </LinkRow>
                    ))}
                  </div>
                </Panel>
              )}
            </div>

            <Panel title="Your decision" icon={Gavel} iconTone="amber" className="self-start">
              {review.status === "PENDING" ? (
                <form onSubmit={submit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-2" role="radiogroup" aria-label="Decision">
                    {(
                      [
                        { v: "APPROVED", label: "Approve", icon: CheckCircle2, on: "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
                        { v: "CHANGES_REQUESTED", label: "Request changes", icon: RotateCcw, on: "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300" },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        role="radio"
                        aria-checked={decision === o.v}
                        onClick={() => { setDecision(o.v); setError(""); }}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5",
                          decision === o.v ? o.on : "border-[var(--color-border)] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
                        )}
                      >
                        <o.icon className="w-4 h-4" /> {o.label}
                      </button>
                    ))}
                  </div>
                  <AdminTextarea
                    label={decision === "CHANGES_REQUESTED" ? "Reason (required)" : "Note (optional)"}
                    rows={5}
                    placeholder={decision === "CHANGES_REQUESTED" ? "What is missing or wrong, and how will you verify the fix?" : "Anything worth noting for the developer?"}
                    value={reason}
                    onChange={(e) => { setReason(e.target.value); setError(""); }}
                    error={error}
                  />
                  <AdminButton type="submit" className="w-full" variant={decision === "CHANGES_REQUESTED" ? "danger" : "primary"} isLoading={saving} disabled={!decision}>
                    {decision === "CHANGES_REQUESTED" ? "Send back with reason" : "Submit decision"}
                  </AdminButton>
                  <p className="text-[10px] text-[var(--color-text-muted)]">Your decision is recorded in the audit log with this reason.</p>
                </form>
              ) : (
                <div className="space-y-2.5">
                  <ReviewStatusBadge status={review.status} />
                  <p className="text-xs text-[var(--color-text-secondary)]">{review.reason}</p>
                  {review.decidedAt && <p className="text-[11px] text-[var(--color-text-muted)]">Decided {formatDateTime(review.decidedAt)} UTC</p>}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </PageFrame>
  );
}
