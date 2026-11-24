"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AlertTriangle, Bug, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { AdminModal } from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
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
import { DevGate, changeError, dateTimeText } from "@/components/developer/DevUI";
import { useDevBugs, useDevMutation, useDevProjects, useMyBlockers } from "@/components/developer/useDeveloperData";
import { apiClient } from "@/lib/api";
import { developerApi, type DeveloperBug } from "@/lib/developer-api";
import type { WorkBlockerDto } from "@/types/work";

type Tab = "blockers" | "issues";

/**
 * Blockers & Issues. Blockers are the separate "blocked" flag on Structured work (raising or clearing one never changes
 * the task state); issues are bugs reported against a project. Both come from the API.
 */
export default function DeveloperBlockersPage() {
  const params = useParams();
  const search = useSearchParams();
  const orgId = (params?.orgId as string) || "";
  const base = `/org/${orgId}/developer`;
  const [tab, setTab] = useState<Tab>(search?.get("tab") === "issues" ? "issues" : "blockers");

  return (
    <PanelLayout title="Blockers & Issues">
      <PageFrame
        crumbs={[{ label: "Developer", href: `${base}/dashboard` }, { label: "Blockers & Issues" }]}
        title="Blockers & Issues"
        description="Blockers on your work or owned by you, and issues assigned to you. Raise a blocker from the task it affects."
      >
        <SegmentTabs<Tab> value={tab} onChange={setTab} options={[{ value: "blockers", label: "Blockers" }, { value: "issues", label: "Issues" }]} />
        {tab === "blockers" ? <BlockerList base={base} /> : <IssueList base={base} />}
      </PageFrame>
    </PanelLayout>
  );
}

/* ------------------------------------------------------------------ blockers */

function BlockerList({ base }: { base: string }) {
  const blockers = useMyBlockers();
  const [showResolved, setShowResolved] = useState(false);
  return (
    <DevGate state={blockers} what="Your blockers" back={{ href: `${base}/dashboard`, label: "Back to dashboard" }}>
      {(rows) => {
        const open = rows.filter((b) => !b.resolved);
        const visible = showResolved ? rows : open;
        return (
          <div className="space-y-3">
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
              Show resolved ({rows.length - open.length})
            </label>
            {visible.length === 0 ? (
              <EmptyStateView icon={CheckCircle2} title="No open blockers" description="When something stops your work, open the task and raise a blocker." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visible.map((b) => <BlockerCard key={b.id} blocker={b} base={base} />)}
              </div>
            )}
          </div>
        );
      }}
    </DevGate>
  );
}

