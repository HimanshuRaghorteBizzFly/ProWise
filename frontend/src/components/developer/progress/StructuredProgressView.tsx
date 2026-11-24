"use client";

import React from "react";
import Link from "next/link";
import { CheckSquare, GitCommitHorizontal, History, Layers } from "lucide-react";

import { EmptyStateView, Panel, StatPill, StatusBadge } from "@/components/delivery/DeliveryUI";
import { SectionGate, WorkStateBadge, dateText, dateTimeText } from "@/components/developer/DevUI";
import { useMyWorkItems, useStructuredProgress } from "@/components/developer/useDeveloperData";
import type { LeafRowDto, StructuredProgressDto } from "@/types/work";

/**
 * Structured progress for one project, exactly as the server computed it (rule 9: no client-side calculation).
 * Accepted work over the approved baseline; a reopened prerequisite suspends credit for dependent work.
 */
export function StructuredProgressView({ orgId, projectId }: { orgId: string; projectId: string }) {
  const progress = useStructuredProgress(projectId);
  const mine = useMyWorkItems();

  return (
    <div className="space-y-5">
      <SectionGate state={progress} what="Structured progress">
        {(p) => <Figure progress={p} />}
      </SectionGate>

      <Panel title="My assigned work" description="Items in this project where you are the primary assignee or a collaborator." icon={CheckSquare}>
        <SectionGate state={mine} what="Your work items">
          {(items) => {
            const here = items.filter((i) => i.project_id === projectId);
            if (here.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">No work assigned to you in this project.</p>;
            return (
              <ul className="divide-y divide-[var(--color-border)]">
                {here.map((i) => (
                  <li key={i.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <Link href={`/org/${orgId}/developer/tasks/${encodeURIComponent(i.id)}`} className="min-w-0 hover:underline">
                      <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{i.key}</span>{" "}
                      <span className="text-[var(--color-text-primary)]">{i.title}</span>
                    </Link>
                    <WorkStateBadge state={i.state} blocked={i.blocked} />
                  </li>
                ))}
              </ul>
            );
          }}
        </SectionGate>
      </Panel>

      <SectionGate state={progress} what="Structured progress">
        {(p) => (
          <>
            <Leaves orgId={orgId} leaves={p.leaves} unit={p.baseline?.unit} />
            <Snapshots progress={p} />
          </>
        )}
      </SectionGate>
    </div>
  );
}

function Figure({ progress: p }: { progress: StructuredProgressDto }) {
  return (
    <Panel title="Calculated progress" description="Accepted work over the approved baseline. Git activity, time and task counts never set it." icon={Layers} iconTone="violet">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div data-testid="structured-figure">
          <p className="text-3xl font-bold tabular-nums text-[var(--color-text-primary)]">
            {p.percent === null ? "Not measurable" : `${p.percent}%`}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{p.label}</p>
          {p.explanation && <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-xl">{p.explanation}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
        <StatPill label="Accepted leaves" value={`${p.accepted_leaves} / ${p.total_leaves}`} />
        <StatPill label="Method" value={p.method} />
        <StatPill label="Baseline" value={p.baseline ? `v${p.baseline.version_no} · ${p.baseline.unit}` : "None approved"} tone={p.baseline ? "neutral" : "warning"} />
        <StatPill label="Approved" value={p.baseline ? dateText(p.baseline.approved_at) : "—"} />
      </div>
    </Panel>
  );
}

function leafStatus(leaf: LeafRowDto) {
  if (leaf.cancelled) return <StatusBadge label="Cancelled" tone="neutral" />;
  if (leaf.suspended) return <StatusBadge label="Suspended (dependency reopened)" tone="warning" />;
  if (leaf.accepted) return <StatusBadge label="Accepted" tone="success" />;
  return <StatusBadge label="Not accepted" tone="neutral" />;
}

function Leaves({ orgId, leaves, unit }: { orgId: string; leaves: LeafRowDto[]; unit?: string }) {
  return (
    <Panel title="Baseline leaves" description="Each weighted leaf of the approved baseline and whether it counts." icon={GitCommitHorizontal}>
      {leaves.length === 0 ? (
        <EmptyStateView icon={Layers} title="No baseline leaves" description="No scope version has been approved for this project yet." />
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-xs min-w-[560px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="py-2 pr-3">Key</th>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3 text-right">Weight{unit ? ` (${unit})` : ""}</th>
                <th className="py-2 pr-3">State</th>
                <th className="py-2">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {leaves.map((leaf) => (
                <tr key={leaf.work_item_id}>
                  <td className="py-2 pr-3 font-mono font-semibold">
                    <Link href={`/org/${orgId}/developer/tasks/${encodeURIComponent(leaf.work_item_id)}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                      {leaf.key}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-[var(--color-text-primary)]">{leaf.title}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{leaf.weight ?? "—"}</td>
                  <td className="py-2 pr-3"><WorkStateBadge state={leaf.state} /></td>
                  <td className="py-2">{leafStatus(leaf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Snapshots({ progress: p }: { progress: StructuredProgressDto }) {
  return (
    <Panel title="Snapshot history" description="Recorded figures over time; a baseline change starts a new comparison." icon={History}>
      {p.snapshots.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">No snapshots recorded yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]" data-testid="snapshot-history">
          {p.snapshots.map((s) => (
            <li key={s.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {s.percent === null ? s.missing_label ?? "Not measurable" : `${s.percent}%`}
                </span>
                <span className="text-[var(--color-text-muted)]">
                  {" "}· {s.accepted_leaves}/{s.total_leaves} leaves
                  {s.baseline_version !== null ? ` · baseline v${s.baseline_version}` : ""}
                  {s.cause ? ` · ${s.cause}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {s.transition_marker && <StatusBadge label="Baseline change" tone="violet" />}
                <span className="text-[var(--color-text-muted)]">{dateTimeText(s.taken_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
