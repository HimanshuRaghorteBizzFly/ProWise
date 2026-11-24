"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, MailPlus, RefreshCw, XCircle } from "lucide-react";
import type { PlatformApi } from "@/lib/admin-api/platform";
import type { AdminEmailDraft, PagedResult } from "@/types/admin-platform";
import {
  AdminButton,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { ResourceStatus, formatInstant, humanize, type ResourceState } from "./admin-resource";
import { MutationErrorBanner, useMutation, type MutationFailure } from "./platform-shared";

export type OperatorEmailDraftsApi = Pick<PlatformApi, "emailDrafts">;

/** Status filter of the operator drafts list ("ALL" sends no status). SUBMITTED = awaiting review. */
export const EMAIL_DRAFT_STATUS_OPTIONS = ["SUBMITTED", "APPROVED", "REJECTED", "DRAFT"];

/** Only a submitted draft can be approved or rejected (the server answers 409 INVALID_STATE otherwise). */
export const canReviewEmailDraft = (d: Pick<AdminEmailDraft, "status">) => d.status === "SUBMITTED";

/** Reject needs a note for the author; returns the validation message or null. */
export function rejectNoteError(note: string): string | null {
  return note.trim() ? null : "Tell the author why the draft is rejected.";
}

function fieldError(failure: MutationFailure | null, field: string): string | undefined {
  return failure?.fieldErrors[field];
}

export interface OperatorEmailDraftsViewProps {
  state: ResourceState<PagedResult<AdminEmailDraft>>;
  onRetry: () => void;
  api: OperatorEmailDraftsApi;
  status: string;
  onStatusChange: (status: string) => void;
  /** 1-based page shown in the footer (the server's page is 0-based). */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

type Decision = { draft: AdminEmailDraft; kind: "approve" | "reject" };

/**
 * Operator email template drafts awaiting Super Admin review: preview, approve (optional note) or reject (note
 * required). Approving sends no email. Every decision carries the version this page read; a stale one shows the
 * reload message and is never retried automatically.
 */
export function OperatorEmailDraftsView({
  state,
  onRetry,
  api,
  status,
  onStatusChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: OperatorEmailDraftsViewProps) {
  const ready = state.status === "ready";
  const rows = ready ? state.data.items ?? [] : [];
  const total = ready ? state.data.total ?? 0 : 0;

  const [preview, setPreview] = useState<AdminEmailDraft | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [noteMessage, setNoteMessage] = useState<string | null>(null);
  const review = useMutation();

  const openDecision = (draft: AdminEmailDraft, kind: Decision["kind"]) => {
    setPreview(null);
    setDecision({ draft, kind });
    setNote("");
    setNoteMessage(null);
    review.clear();
  };

  const submitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) return;
    const { draft, kind } = decision;
    if (kind === "reject") {
      const message = rejectNoteError(note);
      setNoteMessage(message);
      if (message) return;
    }
    const ok = await review.run(() =>
      kind === "approve"
        ? api.emailDrafts.approve(draft.id, draft.version, note)
        : api.emailDrafts.reject(draft.id, draft.version, note.trim()),
    );
    if (ok) {
      toast.success(kind === "approve" ? `Approved "${draft.name}". No email was sent.` : `Rejected "${draft.name}".`);
      setDecision(null);
      onRetry();
    }
  };

  const actions = (d: AdminEmailDraft) => (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <AdminButton variant="outline" size="xs" onClick={() => setPreview(d)} title="Preview draft">
        <Eye className="w-3 h-3" />
        Preview
      </AdminButton>
      {canReviewEmailDraft(d) && (
        <>
          <AdminButton variant="primary" size="xs" disabled={review.pending} onClick={() => openDecision(d, "approve")}>
            <CheckCircle2 className="w-3 h-3" />
            Approve
          </AdminButton>
          <AdminButton
            variant="ghost"
            size="xs"
            className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            disabled={review.pending}
            onClick={() => openDecision(d, "reject")}
          >
            <XCircle className="w-3 h-3" />
            Reject
          </AdminButton>
        </>
      )}
    </div>
  );

  return (
    <section className="space-y-4" aria-label="Operator drafts">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Operator drafts</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Email template drafts written by platform operators. Approving records the decision only; nothing is sent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-40">
            <AdminSelect
              aria-label="Filter operator draft status"
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              options={[
                { label: "All statuses", value: "ALL" },
                ...EMAIL_DRAFT_STATUS_OPTIONS.map((s) => ({ label: s === "SUBMITTED" ? "Awaiting review" : humanize(s), value: s })),
              ]}
            />
          </div>
          <AdminButton variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </AdminButton>
        </div>
      </div>

      <MutationErrorBanner failure={review.failure} onReload={() => { review.clear(); onRetry(); }} />

      <SurfaceCard className="overflow-hidden">
        <ResourceStatus
          state={ready ? { status: "ready", data: rows } : state}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={MailPlus}
          emptyTitle="No operator drafts"
          emptyDescription={status === "ALL" ? "Operators have not written any email drafts yet." : "No drafts have this status."}
        />

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[760px]" aria-label="Operator email drafts">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <th className="px-4 py-3">Draft</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted / Reviewed</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-[var(--color-hover)] align-top">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-semibold text-[var(--color-text-primary)]">{d.name}</p>
                      <p className="text-[var(--color-text-secondary)] line-clamp-1">{d.subject}</p>
                      {d.category && <p className="text-[10px] text-[var(--color-text-muted)]">{humanize(d.category)}</p>}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] break-all">{d.created_by_email || d.created_by || "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={d.status === "SUBMITTED" ? "Awaiting review" : humanize(d.status)} tone={getStatusTone(d.status)} dot />
                      {d.reviewer_note && (
                        <p className="mt-1 text-[11px] text-[var(--color-text-muted)] line-clamp-2" title={d.reviewer_note}>
                          Note: {d.reviewer_note}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
                      <p>{d.submitted_at ? `Submitted ${formatInstant(d.submitted_at)}` : "Not submitted"}</p>
                      {d.reviewed_at && <p>Reviewed {formatInstant(d.reviewed_at)}{d.reviewed_by ? ` by ${d.reviewed_by}` : ""}</p>}
                    </td>
                    <td className="px-4 py-3">{actions(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ready && total > 0 && (
          <PaginationBar currentPage={page} totalItems={total} pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
        )}
      </SurfaceCard>

      {/* Preview: text fields as text; HTML only inside a fully sandboxed frame (no scripts, no same-origin). */}
      <AdminModal isOpen={preview !== null} onClose={() => setPreview(null)} title={preview?.name || "Draft preview"} description="Operator draft as submitted. Nothing is sent from here." maxWidth="2xl">
        {preview && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <p>Subject: <strong>{preview.subject}</strong></p>
              <p>Author: <strong>{preview.created_by_email || preview.created_by || "-"}</strong></p>
              {preview.audience_description && <p className="sm:col-span-2">Audience: {preview.audience_description}</p>}
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-2">
              {preview.headline && <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{preview.headline}</h4>}
              <p className="whitespace-pre-wrap text-[var(--color-text-secondary)] leading-relaxed">{preview.body_text}</p>
              {preview.cta_label && (
                <span className="inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white">{preview.cta_label}</span>
              )}
            </div>
            {preview.body_html && (
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">HTML body (sandboxed)</span>
                <iframe
                  title={`HTML preview of ${preview.name}`}
                  sandbox=""
                  srcDoc={preview.body_html}
                  className="w-full h-64 rounded-xl border border-[var(--color-border)] bg-white"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              {canReviewEmailDraft(preview) && (
                <>
                  <AdminButton variant="outline" size="sm" onClick={() => openDecision(preview, "reject")}>
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </AdminButton>
                  <AdminButton variant="outline" size="sm" onClick={() => openDecision(preview, "approve")}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve
                  </AdminButton>
                </>
              )}
              <AdminButton variant="primary" size="sm" onClick={() => setPreview(null)}>Close</AdminButton>
            </div>
          </div>
        )}
      </AdminModal>

      {/* Approve (optional note) / Reject (note required) */}
      <AdminModal
        isOpen={decision !== null}
        onClose={() => setDecision(null)}
        title={decision ? `${decision.kind === "approve" ? "Approve" : "Reject"} draft: ${decision.draft.name}` : ""}
        description={
          decision?.kind === "approve"
            ? "Records your approval. No email is sent."
            : "The draft goes back to its author as Rejected, with your note."
        }
        maxWidth="lg"
      >
        <form onSubmit={submitDecision} className="space-y-4" noValidate>
          <MutationErrorBanner failure={review.failure} onReload={() => { setDecision(null); review.clear(); onRetry(); }} />
          <AdminTextarea
            label={decision?.kind === "reject" ? "Note for the author *" : "Note for the author (optional)"}
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={noteMessage ?? fieldError(review.failure, "reviewer_note")}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setDecision(null)}>Cancel</AdminButton>
            <AdminButton type="submit" variant={decision?.kind === "reject" ? "danger" : "primary"} size="sm" isLoading={review.pending}>
              {decision?.kind === "reject" ? "Reject draft" : "Approve draft"}
            </AdminButton>
          </div>
        </form>
      </AdminModal>
    </section>
  );
}
