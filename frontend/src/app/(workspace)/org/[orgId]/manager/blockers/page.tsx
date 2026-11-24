import { ModuleUnavailable } from "@/components/feedback/ModuleUnavailable";

<<<<<<< HEAD
import { previewEnabled } from "@/lib/permissions";
import { BlockersView, BlockerDetailView, DependenciesPageView } from "@/components/work/DependencyViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";
import { useParams } from "next/navigation";

import React, { useMemo, useState } from "react";
import { GitBranch, OctagonAlert, ShieldCheck } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS } from "@/mocks/delivery-dashboards";
import {
  Avatar,
  EmptyStateView,
  LinkRow,
  PageFrame,
  Panel,
  SegmentTabs,
  SeverityBadge,
  StatusBadge,
  SurfaceCard,
  daysFromToday,
  formatDate,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { HorizontalBarChart } from "@/components/delivery/DeliveryCharts";

function PreviewManagerBlockersPage() {
  const href = useRoleHref("manager");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const allProjects = useDeliveryStore((s) => s.projects);
  const allBlockers = useDeliveryStore((s) => s.blockers);
  const dependencies = useDeliveryStore((s) => s.dependencies);
  const [tab, setTab] = useState<"OPEN" | "RESOLVED">("OPEN");

  const projectIds = useMemo(() => new Set(allProjects.filter((p) => p.managerId === VIEWERS.manager.id).map((p) => p.id)), [allProjects]);
  const blockers = useMemo(() => (forceEmpty ? [] : allBlockers.filter((b) => projectIds.has(b.projectId))), [allBlockers, projectIds, forceEmpty]);
  const shown = blockers.filter((b) => b.status === tab).sort((a, b) => a.raisedAt.localeCompare(b.raisedAt));
  const atRiskDeps = forceEmpty ? [] : dependencies.filter((d) => d.status !== "RESOLVED");
  const open = blockers.filter((b) => b.status === "OPEN");

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "Delivery" }, { label: "Blockers" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Blockers & dependencies"
      description="What is stopping work across your projects, oldest first."
      status={status}
      onRetry={retry}
      skeleton="list"
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          className="xl:col-span-2"
          title="Blockers"
          description="Open a blocker to see its task"
          icon={OctagonAlert}
          iconTone="rose"
          action={<SegmentTabs<"OPEN" | "RESOLVED"> value={tab} onChange={setTab} options={[{ value: "OPEN", label: "Open", count: open.length }, { value: "RESOLVED", label: "Resolved", count: blockers.length - open.length }]} />}
        >
          {shown.length === 0 ? (
            <EmptyStateView icon={ShieldCheck} title={tab === "OPEN" ? "No open blockers" : "Nothing resolved yet"} description="Blockers raised by the team appear here." />
          ) : (
            <div className="space-y-2.5">
              {shown.map((b) => (
                <SurfaceCard key={b.id} className="p-0 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <LinkRow href={href(`work-items/${b.taskId}`)} className="mx-0 px-3.5 py-3 items-start">
                    <Avatar person={lk.person(b.ownerId)} size="sm" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold">{b.title}</p>
                        {b.status === "OPEN" ? <SeverityBadge severity={b.severity} /> : <StatusBadge label="Resolved" tone="success" />}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">{b.resolution ?? b.note}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {lk.task(b.taskId)?.key} · {lk.project(b.projectId)?.name} · owner {lk.person(b.ownerId)?.name} · raised {formatDate(b.raisedAt)} ({Math.abs(daysFromToday(b.raisedAt))}d)
                      </p>
                    </div>
                  </LinkRow>
                </SurfaceCard>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Days open" description="Age of each open blocker" icon={OctagonAlert} iconTone="amber">
          {open.length ? (
            <HorizontalBarChart unit="d" valueLabel="Days open" data={open.map((b) => ({ name: lk.task(b.taskId)?.key ?? b.id, value: Math.abs(daysFromToday(b.raisedAt)), color: b.severity === "CRITICAL" ? "#E11D48" : b.severity === "HIGH" ? "#F97316" : "#F59E0B" }))} />
          ) : (
            <p className="py-10 text-center text-xs text-[var(--color-text-muted)]">No open blockers.</p>
          )}
        </Panel>
      </div>

      <Panel title="Cross-task dependencies" description="Open or at-risk links between tasks" icon={GitBranch} iconTone="violet">
        {atRiskDeps.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No open dependencies.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
            {atRiskDeps.map((d) => (
              <LinkRow key={d.id} href={href(`work-items/${d.toTaskId}`)}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{lk.task(d.fromTaskId)?.key} → {lk.task(d.toTaskId)?.key}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">{d.note}</p>
                </div>
                {d.external && <StatusBadge label="Cross-team" tone="violet" className="hidden sm:inline-flex" />}
                <StatusBadge label={d.status === "AT_RISK" ? "At risk" : "Open"} tone={d.status === "AT_RISK" ? "danger" : "warning"} />
              </LinkRow>
            ))}
          </div>
        )}
      </Panel>
    </PageFrame>
  );
=======
/** No backend API serves this module yet, so the route shows a notice instead. */
export default function Page({ params }: { params: { orgId: string } }) {
  return <ModuleUnavailable module="Blockers" homeHref={`/org/${encodeURIComponent(params.orgId)}/manager`} homeLabel="Back to dashboard" />;
>>>>>>> 29db595 (Initial ProWise project upload)
}

/** Task 3.4: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function ManagerBlockersPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/manager`;
  if (previewEnabled()) return <PreviewManagerBlockersPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <BlockersView crumbs={[{ label: "Project Manager", href: home }]} back={{ href: home, label: "Back to dashboard" }} />
    </RequireAnyKey>
  );
}
