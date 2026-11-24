"use client";

import { previewEnabled } from "@/lib/permissions";
import { BlockersView, BlockerDetailView, DependenciesPageView } from "@/components/work/DependencyViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, ListChecks, OctagonAlert } from "lucide-react";
import { toast } from "sonner";
import { useDeliveryStore } from "@/store/delivery-store";
import {
  AdminButton,
  AdminTextarea,
  Avatar,
  LinkRow,
  NotFoundState,
  PageFrame,
  Panel,
  SeverityBadge,
  StatPill,
  StatusBadge,
  TaskStatusBadge,
  daysFromToday,
  formatDateTime,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { useLeadTeam } from "@/components/delivery/useLeadTeam";

function PreviewTeamLeadBlockerPage() {
  const { blockerId } = useParams<{ blockerId: string }>();
  const href = useRoleHref("lead");
  const { status, retry } = useDemoLoad();
  const lk = useLookups();
  const t = useLeadTeam();
  const resolve = useDeliveryStore((s) => s.resolveBlocker);
  const blocker = t.blockers.find((b) => b.id === blockerId);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const back = { href: href("blockers"), label: "Back to blockers" };
  const crumbs = [{ label: "Lead", href: href() }, { label: "Blockers", href: href("blockers") }, { label: blocker?.title ?? "Blocker" }];

  if (status === "ready" && !blocker) {
    return <PageFrame crumbs={crumbs} back={back} title="Blocker"><NotFoundState what="Blocker" back={back} /></PageFrame>;
  }

  const task = lk.task(blocker?.taskId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blocker) return;
    if (note.trim().length < 10) return setError("Describe how it was resolved (at least 10 characters).");
    setError("");
    setSaving(true);
    window.setTimeout(() => {
      resolve(blocker.id, note.trim());
      setSaving(false);
      toast.success("Blocker resolved", { description: task ? `${task.key} can move again.` : undefined });
    }, 450);
  };

  return (
    <PageFrame crumbs={crumbs} back={back} title={blocker?.title ?? "Blocker"} description={task ? `${task.key} · ${lk.project(task.projectId)?.name}` : undefined} status={status} onRetry={retry} skeleton="detail">
      {blocker && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill label="Severity" value={<SeverityBadge severity={blocker.severity} />} />
            <StatPill label="Status" value={blocker.status === "OPEN" ? "Open" : "Resolved"} tone={blocker.status === "OPEN" ? "danger" : "success"} />
            <StatPill label="Days open" value={Math.abs(daysFromToday(blocker.raisedAt))} />
            <StatPill label="Raised" value={formatDateTime(blocker.raisedAt)} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Panel className="xl:col-span-2" title="What is blocked" icon={OctagonAlert} iconTone="rose">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{blocker.note}</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2"><Avatar person={lk.person(blocker.raisedById)} size="sm" /><span>Raised by <b>{lk.person(blocker.raisedById)?.name}</b></span></div>
                <div className="flex items-center gap-2"><Avatar person={lk.person(blocker.ownerId)} size="sm" /><span>Owner <b>{lk.person(blocker.ownerId)?.name}</b></span></div>
              </div>
              {task && (
                <div className="mt-4">
                  <LinkRow href={href(`work-items/${task.id}`)} className="border border-[var(--color-border)] bg-[var(--color-app-bg)] mx-0">
                    <ListChecks className="w-4 h-4 text-violet-500 shrink-0" />
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{task.key} · {task.title}</p><p className="text-[11px] text-[var(--color-text-muted)]">{lk.person(task.assigneeId)?.name ?? "Unassigned"}</p></div>
                    <TaskStatusBadge status={task.status} />
                  </LinkRow>
                </div>
              )}
            </Panel>
            <Panel title={blocker.status === "OPEN" ? "Resolve blocker" : "Resolution"} icon={CheckCircle2} iconTone="emerald">
              {blocker.status === "OPEN" ? (
                <form onSubmit={submit} className="space-y-3">
                  <AdminTextarea label="Resolution note" rows={4} placeholder="What unblocked it? Any follow-up?" value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} error={error} />
                  <AdminButton type="submit" className="w-full" isLoading={saving}><CheckCircle2 className="w-3.5 h-3.5" /> Mark resolved</AdminButton>
                </form>
              ) : (
                <div className="space-y-2"><StatusBadge label="Resolved" tone="success" dot /><p className="text-xs text-[var(--color-text-secondary)]">{blocker.resolution}</p></div>
              )}
            </Panel>
          </div>
        </>
      )}
    </PageFrame>
  );
}

/** Task 3.4: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function TeamLeadBlockerPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/lead`;
  if (previewEnabled()) return <PreviewTeamLeadBlockerPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <BlockerDetailView blockerId={(params?.blockerId as string) ?? ""} crumbs={[{ label: "Team Lead", href: home }, { label: "Blockers", href: `${home}/blockers` }]}
        back={{ href: `${home}/blockers`, label: "Back to blockers" }} />
    </RequireAnyKey>
  );
}
