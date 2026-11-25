"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Clock3, FolderKanban, History, MessageSquareText, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";

import { ApiError, isStaleVersion, newClientId } from "@/lib/api";
import type { CheckInDto, CheckInStatusDto, PendingReviewDto, ProgressFigureDto, ProgressSummaryDto } from "@/types/api";
import {
  AdminButton,
  AdminInput,
  AdminTextarea,
  ButtonLink,
  EmptyStateView,
  ErrorBanner,
  NotFoundState,
  PageFrame,
  PageSkeleton,
  Panel,
  StatPill,
  StatusBadge,
  SurfaceCard,
  formatDateTime,
} from "@/components/delivery/DeliveryUI";
import { AccessDeniedState, AccessLostState, SessionExpiredState } from "@/components/org-console/AccessStates";
import { StaleVersionBanner } from "@/components/org-console/StaleVersionBanner";
import { apiErrorMessage, type LoadState } from "@/components/org-console/useRoleApi";
import { formatDay } from "@/components/projects/formatDay";
import {
  useDecideCheckIn,
  usePendingReviews,
  useProgressSummary,
  useReloadProgress,
  useSubmitCheckIn,
} from "@/components/progress/useCheckInApi";
import { usePortfolio } from "@/components/projects/useProjectApi";

/**
 * Task 2.2 screens. Every check-in starts pending; the project's figure is the last approved entry and the pending
 * entry is always shown separately. The label stays "Developer reported", also after approval.
 */

type Crumb = { label: string; href?: string };

