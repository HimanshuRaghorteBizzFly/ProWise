"use client";

import React, { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { AUDIT_ACTIVITY, type AuditCategory } from "@/mocks/org-console";
import { FilterBar, PageFrame, Panel, SegmentTabs, SurfaceCard, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { GroupedBarChart } from "@/components/delivery/DeliveryCharts";
import { OrgGate, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";
import { AuditTable } from "@/components/org-console/OrgWidgets";

/** Admins see people, role, project and integration activity; organization-settings events stay with the owner. */
const ADMIN_CATS: AuditCategory[] = ["MEMBER", "ROLE", "SECURITY", "INTEGRATION", "PROJECT"];
type F = "ALL" | AuditCategory;

export default function AdminAuditPage() {
  const href = useOrgHref("admin");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const all = useOrgConsoleStore((s) => s.audit);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<F>("ALL");
  const events = useMemo(() => (forceEmpty ? [] : all.filter((e) => ADMIN_CATS.includes(e.category)).sort((a, b) => b.at.localeCompare(a.at))), [all, forceEmpty]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => (cat === "ALL" || e.category === cat) && (!q || e.action.includes(q) || e.target.toLowerCase().includes(q) || (lk.member(e.actorId)?.name.toLowerCase().includes(q) ?? false)));
  }, [events, search, cat, lk]);

  return (
    <OrgGate family="admin" need="audit.read">
      <PageFrame
        crumbs={[{ label: "Admin", href: href() }, { label: "Audit activity" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Audit activity"
        description="Who changed members, roles, teams and integrations, and when (UTC)."
        status={status}
        onRetry={retry}
        skeleton="list"
      >
        <Panel title="Weekly activity" icon={Activity} iconTone="teal">
          <GroupedBarChart data={AUDIT_ACTIVITY} primaryLabel="Events" secondaryLabel="Critical" primaryColor="#14B8A6" secondaryColor="#EF4444" height={180} />
        </Panel>
        <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search actor, action or target" hasActiveFilters={Boolean(search) || cat !== "ALL"} onResetFilters={() => { setSearch(""); setCat("ALL"); }} />
        <SegmentTabs<F> value={cat} onChange={setCat} options={[{ value: "ALL", label: "All", count: events.length }, ...ADMIN_CATS.map((c) => ({ value: c, label: c[0] + c.slice(1).toLowerCase(), count: events.filter((e) => e.category === c).length }))]} />
        <SurfaceCard className="overflow-hidden"><AuditTable family="admin" rows={rows} /></SurfaceCard>
      </PageFrame>
    </OrgGate>
  );
}
