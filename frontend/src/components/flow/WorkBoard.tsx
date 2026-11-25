"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, FolderKanban, Lock, MessageSquareWarning, Play, Search, Send } from "lucide-react";
import { toast } from "sonner";

import { AdminButton, AdminInput, AdminSelect, EmptyStateView, Panel, SegmentTabs, StatusBadge } from "@/components/delivery/DeliveryUI";
import { changeError, dateText } from "@/components/developer/DevUI";
import { usePortfolio } from "@/components/projects/useProjectApi";
import type { ProjectDto } from "@/types/api";
import type { WorkItemDto } from "@/types/work";
import { BOARD_COLUMNS, ProgressFigure, columnLabel, type BoardState } from "./FlowUI";
import { useStartTask } from "./useFlowApi";

/**
 * My Work: a Jira-style board (Created, In progress, In review, Completed) and a list view of the caller's tasks.
 * Cards move with buttons or drag-and-drop, only along allowed steps: Created -> In progress (start; refused while a
 * prerequisite is unfinished) and In progress -> In review (opens the task page, because a submission needs a note and
 * evidence). Only an approver moves work to Completed; "changes requested" returns it to In progress with the reason.
 * The server enforces every rule again (assignee only, dependencies, expected_version).
 */

type View = "board" | "list";

/** What a drop from one column into another means (null = not allowed for a developer). */
export function moveAction(from: string, to: string): "start" | "submit" | null {
  if (from === "TODO" && to === "IN_PROGRESS") return "start";
  if (from === "IN_PROGRESS" && to === "IN_REVIEW") return "submit";
  return null;
}

export function filterItems(items: WorkItemDto[], filters: { q: string; project: string; phase: string; state: string; blockedOnly: boolean }) {
  const q = filters.q.trim().toLowerCase();
  return items.filter((item) =>
    item.type !== "MILESTONE" && item.plan_status !== "RETIRED"
    && (!q || `${item.key} ${item.title}`.toLowerCase().includes(q))
    && (!filters.project || projectKeyOf(item) === filters.project)
    && (!filters.phase || item.phase?.title === filters.phase)
    && (!filters.state || item.state === filters.state)
    && (!filters.blockedOnly || item.blocked || (item.blocked_by ?? []).length > 0 || (item.open_blockers ?? 0) > 0));
}

function projectKeyOf(item: WorkItemDto) {
  return item.key.includes("-") ? item.key.slice(0, item.key.lastIndexOf("-")) : item.key;
}