const STATUS: Record<CheckInStatusDto, { label: string; tone: "warning" | "success" | "danger" }> = {
  PENDING: { label: "Pending approval", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export function percentText(value: number | null) {
  return value === null ? "Not reported" : `${Number(value).toLocaleString("en-GB", { maximumFractionDigits: 2 })}%`;
}

function Gate<T>({ state, back, what, children }: {
  state: LoadState<T>;
  back: { href: string; label: string };
  what: string;
  children: (data: T) => React.ReactNode;
}) {
  if (state.kind === "loading") return <PageSkeleton variant="detail" />;
  if (state.kind === "forbidden") return <AccessDeniedState permission="project.read" backHref={back.href} />;
  if (state.kind === "access-lost") return <NotFoundState what={what} back={back} />;
  if (state.kind === "unauthenticated") return <SessionExpiredState />;
  if (state.kind === "error") return <ErrorBanner message={`${what} could not be loaded.`} onRetry={state.retry} />;
  return <>{children(state.data)}</>;
}

/* ------------------------------------------------------------------ figure and pending */

/** The approved figure with its label and times. "Not reported" until a Team Lead approves an entry. */
export function ApprovedFigure({ current }: { current: ProgressFigureDto }) {
  return (
    <div className="space-y-1" data-testid="approved-figure">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Current progress</p>
      <p className="text-2xl font-bold tabular-nums">{percentText(current.percent)}</p>
      {current.percent === null ? (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          No approved check-in yet. Prowise never derives a percentage from tasks, time or code activity.
        </p>
      ) : (
        <p className="text-[11px] text-[var(--color-text-secondary)]">
          {current.label} · reported {current.reported_at ? formatDateTime(current.reported_at) : "unknown"}
          {current.approved_at ? ` · approved ${formatDateTime(current.approved_at)}` : ""}
        </p>
      )}
    </div>
  );
}

export function PendingEntry({ pending, approverEmail, approverNote }: {
  pending: CheckInDto | null;
  approverEmail?: string | null;
  approverNote?: string | null;
}) {
  if (!pending) {
    return <p className="text-[11px] text-[var(--color-text-muted)]" data-testid="pending-entry">No check-in is waiting for approval.</p>;
  }
  return (
    <div className="space-y-1" data-testid="pending-entry">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Waiting for approval</p>
        <StatusBadge label={STATUS.PENDING.label} tone="warning" dot />
      </div>
      <p className="text-lg font-semibold tabular-nums">{percentText(pending.percent)} proposed</p>
      <p className="text-[11px] text-[var(--color-text-secondary)]">
        {pending.label} by {pending.author.email ?? "the accountable developer"} · {formatDateTime(pending.submitted_at)}
      </p>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        {approverEmail ? `Team Lead ${approverEmail} decides. It does not change the current figure until approved.` : approverNote}
      </p>
    </div>
  );
}

/** Figure, pending entry and history of one project (no data fetching: easy to test). */
export function ProgressSummaryContent({ summary, submitHref }: { summary: ProgressSummaryDto; submitHref?: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <SurfaceCard className="p-4"><ApprovedFigure current={summary.current} /></SurfaceCard>
        <SurfaceCard className="p-4">
          <PendingEntry pending={summary.pending} approverEmail={summary.approver?.email} approverNote={summary.approver_note} />
        </SurfaceCard>
      </div>
      {summary.can_submit && submitHref && (
        <div><ButtonLink href={submitHref}><Plus className="w-3.5 h-3.5" /> New check-in</ButtonLink></div>
      )}
      {summary.mode === "INDIVIDUAL" && summary.lifecycle !== "AWAITING_ACCEPTANCE" && summary.current.percent === 100 && (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          100% is a reported figure. Delivery still needs a separate, authorized acceptance.
        </p>
      )}
      <Panel title="Check-in history" icon={History} description="Every entry is kept. Corrections are new entries.">
        <CheckInHistoryList entries={summary.history} />
      </Panel>
    </div>
  );
}

export function CheckInHistoryList({ entries }: { entries: CheckInDto[] }) {
  if (entries.length === 0) {
    return <EmptyStateView icon={MessageSquareText} title="Not reported" description="The accountable developer has not submitted a check-in yet." />;
  }
  return (
    <ol className="space-y-3" data-testid="checkin-history">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-[var(--color-border)] p-3 text-xs space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tabular-nums">{percentText(entry.percent)}</span>
            <StatusBadge label={STATUS[entry.status].label} tone={STATUS[entry.status].tone} dot />
            <span className="text-[var(--color-text-muted)]">#{entry.revision_seq} · {entry.label}</span>
          </div>
          <p className="text-[var(--color-text-secondary)]">
            By {entry.author.email ?? "unknown"} · {formatDateTime(entry.submitted_at)} · method {entry.method}
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <div><dt className="text-[var(--color-text-muted)]">Accomplished</dt><dd className="whitespace-pre-wrap">{entry.accomplished}</dd></div>
            <div><dt className="text-[var(--color-text-muted)]">Next</dt><dd className="whitespace-pre-wrap">{entry.next_steps}</dd></div>
            {entry.blockers && <div><dt className="text-[var(--color-text-muted)]">Blockers</dt><dd className="whitespace-pre-wrap">{entry.blockers}</dd></div>}
            {entry.projected_finish && <div><dt className="text-[var(--color-text-muted)]">Projected finish</dt><dd>{formatDay(entry.projected_finish)}</dd></div>}
            {entry.evidence && <div><dt className="text-[var(--color-text-muted)]">Evidence</dt><dd className="break-all">{entry.evidence}</dd></div>}
            {entry.downward_reason && <div><dt className="text-[var(--color-text-muted)]">Why lower</dt><dd>{entry.downward_reason}</dd></div>}
          </dl>
          {entry.decided_at && (
            <p className="text-[var(--color-text-secondary)]">
              {entry.status === "APPROVED" ? "Approved" : "Rejected"} by {entry.decided_by?.email ?? "unknown"} · {formatDateTime(entry.decided_at)}
              {entry.decision_reason ? ` · “${entry.decision_reason}”` : ""}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ project progress page */

/** Project progress page: approved figure, pending entry, history, and the developer's "New check-in" link. */
export function ProjectProgressView({ projectId, crumbs, back, submitHref }: {
  projectId: string;
  crumbs: Crumb[];
  back: { href: string; label: string };
  submitHref?: string;
}) {
  const state = useProgressSummary(projectId);
  const summary = state.kind === "ready" ? state.data : null;
  return (
    <PageFrame crumbs={[...crumbs, { label: summary?.project_key ?? "Progress" }]} back={back}
      title={summary ? `${summary.project_key} · ${summary.project_name}` : "Progress"}
      description="Developer-reported progress. A check-in counts only after the Team Lead approves it.">
      <Gate state={state} back={back} what="Project">
        {(data) => <ProgressSummaryContent summary={data} submitHref={submitHref} />}
      </Gate>
    </PageFrame>
  );
}

/* ------------------------------------------------------------------ developer check-in form */

interface FormValues {
  percent: string;
  accomplished: string;
  nextSteps: string;
  blockers: string;
  projectedFinish: string;
  evidence: string;
  downwardReason: string;
}

const EMPTY: FormValues = { percent: "", accomplished: "", nextSteps: "", blockers: "", projectedFinish: "", evidence: "", downwardReason: "" };

const FIELD_NAMES: Record<string, keyof FormValues> = {
  percent: "percent",
  accomplished: "accomplished",
  next_steps: "nextSteps",
  blockers: "blockers",
  projected_finish: "projectedFinish",
  evidence: "evidence",
  downward_reason: "downwardReason",
};

/** Client-side checks mirror the server (the server stays the authority). */
export function validateCheckIn(values: FormValues, approved: number | null): Partial<Record<keyof FormValues, string>> {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  const percent = Number(values.percent);
  if (values.percent.trim() === "" || Number.isNaN(percent)) errors.percent = "Enter a percentage from 0 to 100.";
  else if (percent < 0 || percent > 100) errors.percent = "Percentage must be from 0 to 100.";
  if (!values.accomplished.trim()) errors.accomplished = "Say what you accomplished.";
  if (!values.nextSteps.trim()) errors.nextSteps = "Say what you will do next.";
  if (approved !== null && !errors.percent && percent < approved && !values.downwardReason.trim()) {
    errors.downwardReason = `Lower than the approved ${percentText(approved)}: explain why.`;
  }
  return errors;
}

export function CheckInFormView({ projectId, crumbs, back }: {
  projectId: string;
  crumbs: Crumb[];
  back: { href: string; label: string };
}) {
  const state = useProgressSummary(projectId);
  return (
    <PageFrame crumbs={[...crumbs, { label: "New check-in" }]} back={back} title="New check-in"
      description="Your percentage, what you did, what is next and any blockers. It stays pending until your Team Lead approves it.">
      <Gate state={state} back={back} what="Project">
        {(summary) => <CheckInForm projectId={projectId} summary={summary} backHref={back.href} />}
      </Gate>
    </PageFrame>
  );
}

export function CheckInForm({ projectId, summary, backHref }: { projectId: string; summary: ProgressSummaryDto; backHref: string }) {
  const router = useRouter();
  const submit = useSubmitCheckIn(projectId);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  // One key per form: a retry after a network error cannot create a second entry.
  const [idempotencyKey] = useState(newClientId);
  const approved = summary.current.percent;
  const percent = Number(values.percent);
  const downward = approved !== null && values.percent.trim() !== "" && !Number.isNaN(percent) && percent < approved;

  if (!summary.can_submit) {
    return (
      <SurfaceCard className="p-4 space-y-3">
        <p className="text-sm font-semibold">You cannot submit a check-in right now</p>
        <p className="text-xs text-[var(--color-text-secondary)]" data-testid="cannot-submit">
          {summary.pending
            ? "Your previous check-in is waiting for the Team Lead's decision. You can submit again once it is approved or rejected."
            : summary.mode !== "INDIVIDUAL"
              ? "Structured projects calculate progress from approved work, not from check-ins."
              : summary.archived
                ? "This project is archived and read-only."
                : "Only the project's accountable developer reports its progress."}
        </p>
        <PendingEntry pending={summary.pending} approverEmail={summary.approver?.email} approverNote={summary.approver_note} />
        <ButtonLink variant="outline" href={backHref}>Back to progress</ButtonLink>
      </SurfaceCard>
    );
  }

  const set = (field: keyof FormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateCheckIn(values, approved);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;
    submit.mutate({
      idempotencyKey,
      body: {
        percent,
        accomplished: values.accomplished.trim(),
        next_steps: values.nextSteps.trim(),
        blockers: values.blockers.trim() || undefined,
        projected_finish: values.projectedFinish || undefined,
        evidence: values.evidence.trim() || undefined,
        downward_reason: downward ? values.downwardReason.trim() : undefined,
      },
    }, {
      onSuccess: () => {
        toast.success("Check-in submitted. It is pending until your Team Lead approves it.");
        router.push(backHref);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.fieldErrors?.length) {
          const mapped: Partial<Record<keyof FormValues, string>> = {};
          for (const fieldError of error.fieldErrors) {
            const name = FIELD_NAMES[fieldError.field];
            if (name) mapped[name] = fieldError.message;
          }
          setErrors(mapped);
        }
        setServerError(apiErrorMessage(error));
      },
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="checkin-form">
      <SurfaceCard className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ApprovedFigure current={summary.current} />
        <p className="text-[11px] text-[var(--color-text-muted)] self-end">
          Label: Developer reported. Approval by {summary.approver?.email ?? "the team lead"} does not change the label.
          {!summary.approver && summary.approver_note ? ` ${summary.approver_note}` : ""}
        </p>
      </SurfaceCard>
      {serverError && <ErrorBanner message={serverError} />}
      <Panel title="Your check-in" icon={ClipboardCheck}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AdminInput label="Percent complete (0 to 100)" type="number" inputMode="decimal" min={0} max={100} step="0.01"
            value={values.percent} onChange={set("percent")} error={errors.percent} required />
          <AdminInput label="Projected finish (optional)" type="date" value={values.projectedFinish}
            onChange={set("projectedFinish")} error={errors.projectedFinish} />
          <AdminTextarea label="What you accomplished" rows={3} value={values.accomplished} onChange={set("accomplished")}
            error={errors.accomplished} maxLength={4000} required />
          <AdminTextarea label="What you will do next" rows={3} value={values.nextSteps} onChange={set("nextSteps")}
            error={errors.nextSteps} maxLength={4000} required />
          <AdminTextarea label="Blockers (optional)" rows={2} value={values.blockers} onChange={set("blockers")}
            error={errors.blockers} maxLength={4000} />
          <AdminInput label="Evidence link or note (optional)" value={values.evidence} onChange={set("evidence")}
            error={errors.evidence} maxLength={2000} helperText="For example a pull request or demo link. Evidence never sets the percentage." />
          {downward && (
            <div className="md:col-span-2">
              <AdminTextarea label={`Why is this lower than the approved ${percentText(approved)}?`} rows={2}
                value={values.downwardReason} onChange={set("downwardReason")} error={errors.downwardReason} maxLength={1000} required />
            </div>
          )}
        </div>
      </Panel>
      <div className="flex flex-wrap gap-2">
        <AdminButton type="submit" isLoading={submit.isPending}>Submit for approval</AdminButton>
        <ButtonLink variant="outline" href={backHref}>Cancel</ButtonLink>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ Team Lead approval queue */

export function ApprovalQueueView({ orgId, crumbs, back }: {
  orgId: string;
  crumbs: Crumb[];
  back: { href: string; label: string };
}) {
  const state = usePendingReviews(orgId);
  const reload = useReloadProgress();
  const [stale, setStale] = useState<string | null>(null);
  return (
    <PageFrame crumbs={[...crumbs, { label: "Check-in approvals" }]} back={back} title="Check-in approvals"
      description="Check-ins of projects whose team you lead. The project's figure changes only when you approve. You never decide your own entries.">
      {stale !== null && (
        <StaleVersionBanner requestId={stale || undefined} onReload={() => { setStale(null); void reload(); }} />
      )}
      <Gate state={state} back={back} what="Approvals">
        {(items) => <ApprovalQueue items={items} onStale={(requestId) => setStale(requestId)} />}
      </Gate>
    </PageFrame>
  );
}

export function ApprovalQueue({ items, onStale }: { items: PendingReviewDto[]; onStale: (requestId: string) => void }) {
  if (items.length === 0) {
    return (
      <Panel title="Waiting for you" icon={Clock3}>
        <EmptyStateView icon={CheckCircle2} title="Nothing to approve"
          description="No check-ins from the teams you lead are waiting for a decision." />
      </Panel>
    );
  }
  return (
    <div className="space-y-4" data-testid="approval-queue">
      {items.map((item) => <ApprovalCard key={item.checkin.id} item={item} onStale={onStale} />)}
    </div>
  );
}

function ApprovalCard({ item, onStale }: { item: PendingReviewDto; onStale: (requestId: string) => void }) {
  const decide = useDecideCheckIn();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const entry = item.checkin;

  const send = (decision: "APPROVE" | "REJECT") => {
    setError(null);
    if (decision === "REJECT" && !reason.trim()) {
      setError("Give a reason for the rejection. The developer sees it.");
      return;
    }
    decide.mutate({
      checkinId: entry.id,
      body: { decision, reason: reason.trim() || undefined, expected_version: entry.version },
    }, {
      onSuccess: () => toast.success(decision === "APPROVE"
        ? `${item.project_key} is now ${percentText(entry.percent)} (Developer reported).`
        : `Check-in rejected. ${item.project_key} stays at ${percentText(item.current.percent)}.`),
      onError: (failure) => {
        if (isStaleVersion(failure)) onStale(failure instanceof ApiError ? failure.requestId : "");
        else setError(apiErrorMessage(failure));
      },
    });
  };

  return (
    <Panel title={`${item.project_key} · ${item.project_name}`} icon={ClipboardCheck}
      description={`Submitted by ${entry.author.email ?? "the accountable developer"} · ${formatDateTime(entry.submitted_at)}`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatPill label="Current (approved)" value={percentText(item.current.percent)} />
        <StatPill label="Proposed" value={percentText(entry.percent)}
          tone={item.current.percent !== null && entry.percent < item.current.percent ? "warning" : "success"} />
        <StatPill label="Revision" value={`#${entry.revision_seq}`} />
        <StatPill label="Projected finish" value={formatDay(entry.projected_finish)} />
      </div>
      <div className="mt-3"><CheckInHistoryList entries={[entry]} /></div>
      {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
      {rejecting && (
        <div className="mt-3">
          <AdminTextarea label="Reason for rejecting (required)" rows={2} value={reason} maxLength={1000}
            onChange={(event) => setReason(event.target.value)} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!rejecting ? (
          <>
            <AdminButton onClick={() => send("APPROVE")} isLoading={decide.isPending}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve {percentText(entry.percent)}
            </AdminButton>
            <AdminButton variant="outline" onClick={() => setRejecting(true)} disabled={decide.isPending}>
              <XCircle className="w-3.5 h-3.5" /> Reject
            </AdminButton>
          </>
        ) : (
          <>
            <AdminButton variant="danger" onClick={() => send("REJECT")} isLoading={decide.isPending}>Confirm rejection</AdminButton>
            <AdminButton variant="ghost" onClick={() => { setRejecting(false); setReason(""); setError(null); }}>Cancel</AdminButton>
          </>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ developer: my Individual projects */

/** Individual projects the caller can read, with the approved figure; each opens its progress page. */
export function MyCheckInProjectsView({ orgId, crumbs, back }: {
  orgId: string;
  crumbs: Crumb[];
  back: { href: string; label: string };
}) {
  const portfolio = usePortfolio(orgId, { mode: "INDIVIDUAL" });
  return (
    <PageFrame crumbs={[...crumbs, { label: "Check-ins" }]} back={back} title="Check-ins"
      description="Your Individual projects. Open one to see its approved figure, a pending check-in, or to submit a new one.">
      <Gate state={portfolio.state} back={back} what="Projects">
        {(projects) => projects.length === 0 ? (
          <EmptyStateView icon={FolderKanban} title="No Individual projects"
            description="You are not assigned to an Individual project in this workspace." />
        ) : (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="my-checkin-projects">
            {projects.map((project) => (
              <li key={project.id}>
                <SurfaceCard className="p-4 space-y-2">
                  <p className="text-sm font-semibold">{project.key} · {project.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {percentText(project.progress.percent)}
                    {project.progress.percent !== null ? ` · ${project.progress.label}` : ""}
                    {project.progress.reported_at ? ` · ${formatDateTime(project.progress.reported_at)}` : ""}
                  </p>
                  <ButtonLink variant="outline"
                    href={`/org/${orgId}/developer/projects/${encodeURIComponent(project.id)}/individual/check-ins`}>
                    Open progress
                  </ButtonLink>
                </SurfaceCard>
              </li>
            ))}
          </ul>
        )}
      </Gate>
      {portfolio.hasMore && (
        <AdminButton variant="outline" onClick={portfolio.loadMore} isLoading={portfolio.loadingMore}>Load more</AdminButton>
      )}
    </PageFrame>
  );
}
