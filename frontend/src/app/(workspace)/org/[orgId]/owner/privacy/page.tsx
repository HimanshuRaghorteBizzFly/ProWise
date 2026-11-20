"use client";

import React, { useEffect, useState } from "react";
import { Archive, Database, Download, Server, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { AdminButton, AdminSelect, Avatar, PageFrame, Panel, StatusBadge, formatDate, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { OrgGate, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

const DAYS = [30, 90, 180, 365, 730, 1095];

export default function OwnerPrivacyPage() {
  const href = useOrgHref("owner");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  const privacy = useOrgConsoleStore((s) => s.privacy);
  const updateRetention = useOrgConsoleStore((s) => s.updateRetention);
  const requestExport = useOrgConsoleStore((s) => s.requestExport);
  const [audit, setAudit] = useState(privacy.auditRetentionDays);
  const [activity, setActivity] = useState(privacy.activityRetentionDays);
  const [deleted, setDeleted] = useState(privacy.deletedMemberRetentionDays);
  const [scope, setScope] = useState("Full organization export");
  useEffect(() => { setAudit(privacy.auditRetentionDays); setActivity(privacy.activityRetentionDays); setDeleted(privacy.deletedMemberRetentionDays); }, [privacy]);
  const dirty = audit !== privacy.auditRetentionDays || activity !== privacy.activityRetentionDays || deleted !== privacy.deletedMemberRetentionDays;

  return (
    <OrgGate family="owner" need="org.privacy.manage">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Data & privacy" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Data & privacy"
        description="How long data is kept, exports of organization data, and personal-data deletion requests."
        status={status}
        onRetry={retry}
        skeleton="detail"
      >
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel className="xl:col-span-2" title="Retention" description="Audit retention below 365 days may break SOC 2 evidence." icon={Archive} iconTone="violet">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AdminSelect label="Audit log" value={audit} onChange={(e) => setAudit(Number(e.target.value))} options={DAYS.map((d) => ({ label: `${d} days`, value: d }))} />
              <AdminSelect label="Activity & evidence" value={activity} onChange={(e) => setActivity(Number(e.target.value))} options={DAYS.map((d) => ({ label: `${d} days`, value: d }))} />
              <AdminSelect label="Removed members" value={deleted} onChange={(e) => setDeleted(Number(e.target.value))} options={[7, 14, 30, 60].map((d) => ({ label: `${d} days`, value: d }))} />
            </div>
            {audit < 365 && <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-300">Warning: audit history shorter than one year.</p>}
            <div className="mt-4 flex justify-end">
              <AdminButton disabled={!dirty} onClick={() => { updateRetention({ auditRetentionDays: audit, activityRetentionDays: activity, deletedMemberRetentionDays: deleted }); toast.success("Retention updated"); }}>Save retention</AdminButton>
            </div>
          </Panel>
          <Panel title="Request an export" icon={Download} iconTone="blue">
            <div className="space-y-3">
              <AdminSelect label="Scope" value={scope} onChange={(e) => setScope(e.target.value)} options={["Full organization export", "Members & roles", "Audit log (last 12 months)", "Projects & evidence"].map((s) => ({ label: s, value: s }))} />
              <AdminButton className="w-full" onClick={() => { requestExport(scope); toast.success("Export requested", { description: "You'll be notified when it is ready (usually under 15 minutes)." }); }}><Download className="w-3.5 h-3.5" /> Request export</AdminButton>
              <p className="text-[10px] text-[var(--color-text-muted)]">Download links expire after 7 days and are logged in the audit trail.</p>
            </div>
          </Panel>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Exports" icon={Database} iconTone="cyan">
            <div className="space-y-2">
              {privacy.exportRequests.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No exports yet.</p>}
              {privacy.exportRequests.map((x) => (
                <div key={x.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5">
                  <Avatar person={lk.member(x.requestedById)} size="sm" />
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{x.scope}</p><p className="text-[11px] text-[var(--color-text-muted)]">{lk.member(x.requestedById)?.name} · {formatDateTime(x.requestedAt)} UTC</p></div>
                  <StatusBadge label={x.status === "READY" ? "Ready" : x.status === "PROCESSING" ? "Processing" : "Expired"} tone={x.status === "READY" ? "success" : x.status === "PROCESSING" ? "info" : "neutral"} dot />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Deletion requests" description="Personal data erasure, 30-day deadline" icon={Trash2} iconTone="rose">
            <div className="space-y-2">
              {privacy.deletionRequests.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5">
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{d.subject}</p><p className="text-[11px] text-[var(--color-text-muted)]">Requested {formatDate(d.requestedAt, true)} · due {formatDate(d.dueAt, true)}</p></div>
                  <StatusBadge label={d.status === "PENDING" ? "Pending" : "Completed"} tone={d.status === "PENDING" ? "warning" : "success"} dot />
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <Panel title="Sub-processors" icon={Server} iconTone="amber">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {privacy.subProcessors.map((p) => (
              <div key={p.name} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3"><p className="text-xs font-semibold">{p.name}</p><p className="text-[11px] text-[var(--color-text-muted)]">{p.purpose} · {p.region}</p></div>
            ))}
          </div>
        </Panel>
      </PageFrame>
    </OrgGate>
  );
}
