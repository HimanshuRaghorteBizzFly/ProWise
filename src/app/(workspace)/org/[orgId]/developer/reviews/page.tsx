"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FileText, GitPullRequest, Link2, MessageSquareWarning, Plus } from "lucide-react";
import { toast } from "sonner";

import { PanelLayout } from "@/components/layouts/panel-layout";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  EmptyStateView,
  PageFrame,
  SegmentTabs,
  StatusBadge,
  SurfaceCard,
} from "@/components/delivery/DeliveryUI";
import { DecisionBadge, DevGate, changeError, dateTimeText } from "@/components/developer/DevUI";
import { useDevFiles, useDevMutation, useDevProjects, useDevReviews, useMyFeedback } from "@/components/developer/useDeveloperData";
import { developerApi, type DeveloperCodeReview } from "@/lib/developer-api";

type Tab = "feedback" | "code" | "evidence";

/**
 * Reviews & Evidence: reviewer decisions on your Structured submissions (the acceptance workflow), pull-request code
 * reviews, and the files / links you have recorded as evidence. Submitting evidence for acceptance happens on the task.
 */
export default function DeveloperReviewsPage() {
  const params = useParams();
  const search = useSearchParams();
  const orgId = (params?.orgId as string) || "";
  const base = `/org/${orgId}/developer`;
  const initial = search?.get("tab");
  const [tab, setTab] = useState<Tab>(initial === "files" || initial === "evidence" ? "evidence" : initial === "code" ? "code" : "feedback");

  return (
    <PanelLayout title="Reviews & Evidence">
      <PageFrame
        crumbs={[{ label: "Developer", href: `${base}/dashboard` }, { label: "Reviews & Evidence" }]}
        title="Reviews & Evidence"
        description="Reviewer decisions on your submissions, pull-request reviews, and the evidence you have recorded."
      >
        <SegmentTabs<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "feedback", label: "Review feedback" },
            { value: "code", label: "Code reviews" },
            { value: "evidence", label: "Files & evidence" },
          ]}
        />
        {tab === "feedback" && <FeedbackList base={base} />}
        {tab === "code" && <CodeReviews base={base} />}
        {tab === "evidence" && <EvidenceFiles base={base} />}
      </PageFrame>
    </PanelLayout>
  );
}

/* ------------------------------------------------------------------ feedback */

function FeedbackList({ base }: { base: string }) {
  const feedback = useMyFeedback();
  return (
    <DevGate state={feedback} what="Review feedback" back={{ href: `${base}/dashboard`, label: "Back to dashboard" }}>
      {(rows) =>
        rows.length === 0 ? (
          <EmptyStateView icon={MessageSquareWarning} title="No review decisions yet"
            description="Submit work with evidence from a task; your reviewer's decision appears here." />
        ) : (
          <ul className="space-y-3">
            {rows.map((f) => (
              <li key={f.id}>
                <SurfaceCard className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`${base}/tasks/${f.work_item_id}`} className="text-sm font-medium truncate hover:underline">
                      <span className="font-mono text-blue-600 dark:text-blue-400">{f.key}</span> {f.title}
                    </Link>
                    <DecisionBadge decision={f.decision} />
                  </div>
                  {f.reason && <p className="text-xs whitespace-pre-wrap">{f.reason}</p>}
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Revision {f.revision} · {f.reviewer_email ?? "Reviewer"} · {dateTimeText(f.decided_at)}
                  </p>
                  {f.decision === "CHANGES_REQUESTED" && f.state !== "DONE" && (
                    <Link href={`${base}/tasks/${f.work_item_id}`} className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline">
                      Address the changes and submit a new revision
                    </Link>
                  )}
                </SurfaceCard>
              </li>
            ))}
          </ul>
        )
      }
    </DevGate>
  );
}

/* ------------------------------------------------------------------ code reviews */

const REVIEW_TONE: Record<string, "success" | "warning" | "info" | "violet"> = {
  APPROVED: "success", CHANGES_REQUESTED: "warning", PENDING: "info", MERGED: "violet",
};

function CodeReviews({ base }: { base: string }) {
  const [type, setType] = useState<"authored" | "assigned">("authored");
  const reviews = useDevReviews(type);
  return (
    <div className="space-y-3">
      <SegmentTabs<"authored" | "assigned"> value={type} onChange={setType}
        options={[{ value: "authored", label: "My pull requests" }, { value: "assigned", label: "Assigned to me" }]} />
      <DevGate state={reviews} what="Code reviews" back={{ href: `${base}/dashboard`, label: "Back to dashboard" }}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyStateView icon={GitPullRequest} title="No code reviews"
              description={type === "authored" ? "Pull requests you author appear here." : "Pull requests waiting for your review appear here."} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rows.map((r) => <CodeReviewCard key={r.id} review={r} canDecide={type === "assigned"} />)}
            </div>
          )
        }
      </DevGate>
    </div>
  );
}

