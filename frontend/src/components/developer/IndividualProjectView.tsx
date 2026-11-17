"use client";

import React from "react";
import { Project } from "@/types";
import { useProjectStore } from "@/store/project-store";
import { CheckInForm } from "./CheckInForm";
import { ProgressHistory } from "./ProgressHistory";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { Calendar, User, Clock, AlertCircle } from "lucide-react";
import { HealthBadge } from "@/components/ui/health-badge";

interface IndividualProjectViewProps {
  project: Project;
}

export function IndividualProjectView({ project }: IndividualProjectViewProps) {
  const { checkIns } = useProjectStore();
  const projectCheckIns = checkIns.filter((c) => c.projectId === project.id);

  const chartData = projectCheckIns
    .filter((c) => c.verificationStatus === "ACCEPTED")
    .map((c) => ({
      date: new Date(c.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }),
      percent: c.percent,
    }));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">
                {project.key}
              </span>
              <span className="rounded-full bg-blue-100 dark:bg-blue-950/50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                Individual Mode
              </span>
              <HealthBadge health={project.health} />
            </div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{project.name}</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-2xl">{project.description}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-[var(--color-sidebar)] border border-[var(--color-border)] p-3 text-center min-w-[100px]">
              <span className="text-[10px] uppercase font-semibold text-[var(--color-text-secondary)]">Current Progress</span>
              <div className="text-2xl font-black text-primary-600 dark:text-primary-400">
                {project.lastProgressPercent}%
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span>Target: <strong>{project.targetDate}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span>Cadence: <strong>{project.cadence}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span>Sole Dev: <strong>{project.accountableOwnerId}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span>Grace: <strong>{project.graceWorkingDays} working day(s)</strong></span>
          </div>
        </div>
      </div>

      {/* Progress Chart */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          Reported Progress Velocity
        </h3>
        <ProgressChart data={chartData.length > 0 ? chartData : undefined} height={200} />
      </div>

      {/* Form and History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CheckInForm project={project} />
        <ProgressHistory checkIns={projectCheckIns} />
      </div>
    </div>
  );
}

