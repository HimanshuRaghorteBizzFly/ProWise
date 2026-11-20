"use client";

import React, { useMemo, useState } from "react";
import { Activity, Download, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { AUDIT_ACTIVITY, type AuditCategory, type AuditEvent } from "@/mocks/org-console";
import { AdminButton, AdminSelect, FilterBar, KpiGrid, KpiTile, PageFrame, Panel, SegmentTabs, SurfaceCard, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { DonutChart, GroupedBarChart } from "@/components/delivery/DeliveryCharts";
import { OrgGate, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";
import { AuditTable } from "@/components/org-console/OrgWidgets";
import { downloadCsv, generateCsv } from "@/lib/csv";

type Sev = "ALL" | AuditEvent["severity"];
const CATS: AuditCategory[] = ["SECURITY", "MEMBER", "ROLE", "PROJECT", "INTEGRATION", "SETTINGS"];
const CAT_COLOR: Record<AuditCategory, string> = { SECURITY: "#EF4444", MEMBER: "#3B82F6", ROLE: "#F59E0B", PROJECT: "#10B981", INTEGRATION: "#06B6D4", SETTINGS: "#8B5CF6" };

export default function OwnerAuditPage() {
  const href = useOrgHref("owner");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const all = useOrgConsoleStore((s) => s.audit);
  const [search, setSearch] = useState("");
  const [sev, setSev] = useState<Sev>("ALL");
  const [cat, setCat] = useState("ALL");
  const events = useMemo(() => (forceEmpty ? [] : [...all].sort((a, b) => b.at.localeCompare(a.at))), [all, forceEmpty]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => (sev === "ALL" || e.severity === sev) && (cat === "ALL" || e.category === cat) && (!q || e.action.includes(q) || e.target.toLowerCase().includes(q) || (lk.member(e.actorId)?.name.toLowerCase().includes(q) ?? false)));
  }, [events, search, sev, cat, lk]);

  const exportCsv = () => {
    downloadCsv("audit-log.csv", generateCsv(["When (UTC)", "Actor", "Action", "Target", "Category", "Severity", "IP"], rows.map((e) => [e.at, lk.member(e.actorId)?.name ?? e.actorId, e.action, e.target, e.category, e.severity, e.ip])));
    toast.success(`Exported ${rows.length} events`);
  };

  return (
    <OrgGate family="owner" need="audit.read">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Audit & security" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Audit & security log"
        description="Every sensitive change, sign-in anomaly and access decision. Times in UTC."
        status={status}
        onRetry={retry}
        skeleton="list"
        actions={<AdminButton variant="outline" onClick={exportCsv} disabled={rows.length === 0}><Download className="w-3.5 h-3.5" /> Export CSV</AdminButton>}
      >
        <KpiGrid>
          <KpiTile label="Events" value={events.length} icon={Activity} tone="blue" footer="All recorded" href={href("audit-logs")} />
          <KpiTile label="Critical" value={events.filter((e) => e.severity === "CRITICAL").length} icon={ShieldAlert} tone="rose" chip={{ label: "Review", tone: "danger" }} footer="Security events" href={href("audit-logs")} />
          <KpiTile label="Warnings" value={events.filter((e) => e.severity === "WARNING").length} icon={ShieldAlert} tone="amber" footer="Policy & role changes" href={href("audit-logs")} />
          <KpiTile label="Latest" value={events[0] ? formatDateTime(events[0].at).split(", ")[1] ?? "—" : "—"} icon={Activity} tone="teal" footer={events[0] ? `${lk.member(events[0].actorId)?.name}` : "No events"} href={events[0] ? href(`audit-logs/${events[0].id}`) : href("audit-logs")} />
        </KpiGrid>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel className="xl:col-span-2" title="Weekly activity" description="All events vs critical" icon={Activity}>
            <GroupedBarChart data={AUDIT_ACTIVITY} primaryLabel="Events" secondaryLabel="Critical" primaryColor="#3B82F6" secondaryColor="#EF4444" height={200} />
          </Panel>
          <Panel title="By category" icon={ShieldAlert} iconTone="violet">
            <DonutChart height={170} centerLabel="events" data={CATS.map((c) => ({ name: c[0] + c.slice(1).toLowerCase(), value: events.filter((e) => e.category === c).length, color: CAT_COLOR[c] }))} />
          </Panel>
        </div>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search actor, action or target"
          filters={<div className="w-full sm:w-48"><AdminSelect aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} options={[{ label: "All categories", value: "ALL" }, ...CATS.map((c) => ({ label: c[0] + c.slice(1).toLowerCase(), value: c }))]} /></div>}
          hasActiveFilters={Boolean(search) || sev !== "ALL" || cat !== "ALL"}
          onResetFilters={() => { setSearch(""); setSev("ALL"); setCat("ALL"); }}
        />
        <SegmentTabs<Sev> value={sev} onChange={setSev} options={[{ value: "ALL", label: "All", count: events.length }, { value: "CRITICAL", label: "Critical" }, { value: "WARNING", label: "Warning" }, { value: "INFO", label: "Info" }]} />
        <SurfaceCard className="overflow-hidden"><AuditTable family="owner" rows={rows} /></SurfaceCard>
      </PageFrame>
    </OrgGate>
  );
}
