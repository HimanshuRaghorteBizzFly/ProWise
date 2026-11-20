"use client";

import React, { useState } from "react";
import {
  X,
  CheckSquare,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Layers,
  ArrowRight,
  GitPullRequest,
  Copy,
  Check,
} from "lucide-react";
import { ViewerTask } from "../_types";
import { Badge } from "@/components/ui/badge";
import { ReadOnlyBadge, ViewerStatusBadge } from "./ViewerPrimitives";
import { toast } from "sonner";

export function TaskDetailDrawer({
  task,
  onClose,
}: {
  task: ViewerTask | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!task) return null;

  const handleCopyKey = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(task.key);
      setCopied(true);
      toast.success(`Copied ${task.key} to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getPriorityTone = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
      case "URGENT":
        return "danger";
      case "HIGH":
        return "warning";
      case "MEDIUM":
        return "info";
      default:
        return "neutral";
    }
  };

  const getStateTone = (state: string) => {
    switch (state) {
      case "DONE":
        return "success";
      case "IN_REVIEW":
        return "violet";
      case "IN_PROGRESS":
        return "info";
      default:
        return "neutral";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--color-surface,#FFFFFF)] border-l border-[var(--color-border,#E2E8F0)] h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--color-border,#E2E8F0)] flex items-center justify-between bg-[var(--color-sidebar,#F6F8FC)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 hover:underline cursor-pointer"
                  title="Click to copy task key"
                >
                  <span>{task.key}</span>
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </button>
                <span className="text-xs text-[var(--color-text-muted,#80868B)]">
                  • {task.projectName || task.projectKey}
                </span>
                <ReadOnlyBadge />
              </div>
              <h2 className="text-base font-bold text-[var(--color-text-primary,#202124)] mt-0.5 truncate">
                {task.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted,#80868B)] hover:text-[var(--color-text-primary,#202124)] hover:bg-[var(--color-hover,#EEF3FB)] transition-colors shrink-0 cursor-pointer"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
          {/* Read-Only Governance Notice */}
          <div className="p-3 rounded-lg bg-[var(--color-app-bg,#F8FAFD)] border border-[var(--color-border,#E2E8F0)] flex items-start gap-2.5 text-[var(--color-text-secondary,#5F6368)]">
            <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[var(--color-text-primary,#202124)]">
                Read-Only Work Item Inspection:
              </span>{" "}
              Task assignment, status transitions, criteria changes, and review signoffs are restricted to authorized engineers and project managers.
            </div>
          </div>

          {/* Status & Priority Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-lg bg-[var(--color-app-bg,#F8FAFD)] border border-[var(--color-border,#E2E8F0)] text-center">
              <div className="text-[10px] text-[var(--color-text-muted,#80868B)] uppercase font-bold tracking-wider">
                Workflow State
              </div>
              <div className="mt-1.5">
                <ViewerStatusBadge
                  label={task.state.replace("_", " ")}
                  tone={getStateTone(task.state)}
                  dot
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[var(--color-app-bg,#F8FAFD)] border border-[var(--color-border,#E2E8F0)] text-center">
              <div className="text-[10px] text-[var(--color-text-muted,#80868B)] uppercase font-bold tracking-wider">
                Priority
              </div>
              <div className="mt-1.5">
                <ViewerStatusBadge
                  label={task.priority}
                  tone={getPriorityTone(task.priority)}
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[var(--color-app-bg,#F8FAFD)] border border-[var(--color-border,#E2E8F0)] text-center">
              <div className="text-[10px] text-[var(--color-text-muted,#80868B)] uppercase font-bold tracking-wider">
                Baseline Weight
              </div>
              <div className="text-sm font-bold font-mono text-[var(--color-text-primary,#202124)] mt-1">
                {task.weight} {task.weightUnit || "pts"}
              </div>
            </div>
          </div>

          {/* Task Description */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted,#80868B)] mb-1.5">
              Work Item Scope & Description
            </h3>
            <div className="p-3.5 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] text-[var(--color-text-primary,#202124)] leading-relaxed">
              {task.description}
            </div>
          </div>

          {/* Acceptance Criteria */}
          {task.criteria && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted,#80868B)] mb-1.5">
                Acceptance Criteria
              </h3>
              <div className="p-3.5 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] text-[var(--color-text-secondary,#5F6368)] leading-relaxed font-mono text-[11px]">
                {task.criteria}
              </div>
            </div>
          )}

          {/* Parent Milestone */}
          {task.parentTitle && (
            <div className="p-3.5 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] text-xs">
              <div className="text-[10px] text-[var(--color-text-muted,#80868B)] uppercase font-bold">
                Parent Deliverable / Milestone
              </div>
              <div className="font-semibold text-[var(--color-text-primary,#202124)] mt-1 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>{task.parentTitle}</span>
              </div>
            </div>
          )}

          {/* Assignees & Reviewers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)]">
              <div className="text-[var(--color-text-muted,#80868B)] text-[10px] uppercase font-bold">
                Primary Assignee
              </div>
              <div className="font-semibold text-[var(--color-text-primary,#202124)] mt-1">
                {task.primaryAssignee?.name || "Unassigned"}
              </div>
              <div className="text-[10px] font-mono text-[var(--color-text-muted,#80868B)] truncate">
                {task.primaryAssignee?.email || "No email"}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)]">
              <div className="text-[var(--color-text-muted,#80868B)] text-[10px] uppercase font-bold">
                Quality Reviewer
              </div>
              <div className="font-semibold text-[var(--color-text-primary,#202124)] mt-1">
                {task.reviewer?.name || "Assigned via PR"}
              </div>
              <div className="text-[10px] font-mono text-[var(--color-text-muted,#80868B)] truncate">
                {task.reviewer?.email || "peer-review@acmehealth.com"}
              </div>
            </div>
          </div>

          {/* Dependencies */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted,#80868B)] mb-1.5">
                Upstream Dependencies ({task.dependencies.length})
              </h3>
              <div className="space-y-1.5">
                {task.dependencies.map((dep) => (
                  <div
                    key={dep.id}
                    className="p-2.5 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {dep.key}
                      </span>
                      <span className="text-[var(--color-text-primary,#202124)] truncate max-w-xs">
                        {dep.title}
                      </span>
                    </div>
                    <ViewerStatusBadge label={dep.state} tone={getStateTone(dep.state)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Due Date & Telemetry */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border,#E2E8F0)] text-[11px] text-[var(--color-text-muted,#80868B)]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>Target Delivery Date:</span>
            </span>
            <span className="font-mono font-bold text-[var(--color-text-primary,#202124)]">
              {task.dueDate}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={handleCopyKey}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] hover:bg-[var(--color-hover,#EEF3FB)] text-xs font-medium text-[var(--color-text-primary,#202124)] transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>Copy Task Key</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
