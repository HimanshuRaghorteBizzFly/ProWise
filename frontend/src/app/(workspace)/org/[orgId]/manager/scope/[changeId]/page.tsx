"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, FileText, Gavel, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useDeliveryStore } from "@/store/delivery-store";
import {
  AdminButton,
  AdminTextarea,
  HealthBadge,
  NotFoundState,
  PageFrame,
  Panel,
  ProgressBar,
  StatPill,
  StatusBadge,
  formatDate,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";

const TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;
const LABEL = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" } as const;

export default function ManagerScopeChangePage() {
  const { changeId } = useParams<{ changeId: string }>();
  const href = useRoleHref("manager");
  const { status, retry } = useDemoLoad();
  const lk = useLookups();
  const change = useDeliveryStore((s) => s.scopeChanges.find((c) => c.id === changeId));
  const decide = useDeliveryStore((s) => s.decideScopeChange);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"APPROVED" | "REJECTED" | null>(null);

  const back = { href: href("scope"), label: "Back to scope changes" };
  const crumbs = [{ label: "Manager", href: href() }, { label: "Scope changes", href: href("scope") }, { label: change?.code ?? "Change" }];

  if (status === "ready" && !change) {
    return <PageFrame crumbs={crumbs} back={back} title="Scope change"><NotFoundState what="Scope change" back={back} /></PageFrame>;
  }

  const project = lk.project(change?.projectId);

  const submit = (decision: "APPROVED" | "REJECTED") => {
    if (!change) return;
    if (note.trim().length < 10) {
      setError("Add a short decision note (at least 10 characters) so the team knows why.");
      return;
    }
    setError("");
    setSaving(decision);
    window.setTimeout(() => {
      decide(change.id, decision, note.trim());
      setSaving(null);
      toast.success(`${change.code} ${decision === "APPROVED" ? "approved" : "rejected"}`);
    }, 450);
  };

  return (
    <PageFrame
      crumbs={crumbs}
      back={back}
      title={change?.title ?? "Scope change"}
      description={change && project ? `${change.code} · ${project.name} · requested ${formatDate(change.requestedAt, true)}` : undefined}
      status={status}
      onRetry={retry}
      skeleton="detail"
    >
      {change && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill label="Status" value={<StatusBadge label={LABEL[change.status]} tone={TONE[change.status]} dot />} />
            <StatPill label="Schedule impact" value={`${change.impactDays > 0 ? "+" : ""}${change.impactDays} days`} tone={change.impactDays > 0 ? "warning" : "success"} />
            <StatPill label="Effort impact" value={`${change.impactHours > 0 ? "+" : ""}${change.impactHours}h`} />
            <StatPill label="Requested by" value={change.requestedBy} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Panel className="xl:col-span-2" title="Request" icon={FileText} iconTone="cyan">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{change.reason}</p>
              {project && (
                <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold">{project.name}</p>
                    <HealthBadge health={project.health} />
                  </div>
                  <ProgressBar value={project.progress} planned={project.plannedProgress} color={project.color} showLabel />
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Current delivery {formatDate(project.dueDate, true)}
                    {change.impactDays !== 0 && ` → about ${change.impactDays > 0 ? "+" : ""}${change.impactDays} working days if approved`}
                  </p>
                </div>
              )}
            </Panel>
            <Panel title="Decision" icon={Gavel} iconTone="amber">
              {change.status === "PENDING" ? (
                <div className="space-y-3">
                  <AdminTextarea label="Decision note" rows={4} placeholder="Why approve or reject? What changes in the plan?" value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} error={error} />
                  <div className="grid grid-cols-2 gap-2">
                    <AdminButton variant="danger" isLoading={saving === "REJECTED"} disabled={saving !== null} onClick={() => submit("REJECTED")}>
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </AdminButton>
                    <AdminButton isLoading={saving === "APPROVED"} disabled={saving !== null} onClick={() => submit("APPROVED")}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </AdminButton>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <StatusBadge label={LABEL[change.status]} tone={TONE[change.status]} dot />
                  <p className="text-xs text-[var(--color-text-secondary)]">{change.decisionNote}</p>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </PageFrame>
  );
}
