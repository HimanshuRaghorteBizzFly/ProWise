"use client";

import React, { useMemo, useState } from "react";
import { Mail, UserPlus } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import type { InviteStatus } from "@/mocks/org-console";
import { ButtonLink, DataTable, PageFrame, Panel, SegmentTabs, SurfaceCard, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { DonutChart } from "@/components/delivery/DeliveryCharts";
import { InviteStatusBadge, OrgGate, RoleChip, timeAgo, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

type F = "ALL" | InviteStatus;

export default function OwnerInvitationsPage() {
  const href = useOrgHref("owner");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const all = useOrgConsoleStore((s) => s.invitations);
  const [filter, setFilter] = useState<F>("PENDING");
  const invites = useMemo(() => (forceEmpty ? [] : all), [all, forceEmpty]);
  const rows = invites.filter((i) => filter === "ALL" || i.status === filter);
  const count = (s: InviteStatus) => invites.filter((i) => i.status === s).length;

  return (
    <OrgGate family="owner" need="member.invite">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Invitations" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Invitations"
        description="Invitations sent by you and your admins. Open one to resend or revoke it."
        status={status}
        onRetry={retry}
        skeleton="list"
        actions={<ButtonLink href={href("invitations/new")}><UserPlus className="w-3.5 h-3.5" /> Invite member</ButtonLink>}
      >
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          <Panel title="Invitation outcomes" icon={Mail} iconTone="amber">
            <DonutChart centerLabel="sent" data={[{ name: "Pending", value: count("PENDING"), color: "#F59E0B" }, { name: "Accepted", value: count("ACCEPTED"), color: "#10B981" }, { name: "Expired", value: count("EXPIRED"), color: "#EF4444" }, { name: "Revoked", value: count("REVOKED"), color: "#94A3B8" }]} />
          </Panel>
          <div className="xl:col-span-2 space-y-3">
            <SegmentTabs<F> value={filter} onChange={setFilter} options={[{ value: "PENDING", label: "Pending", count: count("PENDING") }, { value: "EXPIRED", label: "Expired", count: count("EXPIRED") }, { value: "ACCEPTED", label: "Accepted" }, { value: "REVOKED", label: "Revoked" }, { value: "ALL", label: "All", count: invites.length }]} />
            <SurfaceCard className="overflow-hidden">
              <DataTable
                rows={rows}
                rowHref={(i) => href(`invitations/${i.id}`)}
                empty={{ icon: Mail, title: "No invitations here", description: "Invite someone to get started." }}
                columns={[
                  { key: "e", header: "Email", className: "w-[55%] md:w-[38%]", render: (i) => <div className="min-w-0"><p className="font-semibold truncate">{i.email}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">by {lk.member(i.invitedById)?.name} · {timeAgo(i.sentAt)}</p></div> },
                  { key: "s", header: "Status", render: (i) => <InviteStatusBadge status={i.status} /> },
                  { key: "r", header: "Role", hideBelow: "md", render: (i) => <RoleChip role={lk.role(i.roleId)} /> },
                  { key: "t", header: "Team", hideBelow: "xl", render: (i) => lk.team(i.teamId)?.name ?? "—" },
                  { key: "x", header: "Expires (UTC)", hideBelow: "lg", render: (i) => formatDateTime(i.expiresAt) },
                ]}
              />
            </SurfaceCard>
          </div>
        </div>
      </PageFrame>
    </OrgGate>
  );
}
