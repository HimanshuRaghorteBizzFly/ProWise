"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Crown, KeyRound, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { ORG_VIEWERS } from "@/mocks/org-console";
import { AdminButton, AdminInput, Avatar, PageFrame, Panel, StatusBadge, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { OrgGate, RoleChip, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";
import { cn } from "@/lib/utils";

export default function OwnerTransferOwnershipPage() {
  const href = useOrgHref("owner");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  const members = useOrgConsoleStore((s) => s.members);
  const settings = useOrgConsoleStore((s) => s.settings);
  const pending = useOrgConsoleStore((s) => s.pendingTransfer);
  const requestTransfer = useOrgConsoleStore((s) => s.requestTransfer);
  const cancelTransfer = useOrgConsoleStore((s) => s.cancelTransfer);
  const [target, setTarget] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState("");

  const eligible = useMemo(
    () => members.filter((m) => m.id !== ORG_VIEWERS.owner.id && m.status === "ACTIVE" && m.mfa && m.email.endsWith(`@${settings.domain}`)),
    [members, settings.domain]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return setError("Choose the new owner.");
    if (confirmName.trim() !== settings.name) return setError(`Type "${settings.name}" exactly to confirm.`);
    if (!ack) return setError("Confirm that you understand you will become an Org Admin.");
    setError("");
    requestTransfer(target);
    toast.success("Transfer started", { description: `${lk.member(target)?.name} must accept within 72 hours.` });
  };

  return (
    <OrgGate family="owner" need="org.ownership.transfer">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Organization" }, { label: "Transfer ownership" }]}
        back={{ href: href("organization"), label: "Back to organization settings" }}
        title="Transfer ownership"
        description="The new owner gets full control. You will become an Org Admin once they accept."
        status={status}
        onRetry={retry}
        skeleton="detail"
      >
        {pending ? (
          <Panel title="Transfer pending" icon={Crown} iconTone="amber">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar person={lk.member(pending.toMemberId)} />
              <div className="min-w-0 flex-1 text-xs"><p className="font-semibold">{lk.member(pending.toMemberId)?.name}</p><p className="text-[var(--color-text-muted)]">Started {formatDateTime(pending.requestedAt)} UTC · waiting for acceptance</p></div>
              <StatusBadge label="Awaiting acceptance" tone="warning" dot />
              <AdminButton variant="outline" onClick={() => { cancelTransfer(); toast.success("Transfer cancelled"); }}>Cancel transfer</AdminButton>
            </div>
          </Panel>
        ) : (
          <form onSubmit={submit} className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Panel className="xl:col-span-2" title="Choose the new owner" description="Only active members on your domain with MFA enabled are eligible." icon={KeyRound} iconTone="rose">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2" role="radiogroup" aria-label="New owner">
                {eligible.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={target === m.id} onClick={() => { setTarget(m.id); setError(""); }} className={cn("flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5", target === m.id ? "border-rose-500/60 bg-rose-500/10" : "border-[var(--color-border)] hover:bg-[var(--color-hover)]")}>
                    <Avatar person={m} size="sm" />
                    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold truncate">{m.name}</span><span className="block text-[10px] text-[var(--color-text-muted)] truncate">{m.title}</span></span>
                    <RoleChip role={lk.role(m.roleId)} />
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                <AdminInput label={`Type "${settings.name}" to confirm`} value={confirmName} onChange={(e) => { setConfirmName(e.target.value); setError(""); }} placeholder={settings.name} />
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={ack} onChange={(e) => { setAck(e.target.checked); setError(""); }} className="mt-0.5 accent-rose-600" />
                  <span>I understand I will lose owner-only powers (organization settings, data & privacy, ownership) when the transfer is accepted.</span>
                </label>
                {error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}
                <AdminButton type="submit" variant="danger"><Crown className="w-3.5 h-3.5" /> Start transfer</AdminButton>
              </div>
            </Panel>
            <div className="space-y-4">
              <Panel title="What happens" icon={ListChecks} iconTone="blue">
                <ol className="space-y-2 text-xs text-[var(--color-text-secondary)] list-decimal pl-4">
                  <li>The new owner receives an email and must accept within 72 hours.</li>
                  <li>On acceptance they become Owner; you become Org Admin.</li>
                  <li>Both of you are notified and the change is written to the audit log.</li>
                </ol>
              </Panel>
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>This cannot be undone by you after acceptance — only the new owner can transfer it back.</span>
              </div>
            </div>
          </form>
        )}
      </PageFrame>
    </OrgGate>
  );
}
