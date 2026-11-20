"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Mail, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { AdminButton, Avatar, NotFoundState, PageFrame, Panel, StatPill, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { InviteStatusBadge, OrgGate, RoleChip, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

export default function OwnerInvitationPage() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const href = useOrgHref("owner");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  const invite = useOrgConsoleStore((s) => s.invitations.find((i) => i.id === inviteId));
  const resend = useOrgConsoleStore((s) => s.resendInvite);
  const revoke = useOrgConsoleStore((s) => s.revokeInvite);
  const back = { href: href("invitations"), label: "Back to invitations" };
  const crumbs = [{ label: "Owner", href: href() }, { label: "Invitations", href: href("invitations") }, { label: invite?.email ?? "Invitation" }];

  if (status === "ready" && !invite) {
    return <OrgGate family="owner"><PageFrame crumbs={crumbs} back={back} title="Invitation"><NotFoundState what="Invitation" back={back} /></PageFrame></OrgGate>;
  }

  return (
    <OrgGate family="owner" need="member.invite">
      <PageFrame crumbs={crumbs} back={back} title={invite?.email ?? "Invitation"} description="Invitation details and delivery." status={status} onRetry={retry} skeleton="detail">
        {invite && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill label="Status" value={<InviteStatusBadge status={invite.status} />} />
              <StatPill label="Sent (UTC)" value={formatDateTime(invite.sentAt)} />
              <StatPill label="Expires (UTC)" value={formatDateTime(invite.expiresAt)} />
              <StatPill label="Resent" value={`${invite.resentCount}×`} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Panel className="xl:col-span-2" title="Invitation" icon={Mail}>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div><dt className="text-[var(--color-text-muted)]">Role on joining</dt><dd className="mt-1"><RoleChip role={lk.role(invite.roleId)} /></dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">Team</dt><dd className="mt-1 font-semibold">{lk.team(invite.teamId)?.name ?? "No team"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-[var(--color-text-muted)]">Invited by</dt><dd className="mt-1 flex items-center gap-2"><Avatar person={lk.member(invite.invitedById)} size="sm" /><span className="font-semibold">{lk.member(invite.invitedById)?.name}</span></dd></div>
                  <div className="sm:col-span-2"><dt className="text-[var(--color-text-muted)]">Message</dt><dd className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">{invite.message || "—"}</dd></div>
                </dl>
              </Panel>
              <Panel title="Actions" icon={RotateCcw} iconTone="amber" className="self-start">
                {invite.status === "ACCEPTED" ? (
                  <p className="text-xs text-[var(--color-text-secondary)]">Accepted — this person is now a member.</p>
                ) : (
                  <div className="space-y-2">
                    <AdminButton className="w-full" disabled={invite.status === "REVOKED"} onClick={() => { resend("owner", invite.id); toast.success(`Invitation resent to ${invite.email}`); }}>
                      <RotateCcw className="w-3.5 h-3.5" /> Resend invitation
                    </AdminButton>
                    <AdminButton className="w-full" variant="outline" disabled={invite.status === "REVOKED"} onClick={() => { revoke("owner", invite.id); toast.success("Invitation revoked"); }}>
                      <XCircle className="w-3.5 h-3.5 text-rose-500" /> Revoke
                    </AdminButton>
                  </div>
                )}
              </Panel>
            </div>
          </>
        )}
      </PageFrame>
    </OrgGate>
  );
}
