"use client";

import React, { useMemo, useState } from "react";
import { ShieldOff, UserPlus, Users, UserX } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import type { MemberStatus } from "@/mocks/org-console";
import { AdminSelect, ButtonLink, FilterBar, KpiGrid, KpiTile, PageFrame, SegmentTabs, SurfaceCard, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { OrgGate, useOrgHref } from "@/components/org-console/OrgUI";
import { MemberTable } from "@/components/org-console/OrgWidgets";

type F = "ALL" | MemberStatus;

export default function OwnerMembersPage() {
  const href = useOrgHref("owner");
  const { status, retry, forceEmpty } = useDemoLoad();
  const all = useOrgConsoleStore((s) => s.members);
  const roles = useOrgConsoleStore((s) => s.roles);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<F>("ALL");
  const [roleId, setRoleId] = useState("ALL");
  const members = useMemo(() => (forceEmpty ? [] : all), [all, forceEmpty]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => (state === "ALL" || m.status === state) && (roleId === "ALL" || m.roleId === roleId) && (!q || m.name.toLowerCase().includes(q) || m.email.includes(q) || m.title.toLowerCase().includes(q)));
  }, [members, search, state, roleId]);
  const count = (s: MemberStatus) => members.filter((m) => m.status === s).length;

  return (
    <OrgGate family="owner" need="member.invite">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Members" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Members"
        description="Everyone in the organization. Open a member to change their role or access."
        status={status}
        onRetry={retry}
        skeleton="list"
        actions={<ButtonLink href={href("invitations/new")}><UserPlus className="w-3.5 h-3.5" /> Invite member</ButtonLink>}
      >
        <KpiGrid>
          <KpiTile label="Active" value={count("ACTIVE")} icon={Users} tone="emerald" footer="Active members" href={href("members")} />
          <KpiTile label="Suspended" value={count("SUSPENDED")} icon={UserX} tone="rose" footer="Review access" href={href("members")} />
          <KpiTile label="Disabled" value={count("DISABLED")} icon={UserX} tone="amber" footer="No access" href={href("members")} />
          <KpiTile label="Without MFA" value={members.filter((m) => m.status === "ACTIVE" && !m.mfa).length} icon={ShieldOff} tone="pink" chip={{ label: "MFA required", tone: "danger" }} footer="Security policy" href={href("organization")} />
        </KpiGrid>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, email or title"
          filters={<div className="w-full sm:w-52"><AdminSelect aria-label="Role" value={roleId} onChange={(e) => setRoleId(e.target.value)} options={[{ label: "All roles", value: "ALL" }, ...roles.map((r) => ({ label: r.name, value: r.id }))]} /></div>}
          hasActiveFilters={Boolean(search) || state !== "ALL" || roleId !== "ALL"}
          onResetFilters={() => { setSearch(""); setState("ALL"); setRoleId("ALL"); }}
        />
        <SegmentTabs<F> value={state} onChange={setState} options={[{ value: "ALL", label: "All", count: members.length }, { value: "ACTIVE", label: "Active", count: count("ACTIVE") }, { value: "SUSPENDED", label: "Suspended", count: count("SUSPENDED") }, { value: "DISABLED", label: "Disabled", count: count("DISABLED") }]} />
        <SurfaceCard className="overflow-hidden"><MemberTable family="owner" rows={rows} /></SurfaceCard>
      </PageFrame>
    </OrgGate>
  );
}
