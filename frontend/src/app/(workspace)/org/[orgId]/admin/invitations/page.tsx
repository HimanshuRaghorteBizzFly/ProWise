"use client";

import React, { useMemo, useState } from "react";
import { Clock, Mail, MailCheck, MailX, UserPlus } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { ORG_NOW, type InviteStatus } from "@/mocks/org-console";
import { ButtonLink, DataTable, KpiGrid, KpiTile, PageFrame, SegmentTabs, StatusBadge, SurfaceCard, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { InviteStatusBadge, OrgGate, RoleChip, timeAgo, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

type F = "ALL" | InviteStatus;
const hoursLeft = (expiresAt: string) => Math.round((new Date(expiresAt).getTime() - new Date(ORG_NOW).getTime()) / 3600000);

export default function AdminInvitationsPage() {
  const href = useOrgHref("admin");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const all = useOrgConsoleStore((s) => s.invitations);
  const [filter, setFilter] = useState<F>("PENDING");
  const invites = useMemo(() => (forceEmpty ? [] : all), [all, forceEmpty]);
  const rows = invites.filter((i) => filter === "ALL" || i.status === filter).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  const count = (s: InviteStatus) => invites.filter((i) => i.status === s).length;
  const expiring = invites.filter((i) => i.status === "PENDING" && hoursLeft(i.expiresAt) < 72).length;

  return (
    <OrgGate family="admin" need="member.invite">
      <PageFrame
        crumbs={[{ label: "Admin", href: href() }, { label: "Invitations" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Pending invitations"
        description="Follow up on invitations before they expire. Soonest expiry first."
        status={status}
        onRetry={retry}
        skeleton="list"
        actions={<ButtonLink href={href("invitations/new")}><UserPlus className="w-3.5 h-3.5" /> Invite member</ButtonLink>}
      >
        <KpiGrid>
          <KpiTile label="Pending" value={count("PENDING")} icon={Mail} tone="amber" footer="Awaiting acceptance" href={href("invitations")} />
          <KpiTile label="Expiring < 72h" value={expiring} icon={Clock} tone="rose" chip={{ label: "Resend", tone: "danger" }} footer="Act soon" href={href("invitations")} />
          <KpiTile label="Accepted" value={count("ACCEPTED")} icon={MailCheck} tone="emerald" footer="Joined" href={href("invitations")} />
          <KpiTile label="Expired / revoked" value={count("EXPIRED") + count("REVOKED")} icon={MailX} tone="violet" footer="Closed" href={href("invitations")} />
        </KpiGrid>
        <SegmentTabs<F> value={filter} onChange={setFilter} options={[{ value: "PENDING", label: "Pending", count: count("PENDING") }, { value: "EXPIRED", label: "Expired", count: count("EXPIRED") }, { value: "ACCEPTED", label: "Accepted" }, { value: "REVOKED", label: "Revoked" }, { value: "ALL", label: "All", count: invites.length }]} />
        <SurfaceCard className="overflow-hidden">
          <DataTable
            rows={rows}
            rowHref={(i) => href(`invitations/${i.id}`)}
            empty={{ icon: Mail, title: "No invitations here", description: "Invite someone to get started." }}
            columns={[
              { key: "e", header: "Email", className: "w-[55%] md:w-[36%]", render: (i) => <div className="min-w-0"><p className="font-semibold truncate">{i.email}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">by {lk.member(i.invitedById)?.name} · {timeAgo(i.sentAt)}</p></div> },
              { key: "s", header: "Status", render: (i) => <InviteStatusBadge status={i.status} /> },
              { key: "x", header: "Expires", hideBelow: "sm", render: (i) => (i.status === "PENDING" ? <StatusBadge label={`${Math.max(0, hoursLeft(i.expiresAt))}h left`} tone={hoursLeft(i.expiresAt) < 72 ? "danger" : "info"} /> : <span className="text-[var(--color-text-muted)]">—</span>) },
              { key: "r", header: "Role", hideBelow: "md", render: (i) => <RoleChip role={lk.role(i.roleId)} /> },
              { key: "t", header: "Team", hideBelow: "xl", render: (i) => lk.team(i.teamId)?.name ?? "—" },
            ]}
          />
        </SurfaceCard>
      </PageFrame>
    </OrgGate>
  );
}
