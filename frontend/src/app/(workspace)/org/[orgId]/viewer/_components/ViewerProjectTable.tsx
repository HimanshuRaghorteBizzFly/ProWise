"use client";

import React from "react";
import { ProgressBar } from "@/components/ui/progress";
import type { ProjectDto } from "@/types/api";
import { ViewerSerialBadge, ViewerStatusBadge } from "./ViewerPrimitives";
import { LIFECYCLE_LABEL, formatLocalDate, lifecycleTone } from "../_services/useViewerProjects";

/** Read-only table of projects exactly as the API reports them. Progress is the reported figure, never derived. */
export function ViewerProjectTable({ projects, showProgressDetail = false }: { projects: ProjectDto[]; showProgressDetail?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
          <tr>
            <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
            <th className="px-4 py-3 w-28 whitespace-nowrap">Code</th>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3 hidden md:table-cell whitespace-nowrap">Mode</th>
            <th className="px-4 py-3 whitespace-nowrap">Lifecycle</th>
            <th className="px-4 py-3 hidden lg:table-cell">Team</th>
            <th className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">Target date</th>
            <th className="px-4 py-3 w-44 whitespace-nowrap">Progress</th>
            {showProgressDetail && <th className="px-4 py-3 hidden md:table-cell whitespace-nowrap">Reported</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
          {projects.map((project, index) => {
            const percent = project.progress.percent;
            return (
              <tr key={project.id} className="hover:bg-[var(--color-hover,#EEF3FB)]/50">
                <td className="px-4 py-3 text-center">
                  <ViewerSerialBadge num={index + 1} />
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-[var(--color-text-secondary,#5F6368)]">{project.key}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-[var(--color-text-primary,#202124)]">{project.name}</div>
                  {project.description && (
                    <div className="text-[11px] text-[var(--color-text-muted,#80868B)] line-clamp-1">{project.description}</div>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <ViewerStatusBadge label={project.mode === "STRUCTURED" ? "Structured" : "Individual"} tone="violet" />
                </td>
                <td className="px-4 py-3">
                  <ViewerStatusBadge label={LIFECYCLE_LABEL[project.lifecycle]} tone={lifecycleTone(project.lifecycle)} dot />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-[var(--color-text-secondary,#5F6368)]">{project.team_name ?? "—"}</td>
                <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">{formatLocalDate(project.target_on)}</td>
                <td className="px-4 py-3">
                  {percent === null ? (
                    <span className="text-[11px] text-[var(--color-text-muted,#80868B)]">{project.progress.label}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <ProgressBar value={percent} size="sm" className="flex-1" />
                      <span className="font-mono font-semibold tabular-nums">{percent}%</span>
                    </div>
                  )}
                </td>
                {showProgressDetail && (
                  <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap text-[var(--color-text-secondary,#5F6368)]">
                    {project.progress.reported_at ? new Date(project.progress.reported_at).toLocaleString() : "Not reported"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
