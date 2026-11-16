"use client";

import React from "react";
import { WorkItem, WorkItemState } from "@/types";
import { useProjectStore } from "@/store/project-store";
import { AlertCircle, CheckCircle2, Clock, PlayCircle } from "lucide-react";

interface TaskBoardProps {
  workItems: WorkItem[];
  projectId: string;
}

const COLUMNS: { state: WorkItemState; title: string; color: string; icon: any }[] = [
  { state: "TODO", title: "To Do", color: "border-slate-300 dark:border-slate-700", icon: Clock },
  { state: "IN_PROGRESS", title: "In Progress", color: "border-blue-400", icon: PlayCircle },
  { state: "IN_REVIEW", title: "In Review", color: "border-amber-400", icon: AlertCircle },
  { state: "DONE", title: "Done", color: "border-green-400", icon: CheckCircle2 },
];

export function TaskBoard({ workItems, projectId }: TaskBoardProps) {
  const { updateWorkItem } = useProjectStore();

  const handleStateChange = (id: string, newState: WorkItemState) => {
    updateWorkItem(id, { state: newState });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const items = workItems.filter((w) => w.state === col.state);
        const Icon = col.icon;

        return (
          <div
            key={col.state}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col min-h-[380px]"
          >
            <div className={`flex items-center justify-between p-3 border-b-2 ${col.color}`}>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <h4 className="text-xs font-semibold uppercase text-[var(--color-text-primary)]">
                  {col.title}
                </h4>
              </div>
              <span className="rounded-full bg-[var(--color-sidebar)] px-2 py-0.5 text-xs font-bold text-[var(--color-text-secondary)]">
                {items.length}
              </span>
            </div>

            <div className="p-3 space-y-2.5 flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-xs text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] rounded-lg">
                  No items
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm hover:shadow-md transition-shadow text-xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[10px] text-primary-600 dark:text-primary-400 font-bold">
                        {item.key}
                      </span>
                      <span className="rounded bg-[var(--color-sidebar)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
                        {item.weight} {item.weightUnit}
                      </span>
                    </div>

                    <h5 className="font-semibold text-[var(--color-text-primary)] mb-1">
                      {item.title}
                    </h5>
                    <p className="text-[var(--color-text-secondary)] text-[11px] line-clamp-2 mb-2">
                      {item.description}
                    </p>

                    {item.isBlocked && (
                      <div className="mb-2 rounded bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 p-1 text-[10px] font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Blocked ({item.blockers.length})
                      </div>
                    )}

                    <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
                      <select
                        value={item.state}
                        onChange={(e) => handleStateChange(item.id, e.target.value as WorkItemState)}
                        className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)] outline-none"
                      >
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="IN_REVIEW">In Review</option>
                        <option value="DONE">Done</option>
                      </select>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        rev {item.currentRevision}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

