"use client";

import React, { useMemo, useState } from "react";
import { Lock, UserPlus } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { ORG_VIEWERS, type MemberStatus } from "@/mocks/org-console";
import { ButtonLink, FilterBar, PageFrame, Panel, SegmentTabs, SurfaceCard, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { DonutChart } from "@/components/delivery/DeliveryCharts";
import { OrgGate, useOrgHref } from "@/components/org-console/OrgUI";
import { MemberTable } from "@/components/org-console/OrgWidgets";
import { canManageMember } from "@/components/org-console/role-rules";

type F = "ALL" | MemberStatus | "NO_MFA";

export default function AdminMembersPage() {
  const href = useOrgHref("admin");
  const { status, retry, forceEmpty } = useDemoLoad();
  const all = useOrgConsoleStore((s) => s.members);
  const roles = useOrgConsoleStore((s) => s.roles);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<F>("ALL");
  const members = useMemo(() => (forceEmpty ? [] : all), [all, forceEmpty]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => (state === "ALL" || (state === "NO_MFA" ? m.status === "ACTIVE" && !m.mfa : m.status === state)) && (!q || m.name.toLowerCase().includes(q) || m.email.includes(q)));
  }, [members, search, state]);
  const locked = members.filter((m) => !canManageMember("admin", m, ORG_VIEWERS.admin.id, roles).ok);
  const count = (s: MemberStatus) => members.filter((m) => m.status === s).length;

  return (
    <OrgGate family="admin" need="member.disable">
      <PageFrame
        crumbs={[{ label: "Admin", href: href() }, { label: "Members" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Members"
        description="Member status and access. Open a member to disable them or assign a role within your powers."
        status={status}
        onRetry={retry}
        skeleton="list"
        actions={<ButtonLink href={href("invitations/new")}><UserPlus className="w-3.5 h-3.5" /> Invite member</ButtonLink>}
      >
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
          <div className="space-y-4">
            <Panel title="Status" icon={UserPlus}>
              <DonutChart height={160} centerLabel="members" data={[{ name: "Active", value: count("ACTIVE"), color: "#10B981" }, { name: "Suspended", value: count("SUSPENDED"), color: "#EF4444" }, { name: "Disabled", value: count("DISABLED"), color: "#94A3B8" }]} />
            </Panel>
            <Panel title="Outside your powers" icon={Lock} iconTone="amber">
              <p className="text-xs text-[var(--color-text-secondary)]">{locked.length} members hold a role above yours (or are you). Their access is read-only here.</p>
            </Panel>
          </div>
          <div className="xl:col-span-3 space-y-3">
            <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search name or email" hasActiveFilters={Boolean(search) || state !== "ALL"} onResetFilters={() => { setSearch(""); setState("ALL"); }} />
            <SegmentTabs<F> value={state} onChange={setState} options={[{ value: "ALL", label: "All", count: members.length }, { value: "ACTIVE", label: "Active", count: count("ACTIVE") }, { value: "NO_MFA", label: "No MFA", count: members.filter((m) => m.status === "ACTIVE" && !m.mfa).length }, { value: "SUSPENDED", label: "Suspended", count: count("SUSPENDED") }, { value: "DISABLED", label: "Disabled", count: count("DISABLED") }]} />
            <SurfaceCard className="overflow-hidden"><MemberTable family="admin" rows={rows} /></SurfaceCard>
          </div>
        </div>
      </PageFrame>
    </OrgGate>
  );
}