export function WorkBoard({ items, base, orgId, myEmail }: { items: WorkItemDto[]; base: string; orgId: string; myEmail: string | null }) {
  const router = useRouter();
  const start = useStartTask();
  const [view, setView] = useState<View>("board");
  const [filters, setFilters] = useState({ q: "", project: "", phase: "", state: "", blockedOnly: false });
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const shown = useMemo(() => filterItems(items, filters), [items, filters]);
  const projects = useMemo(() => Array.from(new Set(items.map(projectKeyOf))).sort(), [items]);
  const phases = useMemo(() => Array.from(new Set(items.map((i) => i.phase?.title).filter((p): p is string => !!p))).sort(), [items]);
  const set = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const perform = (item: WorkItemDto, to: string) => {
    const action = moveAction(item.state, to);
    if (!action) {
      toast.error(to === "DONE"
        ? "Only an approver completes work, after reviewing your submission."
        : `A task cannot move from ${columnLabel(item.state)} to ${columnLabel(to)}.`);
      return;
    }
    if (action === "start") {
      if ((item.blocked_by ?? []).length > 0) {
        toast.error(`Blocked by ${(item.blocked_by ?? []).map((b) => b.key).join(", ")}. It can start once that is completed.`);
        return;
      }
      start.mutate(item, {
        onSuccess: () => toast.success(`${item.key} is in progress.`),
        onError: (e) => toast.error(changeError(e)),
      });
      return;
    }
    router.push(`${base}/tasks/${item.id}#submit`);
  };

  return (
    <div className="space-y-4">
      <SoloOutcomes orgId={orgId} base={base} myEmail={myEmail} />

      <Panel title="My tasks" icon={FolderKanban} description="Move your own tasks: start them, then submit with a note and evidence. Approvers complete them."
        action={<SegmentTabs<View> value={view} onChange={setView} options={[{ value: "board", label: "Board" }, { value: "list", label: "List" }]} />}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" aria-hidden="true" />
              <AdminInput aria-label="Search tasks" placeholder="Search by key or title" className="pl-8" value={filters.q}
                onChange={(e) => set("q", e.target.value)} />
            </div>
            <AdminSelect aria-label="Project" value={filters.project} onChange={(e) => set("project", e.target.value)}>
              <option value="">All projects</option>
              {projects.map((p) => <option key={p} value={p}>{p}</option>)}
            </AdminSelect>
            <AdminSelect aria-label="Phase" value={filters.phase} onChange={(e) => set("phase", e.target.value)}>
              <option value="">All phases</option>
              {phases.map((p) => <option key={p} value={p}>{p}</option>)}
            </AdminSelect>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={filters.blockedOnly} onChange={(e) => set("blockedOnly", e.target.checked)} />
              Blocked only
            </label>
          </div>
          {view === "list" && (
            <AdminSelect aria-label="Status" value={filters.state} onChange={(e) => set("state", e.target.value)} className="sm:max-w-[200px]">
              <option value="">Every status</option>
              {BOARD_COLUMNS.map((c) => <option key={c.state} value={c.state}>{c.label}</option>)}
            </AdminSelect>
          )}

          {items.length === 0 ? (
            <EmptyStateView icon={FolderKanban} title="No tasks assigned to you"
              description="When a project manager assigns you a task it appears here. Solo projects appear above." />
          ) : shown.length === 0 ? (
            <EmptyStateView icon={Search} title="No tasks match your filters" description="Clear the search or filters to see all your tasks." />
          ) : view === "board" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3" data-testid="work-board">
              {BOARD_COLUMNS.map((column) => {
                const cards = shown.filter((i) => i.state === column.state);
                const active = dropTarget === column.state && dragging !== null;
                return (
                  <section key={column.state} aria-label={`${column.label} column, ${cards.length} tasks`}
                    onDragOver={(e) => { e.preventDefault(); setDropTarget(column.state); }}
                    onDragLeave={() => setDropTarget((t) => (t === column.state ? null : t))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain");
                      const item = items.find((i) => i.id === id);
                      setDragging(null);
                      setDropTarget(null);
                      if (item && item.state !== column.state) perform(item, column.state);
                    }}
                    className={`rounded-xl border p-2 min-h-[160px] transition-colors ${active
                      ? "border-blue-500 bg-blue-500/5" : "border-[var(--color-border)] bg-[var(--color-app-bg)]"}`}>
                    <h3 className="flex items-center justify-between px-1.5 py-1 text-xs font-semibold">
                      {column.label}<span className="text-[var(--color-text-muted)] tabular-nums">{cards.length}</span>
                    </h3>
                    <ul className="space-y-2 mt-1">
                      {cards.map((item) => (
                        <TaskCard key={item.id} item={item} base={base} onMove={perform} busy={start.isPending}
                          onDragStart={() => setDragging(item.id)} onDragEnd={() => { setDragging(null); setDropTarget(null); }} />
                      ))}
                      {cards.length === 0 && <li className="px-1.5 py-3 text-[11px] text-[var(--color-text-muted)]">Nothing here.</li>}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="work-list">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="py-2 pr-3">Key</th><th className="py-2 pr-3">Title</th><th className="py-2 pr-3">Phase</th>
                    <th className="py-2 pr-3">Points</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Due</th><th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {shown.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 pr-3 font-mono text-blue-600 dark:text-blue-400">{item.key}</td>
                      <td className="py-2 pr-3 max-w-[280px] truncate">{item.title}</td>
                      <td className="py-2 pr-3">{item.phase?.title ?? "—"}</td>
                      <td className="py-2 pr-3 tabular-nums">{item.weight ?? "—"}</td>
                      <td className="py-2 pr-3"><StateLine item={item} /></td>
                      <td className="py-2 pr-3">{item.due_on ? dateText(item.due_on) : "—"}</td>
                      <td className="py-2 text-right"><CardActions item={item} base={base} onMove={perform} busy={start.isPending} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function StateLine({ item }: { item: WorkItemDto }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <StatusBadge label={columnLabel(item.state)} tone={item.state === "DONE" ? "success" : item.state === "IN_REVIEW" ? "violet" : item.state === "IN_PROGRESS" ? "info" : "neutral"} />
      {(item.blocked_by ?? []).length > 0 && <StatusBadge label="Waiting on a task" tone="warning" />}
      {(item.open_blockers ?? 0) > 0 && <StatusBadge label={`${item.open_blockers} blocker${item.open_blockers === 1 ? "" : "s"}`} tone="danger" />}
    </span>
  );
}

function CardActions({ item, base, onMove, busy }: { item: WorkItemDto; base: string; onMove: (item: WorkItemDto, to: BoardState) => void; busy: boolean }) {
  const waiting = (item.blocked_by ?? []).length > 0;
  return (
    <span className="inline-flex flex-wrap gap-1 justify-end">
      {item.state === "TODO" && (
        <AdminButton size="xs" onClick={() => onMove(item, "IN_PROGRESS")} disabled={waiting || busy}
          title={waiting ? `Blocked by ${(item.blocked_by ?? []).map((b) => b.key).join(", ")}` : undefined}
          aria-label={`Start ${item.key}`}>
          <Play className="w-3 h-3" /> Start
        </AdminButton>
      )}
      {item.state === "IN_PROGRESS" && (
        <AdminButton size="xs" onClick={() => onMove(item, "IN_REVIEW")} aria-label={`Submit ${item.key} for review`}>
          <Send className="w-3 h-3" /> Submit for review
        </AdminButton>
      )}
      <Link href={`${base}/tasks/${item.id}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
        aria-label={`Open ${item.key}`}>
        Open <ArrowRight className="w-3 h-3" />
      </Link>
    </span>
  );
}

function TaskCard({ item, base, onMove, busy, onDragStart, onDragEnd }: {
  item: WorkItemDto;
  base: string;
  onMove: (item: WorkItemDto, to: BoardState) => void;
  busy: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const movable = item.state === "TODO" || item.state === "IN_PROGRESS";
  const waiting = item.blocked_by ?? [];
  return (
    <li draggable={movable} onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 space-y-1.5 shadow-subtle ${movable ? "cursor-grab active:cursor-grabbing" : ""}`}
      data-testid={`card-${item.key}`}>
      <div className="flex items-center justify-between gap-2">
        <Link href={`${base}/tasks/${item.id}`} className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline">{item.key}</Link>
        {item.weight !== null && <span className="text-[10px] font-semibold tabular-nums text-[var(--color-text-muted)]">{item.weight} pts</span>}
      </div>
      <p className="text-xs font-medium leading-snug">{item.title}</p>
      {item.phase && <p className="text-[10px] text-[var(--color-text-muted)]">{item.phase.title}</p>}
      {waiting.length > 0 && (
        <p className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300">
          <Lock className="w-3 h-3" aria-hidden="true" /> Blocked by {waiting.map((b) => b.key).join(", ")}
        </p>
      )}
      {(item.open_blockers ?? 0) > 0 && (
        <p className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-3 h-3" aria-hidden="true" /> {item.open_blockers} open blocker{item.open_blockers === 1 ? "" : "s"}
        </p>
      )}
      {item.changes_requested_reason && (
        <p className="flex items-start gap-1 rounded-md bg-amber-500/10 p-1.5 text-[10px] text-amber-800 dark:text-amber-200">
          <MessageSquareWarning className="w-3 h-3 mt-px shrink-0" aria-hidden="true" />
          <span><b>Changes requested:</b> {item.changes_requested_reason}</span>
        </p>
      )}
      <CardActions item={item} base={base} onMove={onMove} busy={busy} />
    </li>
  );
}

/** Solo (Individual) projects where the caller is the developer: one outcome each, submitted with a reported %. */
function SoloOutcomes({ orgId, base, myEmail }: { orgId: string; base: string; myEmail: string | null }) {
  const portfolio = usePortfolio(orgId, { mode: "INDIVIDUAL" });
  if (portfolio.state.kind !== "ready" || !myEmail) return null;
  const mine = portfolio.state.data.filter((p: ProjectDto) => p.accountable?.email?.toLowerCase() === myEmail.toLowerCase() && !p.archived);
  if (mine.length === 0) return null;
  return (
    <Panel title="Solo outcomes" icon={FolderKanban} description="One outcome per Solo project. Submit your work with a note, evidence and how complete it is.">
      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {mine.map((project) => (
          <li key={project.id} className="rounded-lg border border-[var(--color-border)] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold"><span className="font-mono text-blue-600 dark:text-blue-400">{project.key}</span> · {project.name}</span>
              <StatusBadge label={project.lifecycle.replace("_", " ").toLowerCase()} tone="neutral" />
            </div>
            <ProgressFigure compact percent={project.progress.percent} label={project.progress.label}
              method={project.progress.percent === null ? null : "approved submission"} />
            <div className="flex flex-wrap gap-2">
              <Link href={`${base}/projects/${project.id}/individual/new-check-in`}
                className="inline-flex items-center gap-1 rounded-md bg-[#1A73E8] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1557B0]">
                <Send className="w-3 h-3" /> Submit for review
              </Link>
              <Link href={`${base}/projects/${project.id}/individual/check-ins`} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
                History <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}


