import { ModuleUnavailable } from "@/components/feedback/ModuleUnavailable";

<<<<<<< HEAD
import { previewEnabled } from "@/lib/permissions";
import { ScopeListView, ScopeDetailView } from "@/components/work/ScopeViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";
import { useParams } from "next/navigation";

import React, { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS, type ScopeChange } from "@/mocks/delivery-dashboards";
import {
  DataTable,
  KpiGrid,
  KpiTile,
  PageFrame,
  SegmentTabs,
  StatusBadge,
  SurfaceCard,
  formatDate,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";

type Filter = "ALL" | ScopeChange["status"];
const SCOPE_TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;
const SCOPE_LABEL = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" } as const;

function PreviewManagerScopePage() {
  const href = useRoleHref("manager");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const allProjects = useDeliveryStore((s) => s.projects);
  const allChanges = useDeliveryStore((s) => s.scopeChanges);
  const [filter, setFilter] = useState<Filter>("PENDING");

  const changes = useMemo(() => {
    if (forceEmpty) return [];
    const ids = new Set(allProjects.filter((p) => p.managerId === VIEWERS.manager.id).map((p) => p.id));
    return allChanges.filter((c) => ids.has(c.projectId));
  }, [allProjects, allChanges, forceEmpty]);
  const rows = changes.filter((c) => filter === "ALL" || c.status === filter);
  const pending = changes.filter((c) => c.status === "PENDING");

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "Delivery" }, { label: "Scope changes" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Scope changes"
      description="Requests that add or remove work. Open one to approve or reject it with a note."
      status={status}
      onRetry={retry}
      skeleton="list"
    >
      <KpiGrid>
        <KpiTile label="Pending decision" value={pending.length} icon={Scale} tone="amber" chip={{ label: `+${pending.reduce((s, c) => s + c.impactDays, 0)}d`, tone: "warning" }} footer="Decide now" href={href("scope")} />
        <KpiTile label="Approved" value={changes.filter((c) => c.status === "APPROVED").length} icon={Scale} tone="emerald" footer="Accepted changes" href={href("scope")} />
        <KpiTile label="Rejected" value={changes.filter((c) => c.status === "REJECTED").length} icon={Scale} tone="rose" footer="Declined changes" href={href("scope")} />
        <KpiTile label="Hours at stake" value={`${pending.reduce((s, c) => s + c.impactHours, 0)}h`} icon={Scale} tone="cyan" footer="If all approved" href={href("scope")} />
      </KpiGrid>
      <SegmentTabs<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "PENDING", label: "Pending", count: pending.length },
          { value: "APPROVED", label: "Approved" },
          { value: "REJECTED", label: "Rejected" },
          { value: "ALL", label: "All", count: changes.length },
        ]}
      />
      <SurfaceCard className="overflow-hidden">
        <DataTable
          rows={rows}
          rowHref={(c) => href(`scope/${c.id}`)}
          empty={{ icon: Scale, title: "No scope changes", description: "Nothing in this list right now." }}
          columns={[
            { key: "t", header: "Change", className: "w-[55%] md:w-[38%]", render: (c) => <div className="min-w-0"><p className="font-semibold truncate">{c.title}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{c.code} · {lk.project(c.projectId)?.name}</p></div> },
            { key: "s", header: "Status", render: (c) => <StatusBadge label={SCOPE_LABEL[c.status]} tone={SCOPE_TONE[c.status]} dot /> },
            { key: "i", header: "Impact", hideBelow: "sm", render: (c) => <span className={`font-semibold tabular-nums ${c.impactDays > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>{c.impactDays > 0 ? "+" : ""}{c.impactDays}d · {c.impactHours}h</span> },
            { key: "r", header: "Requested by", hideBelow: "lg", render: (c) => <span className="truncate block">{c.requestedBy}</span> },
            { key: "d", header: "Date", hideBelow: "md", render: (c) => formatDate(c.requestedAt, true) },
          ]}
        />
      </SurfaceCard>
    </PageFrame>
  );
=======
/** No backend API serves this module yet, so the route shows a notice instead. */
export default function Page({ params }: { params: { orgId: string } }) {
  return <ModuleUnavailable module="Scope changes" homeHref={`/org/${encodeURIComponent(params.orgId)}/manager`} homeLabel="Back to dashboard" />;
>>>>>>> 29db595 (Initial ProWise project upload)
}

/** Task 3.2: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function ManagerScopePage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/manager`;
  if (previewEnabled()) return <PreviewManagerScopePage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <ScopeListView crumbs={[{ label: "Project Manager", href: home }]} back={{ href: home, label: "Back to dashboard" }}
        detailHref={(entry) => `${home}/scope/${entry.version.id}`} />
    </RequireAnyKey>
  );
}
