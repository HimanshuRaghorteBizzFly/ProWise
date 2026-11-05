"use client";

import React, { useState } from "react";
import { Project } from "@/types";
import { useProjectStore } from "@/store/project-store";
import { TaskBoard } from "./TaskBoard";
import { HealthBadge } from "@/components/ui/health-badge";
import { Calendar, GitPullRequest, Layers, ShieldCheck } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";

interface StructuredProjectViewProps {
  project: Project;
}

export function StructuredProjectView({ project }: StructuredProjectViewProps) {
  const { workItems, baselines } = useProjectStore();
  const projectItems = workItems.filter((w) => w.projectId === project.id);
  const activeBaseline = baselines.find((b) => b.projectId === project.id && !b.supersededAt);

  const [activeTab, setActiveTab] = useState("board");

  const doneLeavesWeight = activeBaseline?.leaves
    ? activeBaseline.leaves.filter((l) => l.isDone).reduce((sum, l) => sum + l.weight, 0)
    : 0;
  const totalBaselineWeight = activeBaseline?.totalWeight || 1;
  const calculatedPercent = activeBaseline
    ? Math.round((doneLeavesWeight / totalBaselineWeight) * 100)
    : project.lastProgressPercent;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">
                {project.key}
              </span>
              <span className="rounded-full bg-purple-100 dark:bg-purple-950/50 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                Structured Mode
              </span>
              <HealthBadge health={project.health} />
            </div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{project.name}</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-2xl">{project.description}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-[var(--color-sidebar)] border border-[var(--color-border)] p-3 text-center min-w-[120px]">
              <span className="text-[10px] uppercase font-semibold text-[var(--color-text-secondary)]">Baseline Progress</span>
              <div className="text-2xl font-black text-primary-600 dark:text-primary-400">
                {calculatedPercent}%
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {doneLeavesWeight} / {totalBaselineWeight} {activeBaseline?.unit || "pts"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span>Baseline: <strong>v{activeBaseline?.version || 1}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span>Target: <strong>{project.targetDate}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span>Leaves: <strong>{activeBaseline?.leaves.length || 0} items</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <GitPullRequest className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span>Method: <strong>Formula Calculated</strong></span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: "board", label: "Kanban Board", count: projectItems.length },
          { id: "baseline", label: "Scope Baseline Leaves", count: activeBaseline?.leaves.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "board" && (
        <TaskBoard workItems={projectItems} projectId={project.id} />
      )}

      {activeTab === "baseline" && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Active Baseline (v{activeBaseline?.version})
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Mathematical formula: Sum(Eligible Done Leaf Weights) / Active Approved Total Weight
              </p>
            </div>
            <span className="rounded-md bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 px-2 py-1 text-xs font-semibold">
              Approved
            </span>
          </div>

          <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg">
            {activeBaseline?.leaves.map((leaf) => (
              <div key={leaf.workItemId} className="flex items-center justify-between p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${leaf.isDone ? "bg-green-500" : "bg-slate-300"}`} />
                  <span className="font-medium text-[var(--color-text-primary)]">{leaf.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--color-text-secondary)]">{leaf.weight} {activeBaseline.unit}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      leaf.isDone
                        ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {leaf.isDone ? "Done" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

