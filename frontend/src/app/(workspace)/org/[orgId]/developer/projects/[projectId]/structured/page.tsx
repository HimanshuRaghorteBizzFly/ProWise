"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, AlertTriangle, History, ListTree } from "lucide-react";

import type { StructuredProgressDto, WorkBlockerDto, WorkItemDto } from "@/types/work";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { EmptyStateView, PageFrame, Panel, ProgressBar, SegmentTabs, StatPill, StatusBadge } from "@/components/delivery/DeliveryUI";
import { DevGate, SectionGate, WorkStateBadge, dateText, dateTimeText, isOverdue } from "@/components/developer/DevUI";
import {
  useDevProject,
  useMyWorkItems,
  useProjectBlockers,
  useProjectWorkItems,
  useStructuredProgress,
} from "@/components/developer/useDeveloperData";

function num(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function ProgressSummary({ progress }: { progress: StructuredProgressDto }) {
  const measurable = progress.percent !== null;
  return (
    <Panel title="Structured progress" icon={Activity} iconTone="violet" description="Calculated by the server from the approved baseline">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-3xl font-bold tabular-nums text-[var(--color-text-primary)]" data-testid="structured-percent">
            {measurable ? `${progress.percent}%` : "Not measurable"}
          </p>
          <span className="text-xs text-[var(--color-text-secondary)]">{progress.label}</span>
        </div>
        {measurable && <ProgressBar value={progress.percent ?? 0} />}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatPill label="Accepted leaves" value={`${progress.accepted_leaves} / ${progress.total_leaves}`} />
          <StatPill label="Accepted weight" value={`${num(progress.numerator)} / ${num(progress.denominator)}`} />
          <StatPill label="Baseline" value={progress.baseline ? `v${progress.baseline.version_no}` : "None approved"} />
          <StatPill label="Unit" value={progress.baseline?.unit ?? "—"} />
        </div>
        {progress.explanation && <p className="text-xs text-[var(--color-text-secondary)]">{progress.explanation}</p>}
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Progress counts only accepted (Done) leaves with approved baseline weights; a reopened prerequisite suspends credit
          for dependent work. Code activity, elapsed time and task counts never set it.
        </p>
      </div>
    </Panel>
  );
}

function LeavesTable({ orgId, progress }: { orgId: string; progress: StructuredProgressDto }) {
  if (progress.leaves.length === 0) {
    return (
      <EmptyStateView icon={ListTree} title="No baseline leaves" description="No approved baseline yet, so there is nothing to measure." />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            <th className="py-2 pr-3 font-semibold">Item</th>
            <th className="py-2 pr-3 font-semibold">State</th>
            <th className="py-2 pr-3 font-semibold text-right">Weight</th>
            <th className="py-2 font-semibold">Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {progress.leaves.map((leaf) => (
            <tr key={leaf.work_item_id}>
              <td className="py-2 pr-3 min-w-[180px]">
                <Link href={`/org/${orgId}/developer/tasks/${leaf.work_item_id}`} className="hover:underline">
                  <span className="font-mono text-blue-600 dark:text-blue-400 mr-1.5">{leaf.key}</span>
                  <span className="text-[var(--color-text-primary)]">{leaf.title}</span>
                </Link>
              </td>
              <td className="py-2 pr-3">
                <WorkStateBadge state={leaf.cancelled ? "CANCELLED" : leaf.state} />
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{num(leaf.weight)}</td>
              <td className="py-2">
                {leaf.suspended ? (
                  <StatusBadge label="Suspended" tone="warning" />
                ) : leaf.accepted ? (
                  <StatusBadge label="Counted" tone="success" />
                ) : (
                  <StatusBadge label="Not yet" tone="neutral" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Snapshots({ progress }: { progress: StructuredProgressDto }) {
  const recent = progress.snapshots.slice(0, 8);
  if (recent.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)]">No snapshots yet. One is written with every material change.</p>;
  }
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {recent.map((s) => (
        <li key={s.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="min-w-0">
            <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
              {s.percent === null ? s.missing_label ?? "Not measurable" : `${s.percent}%`}
            </span>
            <span className="ml-2 text-[var(--color-text-secondary)]">
              {s.accepted_leaves}/{s.total_leaves} leaves{s.baseline_version ? ` · baseline v${s.baseline_version}` : ""}
            </span>
            {s.cause && <span className="ml-2 text-[var(--color-text-muted)]">{s.cause}</span>}
            {s.transition_marker && <StatusBadge label="Mode change" tone="violet" className="ml-2" />}
          </div>
          <span className="text-[11px] text-[var(--color-text-muted)]">{dateTimeText(s.taken_at)}</span>
        </li>
      ))}
    </ul>
  );
}

type ItemFilter = "MINE" | "ALL";

function WorkItems({ orgId, items, mine }: { orgId: string; items: WorkItemDto[]; mine: Set<string> }) {
  const [filter, setFilter] = useState<ItemFilter>(mine.size > 0 ? "MINE" : "ALL");
  const active = items.filter((i) => i.plan_status !== "RETIRED");
  const shown = filter === "MINE" ? active.filter((i) => mine.has(i.id)) : active;
  return (
    <div className="space-y-3">
      <SegmentTabs<ItemFilter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "MINE", label: "Assigned to me", count: active.filter((i) => mine.has(i.id)).length },
          { value: "ALL", label: "All work", count: active.length },
        ]}
      />
      {shown.length === 0 ? (
        <EmptyStateView
          icon={ListTree}
          title={filter === "MINE" ? "Nothing assigned to you here" : "No work items yet"}
          description={filter === "MINE" ? "Work assigned to you on this project appears here." : "The project manager has not planned work yet."}
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {shown.map((item) => {
            const overdue = isOverdue(item.due_on, item.state);
            return (
              <li key={item.id}>
                <Link
                  href={`/org/${orgId}/developer/tasks/${item.id}`}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 px-2 rounded-md hover:bg-[var(--color-hover)] ${mine.has(item.id) ? "border-l-2 border-l-blue-500" : ""}`}
                  style={{ paddingLeft: `${0.5 + Math.max(0, item.depth - 1) * 1}rem` }}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">{item.key}</span>
                      <span className="text-[10px] uppercase text-[var(--color-text-muted)]">{item.type}</span>
                      {item.plan_status === "DRAFT" && <StatusBadge label="Draft" tone="neutral" />}
                    </div>
                    <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.title}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)] shrink-0">
                    <span className="truncate max-w-[160px]">{item.primary_assignee?.email ?? "Unassigned"}</span>
                    <span className={overdue ? "text-rose-600 dark:text-rose-400 font-semibold" : ""}>Due {dateText(item.due_on)}</span>
                    <span className="tabular-nums">w {num(item.weight)}</span>
                    <WorkStateBadge state={item.state} blocked={item.blocked} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OpenBlockers({ orgId, blockers }: { orgId: string; blockers: WorkBlockerDto[] }) {
  if (blockers.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">No open blockers on this project.</p>;
  return (
    <ul className="space-y-2">
      {blockers.map((b) => (
        <li key={b.id} className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/org/${orgId}/developer/tasks/${b.work_item_id}`} className="font-mono font-semibold text-rose-600 dark:text-rose-400 hover:underline">
              {b.work_item_key}
            </Link>
            <StatusBadge label={b.severity === "CRITICAL" ? "Critical" : "Normal"} tone={b.severity === "CRITICAL" ? "danger" : "warning"} />
          </div>
          <p className="mt-1 text-[var(--color-text-primary)]">{b.reason}</p>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            Owner {b.owner?.email ?? "—"} · open {b.age_hours}h
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function StructuredProjectPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const projectId = (params?.projectId as string) || "";
  const project = useDevProject(projectId);
  const progress = useStructuredProgress(projectId);
  const items = useProjectWorkItems(projectId);
  const blockers = useProjectBlockers(projectId);
  const myWork = useMyWorkItems();
  const mine = useMemo(
    () => new Set(myWork.kind === "ready" ? myWork.data.filter((w) => w.project_id === projectId).map((w) => w.id) : []),
    [myWork, projectId],
  );

  const list = `/org/${orgId}/developer/projects`;
  const name = project.kind === "ready" ? project.data.name : "Project";
  const crumbs = [{ label: "My Projects", href: list }, { label: name }];

  return (
    <PanelLayout title={name} breadcrumb={crumbs}>
      <DevGate state={project} what="This project" back={{ href: list, label: "Back to my projects" }} skeleton="detail">
        {(p) => (
          <PageFrame
            crumbs={crumbs}
            back={{ href: list, label: "Back to my projects" }}
            title={p.name}
            badge="Structured"
            description={p.description || `${p.code} · target ${dateText(p.targetCompletionDate)}`}
          >
            <SectionGate state={progress} what="Structured progress">
              {(data) => <ProgressSummary progress={data} />}
            </SectionGate>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2 space-y-5 min-w-0">
                <Panel title="Work items" icon={ListTree} iconTone="blue" description="Open an item to start it, submit evidence or see its review history">
                  <SectionGate state={items} what="Work items">
                    {(data) => <WorkItems orgId={orgId} items={data} mine={mine} />}
                  </SectionGate>
                </Panel>
                <Panel title="Baseline leaves" icon={ListTree} iconTone="violet" description="What counts toward progress, and why">
                  <SectionGate state={progress} what="Baseline leaves">
                    {(data) => <LeavesTable orgId={orgId} progress={data} />}
                  </SectionGate>
                </Panel>
              </div>
              <div className="space-y-5 min-w-0">
                <Panel title="Open blockers" icon={AlertTriangle} iconTone="rose">
                  <SectionGate state={blockers} what="Open blockers">
                    {(data) => <OpenBlockers orgId={orgId} blockers={data} />}
                  </SectionGate>
                </Panel>
                <Panel title="Progress history" icon={History} iconTone="teal" description="Append-only snapshots">
                  <SectionGate state={progress} what="Progress history">
                    {(data) => <Snapshots progress={data} />}
                  </SectionGate>
                </Panel>
              </div>
            </div>
          </PageFrame>
        )}
      </DevGate>
    </PanelLayout>
  );
}