function BlockerCard({ blocker: b, base }: { blocker: WorkBlockerDto; base: string }) {
  const resolve = useDevMutation((args: { id: string; resolution?: string }) => apiClient.work.resolveBlocker(args.id, args.resolution));
  const [resolution, setResolution] = useState("");
  const [open, setOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resolution.length > 1000) return toast.error("A resolution is at most 1000 characters.");
    resolve.mutate({ id: b.id, resolution: resolution.trim() || undefined }, {
      onSuccess: () => { toast.success("Blocker cleared."); setOpen(false); },
      onError: (err) => toast.error(changeError(err)),
    });
  };

  return (
    <SurfaceCard className={`p-4 space-y-2 ${!b.resolved && b.severity === "CRITICAL" ? "border-l-4 border-l-rose-500" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <Link href={`${base}/tasks/${b.work_item_id}`} className="text-xs font-medium truncate hover:underline">
          <span className="font-mono text-blue-600 dark:text-blue-400">{b.work_item_key}</span> {b.work_item_title}
        </Link>
        <StatusBadge label={b.resolved ? "Resolved" : b.severity === "CRITICAL" ? "Critical" : "Normal"}
          tone={b.resolved ? "success" : b.severity === "CRITICAL" ? "danger" : "warning"} />
      </div>
      <p className="text-sm">{b.reason}</p>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Owner {b.owner?.email ?? "—"} · opened {dateTimeText(b.opened_at)} · {b.age_hours}h {b.resolved ? "to resolve" : "open"}
      </p>
      {b.resolution && <p className="text-xs text-[var(--color-text-secondary)]">Resolution: {b.resolution}</p>}
      {!b.resolved && !open && (
        <AdminButton size="xs" variant="outline" onClick={() => setOpen(true)}>Mark resolved</AdminButton>
      )}
      {!b.resolved && open && (
        <form onSubmit={submit} className="space-y-2" noValidate>
          <AdminInput aria-label="Resolution" placeholder="How was it resolved? (optional)" maxLength={1000}
            value={resolution} onChange={(e) => setResolution(e.target.value)} />
          <div className="flex gap-2">
            <AdminButton type="submit" size="xs" isLoading={resolve.isPending}>Resolve</AdminButton>
            <AdminButton type="button" size="xs" variant="ghost" onClick={() => setOpen(false)}>Cancel</AdminButton>
          </div>
        </form>
      )}
    </SurfaceCard>
  );
}

/* ------------------------------------------------------------------ issues */

const SEVERITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  CRITICAL: "danger", HIGH: "danger", MEDIUM: "warning", LOW: "info",
};
const NEXT_STATUS: Record<string, { value: string; label: string }[]> = {
  OPEN: [{ value: "IN_PROGRESS", label: "Start fixing" }, { value: "RESOLVED", label: "Resolve" }],
  REOPENED: [{ value: "IN_PROGRESS", label: "Start fixing" }, { value: "RESOLVED", label: "Resolve" }],
  IN_PROGRESS: [{ value: "RESOLVED", label: "Resolve" }],
  RESOLVED: [{ value: "REOPENED", label: "Reopen" }, { value: "CLOSED", label: "Close" }],
  CLOSED: [{ value: "REOPENED", label: "Reopen" }],
};

function IssueList({ base }: { base: string }) {
  const bugs = useDevBugs();
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <AdminButton size="sm" onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Report issue</AdminButton>
      </div>
      <DevGate state={bugs} what="Your issues" back={{ href: `${base}/dashboard`, label: "Back to dashboard" }}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyStateView icon={Bug} title="No issues assigned" description="Issues you report or are assigned appear here." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rows.map((bug) => <IssueCard key={bug.id} bug={bug} />)}
            </div>
          )
        }
      </DevGate>
      <ReportIssueModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function IssueCard({ bug }: { bug: DeveloperBug }) {
  const update = useDevMutation((args: { status: string; resolution?: string }) =>
    developerApi.updateBugStatus(bug.id, args.status, args.resolution));
  const [resolution, setResolution] = useState("");

  const move = (status: string) => {
    if (status === "RESOLVED" && !resolution.trim()) return toast.error("Describe the fix before resolving.");
    update.mutate({ status, resolution: status === "RESOLVED" ? resolution.trim() : undefined }, {
      onSuccess: () => { toast.success("Issue updated."); setResolution(""); },
      onError: (err) => toast.error(changeError(err)),
    });
  };
  const next = NEXT_STATUS[bug.status] ?? [];

  return (
    <SurfaceCard className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{bug.title}</p>
        <span className="flex gap-1 shrink-0">
          <StatusBadge label={bug.severity} tone={SEVERITY_TONE[bug.severity] ?? "neutral"} />
          <StatusBadge label={bug.status.replace("_", " ").toLowerCase()} tone={bug.status === "RESOLVED" || bug.status === "CLOSED" ? "success" : "info"} />
        </span>
      </div>
      {bug.description && <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap line-clamp-4">{bug.description}</p>}
      {bug.resolution && <p className="text-xs">Fix: {bug.resolution}</p>}
      <p className="text-[11px] text-[var(--color-text-muted)]">Reported {dateTimeText(bug.createdAt)}</p>
      {next.some((n) => n.value === "RESOLVED") && (
        <AdminInput aria-label="Fix description" placeholder="What fixed it?" maxLength={2000} value={resolution} onChange={(e) => setResolution(e.target.value)} />
      )}
      <div className="flex flex-wrap gap-2">
        {next.map((n) => (
          <AdminButton key={n.value} size="xs" variant="outline" isLoading={update.isPending} onClick={() => move(n.value)}>{n.label}</AdminButton>
        ))}
      </div>
    </SurfaceCard>
  );
}

function ReportIssueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const projects = useDevProjects();
  const create = useDevMutation((body: Parameters<typeof developerApi.createBug>[0]) => developerApi.createBug(body));
  const [form, setForm] = useState({ projectId: "", title: "", description: "", severity: "MEDIUM", reproductionSteps: "", environment: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.projectId) next.projectId = "Choose a project.";
    if (!form.title.trim()) next.title = "A title is required.";
    else if (form.title.trim().length > 200) next.title = "At most 200 characters.";
    if (!form.description.trim()) next.description = "Describe the issue.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    create.mutate(
      {
        projectId: form.projectId,
        title: form.title.trim(),
        description: form.description.trim(),
        severity: form.severity,
        reproductionSteps: form.reproductionSteps.trim() || undefined,
        environment: form.environment.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Issue reported.");
          setForm({ projectId: "", title: "", description: "", severity: "MEDIUM", reproductionSteps: "", environment: "" });
          onClose();
        },
        onError: (err) => toast.error(changeError(err)),
      },
    );
  };

  const projectOptions = projects.kind === "ready" ? projects.data.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })) : [];

  return (
    <AdminModal isOpen={open} onClose={onClose} title="Report an issue" description="The issue is assigned to you." maxWidth="lg">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <AdminSelect label="Project" value={form.projectId} onChange={set("projectId")} error={errors.projectId}
          options={[{ value: "", label: projects.kind === "loading" ? "Loading projects…" : "Choose a project" }, ...projectOptions]} />
        <AdminInput label="Title" value={form.title} onChange={set("title")} error={errors.title} maxLength={200} />
        <AdminTextarea label="Description" rows={3} value={form.description} onChange={set("description")} error={errors.description} />
        <AdminSelect label="Severity" value={form.severity} onChange={set("severity")}
          options={["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => ({ value: s, label: s.toLowerCase() }))} />
        <AdminTextarea label="Steps to reproduce (optional)" rows={2} value={form.reproductionSteps} onChange={set("reproductionSteps")} />
        <AdminInput label="Environment (optional)" value={form.environment} onChange={set("environment")} />
        <div className="flex justify-end gap-2">
          <AdminButton type="button" variant="ghost" onClick={onClose}>Cancel</AdminButton>
          <AdminButton type="submit" isLoading={create.isPending}><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Report</AdminButton>
        </div>
      </form>
    </AdminModal>
  );
}
