"use client";

import React from "react";
import type { ProjectDto } from "@/types/api";
import {
  Calendar,
  Layers,
  User,
  Shield,
  Clock,
  MoreVertical,
  Users,
  Archive,
  RotateCcw,
  Edit2,
  CheckCircle2,
} from "lucide-react";
import { HealthBadge } from "@/components/ui/health-badge";

interface ProjectCardProps {
  project: ProjectDto;
  onEdit?: (project: ProjectDto) => void;
  onManageMembers?: (project: ProjectDto) => void;
  onArchive?: (project: ProjectDto) => void;
  onRestore?: (project: ProjectDto) => void;
  canEdit?: boolean;
  canArchive?: boolean;
}

export function ProjectCard({
  project,
  onEdit,
  onManageMembers,
  onArchive,
  onRestore,
  canEdit = true,
  canArchive = true,
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const priorityColor = {
    LOW: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    MEDIUM: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    HIGH: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    CRITICAL: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  }[project.priority] ?? "bg-slate-500/10 text-slate-600 border-slate-500/20";

  const lifecycleColor = {
    PLANNED: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    ON_HOLD: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    AWAITING_ACCEPTANCE: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    DELIVERED: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    CLOSED: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    CANCELLED: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  }[project.lifecycle] ?? "bg-slate-500/10 text-slate-600 border-slate-500/20";

  const percent = Number(project.lastProgressPercent) || 0;
  const isIndividual = project.mode === "INDIVIDUAL";

  return (
    <div
      className={`rounded-xl border bg-app-surface p-5 shadow-sm transition-all hover:shadow-md relative flex flex-col justify-between ${
        project.archived
          ? "border-dashed border-app-border opacity-70 bg-app-bg/60"
          : "border-app-border"
      }`}
    >
      <div>
        {/* Top Header: Key, Badges, Actions Menu */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-app-bg border border-app-border text-app-text-primary">
              [{project.key}]
            </span>

            {/* Mode Badge */}
            {isIndividual ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                <User className="w-3 h-3" /> Individual (Solo)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                <Layers className="w-3 h-3" /> Structured
              </span>
            )}

            {/* Lifecycle Status */}
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${lifecycleColor}`}>
              {project.archived ? "Archived" : project.lifecycle.replace("_", " ")}
            </span>

            {/* Priority */}
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${priorityColor}`}>
              {project.priority}
            </span>
          </div>

          {/* Action Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded-lg text-app-text-muted hover:text-app-text-primary hover:bg-app-hover transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-7 z-20 w-44 rounded-lg border border-app-border bg-app-surface py-1 shadow-lg text-xs">
                  {canEdit && !project.archived && onEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(project);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-app-text-primary hover:bg-app-hover"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Project
                    </button>
                  )}

                  {!project.archived && onManageMembers && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onManageMembers(project);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-app-text-primary hover:bg-app-hover"
                    >
                      <Users className="w-3.5 h-3.5" /> Manage Members
                    </button>
                  )}

                  {canArchive && (
                    project.archived ? (
                      onRestore && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onRestore(project);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-500/10"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore Project
                        </button>
                      )
                    ) : (
                      onArchive && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onArchive(project);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-500/10"
                        >
                          <Archive className="w-3.5 h-3.5" /> Archive Project
                        </button>
                      )
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Title and Description */}
        <h3 className="font-semibold text-base text-app-text-primary mb-1">
          {project.name}
        </h3>
        {project.description && (
          <p className="text-xs text-app-text-secondary line-clamp-2 mb-3 leading-relaxed">
            {project.description}
          </p>
        )}

        {/* Health and Progress */}
        <div className="my-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-app-text-muted font-medium flex items-center gap-1.5">
              Health: <HealthBadge health={project.health === "OFF_TRACK" ? "DELAYED" : (project.health as any)} />
            </span>
            <span className="font-semibold text-app-text-primary">
              {percent}%
            </span>
          </div>

          <div className="h-2 w-full bg-app-bg rounded-full overflow-hidden border border-app-border">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                project.health === "OFF_TRACK"
                  ? "bg-red-500"
                  : project.health === "AT_RISK"
                  ? "bg-amber-500"
                  : "bg-blue-600"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>

          {/* Individual mode zero tasks indicator */}
          {isIndividual && (
            <div className="text-[11px] text-app-text-muted flex items-center gap-1 pt-0.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>
                {percent === 0
                  ? "Solo mode: 0 tasks required (progress via developer check-ins)"
                  : "Developer reported progress"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Dates & Ownership */}
      <div className="pt-3 border-t border-app-border/60 space-y-2 text-xs text-app-text-muted">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {project.targetDate ? (
            <div className="flex items-center gap-1 text-[11px]">
              <Clock className="w-3 h-3" />
              <span>Due: {new Date(project.targetDate).toLocaleDateString()}</span>
            </div>
          ) : (
            <div className="text-[11px]">No target date</div>
          )}

          <div className="text-[11px] font-mono">
            v{project.version}
          </div>
        </div>

        {project.accountableDeveloperId && (
          <div className="flex items-center gap-1.5 text-[11px] text-app-text-secondary">
            <Shield className="w-3 h-3 text-blue-500" />
            <span className="truncate">
              Accountable Dev: {project.accountableDeveloperId}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
