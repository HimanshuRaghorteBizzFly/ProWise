import { ModuleUnavailable } from "@/components/feedback/ModuleUnavailable";

<<<<<<< HEAD
import { previewEnabled } from "@/lib/permissions";
import { ReviewQueueView } from "@/components/work/ReviewViews";
import { useParams } from "next/navigation";

import React, { useMemo, useState } from "react";
import { GitPullRequestArrow } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS, type Priority } from "@/mocks/delivery-dashboards";
import {
  AdminSelect,
  Avatar,
  DataTable,
  FilterBar,
  PageFrame,
  PriorityBadge,
  SegmentTabs,
  StatusBadge,
  SurfaceCard,
  formatWaiting,
  hoursSince,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";

type PFilter = "ALL" | Priority;

function PreviewReviewerQueuePage() {
  const href = useRoleHref("reviewer");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const allReviews = useDeliveryStore((s) => s.reviews);
  const evidence = useDeliveryStore((s) => s.evidence);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<PFilter>("ALL");
  const [projectId, setProjectId] = useState("ALL");

  const queue = useMemo(
    () => (forceEmpty ? [] : allReviews.filter((r) => r.reviewerId === VIEWERS.reviewer.id && r.status === "PENDING").map((r) => ({ ...r, waited: hoursSince(r.submittedAt) }))),
    [allReviews, forceEmpty]
  );
  const projectOptions = Array.from(new Set(queue.map((r) => r.projectId)));
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rank: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    return queue
      .filter((r) => (priority === "ALL" || r.priority === priority) && (projectId === "ALL" || r.projectId === projectId))
      .filter((r) => !q || r.code.toLowerCase().includes(q) || (lk.task(r.taskId)?.title.toLowerCase().includes(q) ?? false) || (lk.person(r.submittedById)?.name.toLowerCase().includes(q) ?? false))
      .sort((a, b) => rank.indexOf(a.priority) - rank.indexOf(b.priority) || b.waited - a.waited);
  }, [queue, search, priority, projectId, lk]);

  return (
    <PageFrame
      crumbs={[{ label: "QA", href: href() }, { label: "Review queue" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Review queue"
      description="Submissions waiting for your decision, highest priority first."
      status={status}
      onRetry={retry}
      skeleton="list"
    >
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search code, task or developer"
        filters={
          <div className="w-full sm:w-52">
            <AdminSelect aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} options={[{ label: "All projects", value: "ALL" }, ...projectOptions.map((id) => ({ label: lk.project(id)?.name ?? id, value: id }))]} />
          </div>
        }
        hasActiveFilters={Boolean(search) || priority !== "ALL" || projectId !== "ALL"}
        onResetFilters={() => { setSearch(""); setPriority("ALL"); setProjectId("ALL"); }}
      />
      <SegmentTabs<PFilter>
        value={priority}
        onChange={setPriority}
        options={[
          { value: "ALL", label: "All", count: queue.length },
          ...(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Priority[]).map((p) => ({ value: p, label: p[0] + p.slice(1).toLowerCase(), count: queue.filter((r) => r.priority === p).length })),
        ]}
      />
      <SurfaceCard className="overflow-hidden">
        <DataTable
          rows={rows}
          rowHref={(r) => href(`reviews/${r.id}`)}
          empty={{ icon: GitPullRequestArrow, title: queue.length ? "No reviews match" : "Queue is empty", description: queue.length ? "Change filters to see more." : "New submissions will appear here." }}
          columns={[
            { key: "t", header: "Submission", className: "w-[52%] md:w-[36%]", render: (r) => <div className="min-w-0"><p className="font-semibold truncate">{lk.task(r.taskId)?.title}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{r.code} · {lk.task(r.taskId)?.key} · round {r.round}</p></div> },
            { key: "p", header: "Priority", render: (r) => <PriorityBadge priority={r.priority} /> },
            { key: "d", header: "Developer", hideBelow: "md", render: (r) => <span className="flex items-center gap-2 min-w-0"><Avatar person={lk.person(r.submittedById)} size="sm" /><span className="truncate">{lk.person(r.submittedById)?.name}</span></span> },
            { key: "e", header: "Evidence", hideBelow: "lg", render: (r) => { const ev = evidence.filter((e) => e.reviewId === r.id); const todo = ev.filter((e) => e.status === "TO_INSPECT").length; return <span className="tabular-nums">{ev.length} items{todo ? <span className="text-violet-600 dark:text-violet-400"> · {todo} to inspect</span> : ""}</span>; } },
            { key: "w", header: "Waiting", hideBelow: "sm", render: (r) => <StatusBadge label={formatWaiting(r.waited)} tone={r.waited >= 96 ? "danger" : r.waited >= 48 ? "warning" : "success"} dot /> },
          ]}
        />
      </SurfaceCard>
    </PageFrame>
  );
=======
/** No backend API serves this module yet, so the route shows a notice instead. */
export default function Page({ params }: { params: { orgId: string } }) {
  return <ModuleUnavailable module="Review queue" homeHref={`/org/${encodeURIComponent(params.orgId)}/reviewer`} homeLabel="Back to dashboard" />;
>>>>>>> 29db595 (Initial ProWise project upload)
}

/** Task 3.3: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function ReviewerQueuePage() {
  const params = useParams();
  const home = `/org/${(params?.orgId as string) || ""}/reviewer`;
  return previewEnabled() ? <PreviewReviewerQueuePage /> : (
    <ReviewQueueView crumbs={[{ label: "Reviewer", href: home }]} back={{ href: home, label: "Back to dashboard" }} />
  );
}