function CodeReviewCard({ review: r, canDecide }: { review: DeveloperCodeReview; canDecide: boolean }) {
  const decide = useDevMutation((args: { decision: string; feedback?: string }) =>
    developerApi.submitReviewDecision(r.id, args.decision, args.feedback));
  const [feedback, setFeedback] = useState("");

  const send = (decision: "APPROVED" | "CHANGES_REQUESTED") => {
    if (decision === "CHANGES_REQUESTED" && !feedback.trim()) return toast.error("Explain what needs to change.");
    decide.mutate({ decision, feedback: feedback.trim() || undefined }, {
      onSuccess: () => { toast.success("Decision recorded."); setFeedback(""); },
      onError: (err) => toast.error(changeError(err)),
    });
  };

  return (
    <SurfaceCard className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{r.title}</p>
        <StatusBadge label={r.status.replace("_", " ").toLowerCase()} tone={REVIEW_TONE[r.status] ?? "info"} />
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        {r.repositoryName ?? "Repository"}{r.prNumber ? ` #${r.prNumber}` : ""}{r.branch ? ` · ${r.branch}` : ""} · {dateTimeText(r.updatedAt)}
      </p>
      {r.prUrl && /^https?:\/\//.test(r.prUrl) && (
        <a href={r.prUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
          <Link2 className="w-3 h-3" /> Open pull request
        </a>
      )}
      {canDecide && r.status === "PENDING" && (
        <div className="space-y-2 pt-1">
          <AdminTextarea aria-label="Review feedback" rows={2} placeholder="Feedback (required to request changes)" maxLength={4000}
            value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          <div className="flex gap-2">
            <AdminButton size="xs" isLoading={decide.isPending} onClick={() => send("APPROVED")}>Approve</AdminButton>
            <AdminButton size="xs" variant="outline" isLoading={decide.isPending} onClick={() => send("CHANGES_REQUESTED")}>Request changes</AdminButton>
          </div>
        </div>
      )}
      <p className="text-[10px] text-[var(--color-text-muted)]">A code review is evidence; it never marks a task done.</p>
    </SurfaceCard>
  );
}

/* ------------------------------------------------------------------ files & evidence */

function EvidenceFiles({ base }: { base: string }) {
  const files = useDevFiles();
  const projects = useDevProjects();
  const save = useDevMutation((body: Parameters<typeof developerApi.saveFileRecord>[0]) => developerApi.saveFileRecord(body));
  const [form, setForm] = useState({ projectId: "", fileName: "", fileUrl: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.fileName.trim()) next.fileName = "A name is required.";
    else if (form.fileName.trim().length > 255) next.fileName = "At most 255 characters.";
    if (!/^https:\/\/\S+$/.test(form.fileUrl.trim())) next.fileUrl = "Enter an https:// link to the file or document.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate({ projectId: form.projectId || undefined, fileName: form.fileName.trim(), fileUrl: form.fileUrl.trim() }, {
      onSuccess: () => { toast.success("Evidence recorded."); setForm({ projectId: "", fileName: "", fileUrl: "" }); setOpen(false); },
      onError: (err) => toast.error(changeError(err)),
    });
  };

  const projectOptions = projects.kind === "ready" ? projects.data.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })) : [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <AdminButton size="sm" variant={open ? "ghost" : "primary"} onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : <><Plus className="w-3.5 h-3.5 mr-1" /> Record a link</>}
        </AdminButton>
      </div>
      {open && (
        <SurfaceCard className="p-4">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start" noValidate>
            <AdminSelect label="Project (optional)" value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
              options={[{ value: "", label: "No project" }, ...projectOptions]} />
            <AdminInput label="Name" value={form.fileName} error={errors.fileName} maxLength={255}
              onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))} />
            <AdminInput label="Link" placeholder="https://…" value={form.fileUrl} error={errors.fileUrl}
              onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))} />
            <div className="md:col-span-3 flex justify-end">
              <AdminButton type="submit" isLoading={save.isPending}>Save</AdminButton>
            </div>
          </form>
        </SurfaceCard>
      )}
      <DevGate state={files} what="Your files" back={{ href: `${base}/dashboard`, label: "Back to dashboard" }}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyStateView icon={FileText} title="No files recorded" description="Links to documents and artifacts you record appear here." />
          ) : (
            <SurfaceCard className="p-0 overflow-hidden">
              <ul className="divide-y divide-[var(--color-border)]">
                {rows.map((f) => {
                  const href = f.fileUrl ?? f.storagePath;
                  return (
                    <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">{f.fileName}</span>
                        <span className="block text-[11px] text-[var(--color-text-muted)]">{dateTimeText(f.createdAt)}</span>
                      </span>
                      {href && /^https?:\/\//.test(href) && (
                        <a href={href} target="_blank" rel="noreferrer noopener" className="text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0">Open</a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </SurfaceCard>
          )
        }
      </DevGate>
    </div>
  );
}
