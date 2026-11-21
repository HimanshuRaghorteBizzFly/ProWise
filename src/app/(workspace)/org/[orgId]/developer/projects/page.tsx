"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FolderKanban,
  Search,
  ArrowRight,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Layers,
  User,
  MoreVertical,
  LayoutGrid,
  List,
  Copy,
  ExternalLink,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useProjects } from "@/hooks/useProjects";
import { useDeliveryStore } from "@/store/delivery-store";
import { developerApi, DeveloperProject } from "@/lib/developer-api";

export interface ProjectCardData {
  id: string;
  orgId: string;
  name: string;
  code: string;
  description: string;
  mode: "INDIVIDUAL" | "STRUCTURED";
  status: "ACTIVE" | "ON_HOLD" | "PLANNED" | "AWAITING_ACCEPTANCE" | "DELIVERED" | "CLOSED" | "CANCELLED";
  completionPercent: number | null;
  hasReportedProgress: boolean;
  measurementType: string;
  targetCompletionDate?: string;
  lastReportedAt?: string;
  blockedTasksCount: number;
  overdueTasksCount: number;
}

export default function DeveloperProjectsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { projects: storeProjects } = useProjects(orgId);
  const deliveryProjects = useDeliveryStore((s) => s.projects);
  const deliveryCheckIns = useDeliveryStore((s) => s.checkIns);

  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"ALL" | "INDIVIDUAL" | "STRUCTURED">("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deadlineFilter, setDeadlineFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    developerApi.getProjects(orgId).then(() => {
      if (!mounted) return;

      const storeMapped: ProjectCardData[] = storeProjects.map((p) => {
        const hasValidProgress =
          p.lastProgressMethod !== "NOT_REPORTED" &&
          p.lastProgressPercent !== null &&
          p.lastProgressPercent !== undefined &&
          p.lastProgressPercent >= 0;

        return {
          id: p.id,
          orgId: p.orgId,
          name: p.name,
          code: p.key,
          description: p.description || "",
          mode: p.mode,
          status: (p.lifecycle as any) || "ACTIVE",
          completionPercent: hasValidProgress ? Math.min(100, Math.max(0, p.lastProgressPercent)) : null,
          hasReportedProgress: hasValidProgress,
          measurementType: p.mode === "INDIVIDUAL" ? "Individual Check-in" : "Calculated Baseline",
          targetCompletionDate: p.targetDate,
          lastReportedAt: p.lastReportedAt || p.startDate,
          blockedTasksCount: 0,
          overdueTasksCount: 0,
        };
      });

      const existingCodes = new Set(storeMapped.map((p) => p.code.toLowerCase()));

      const deliveryMapped: ProjectCardData[] = deliveryProjects
        .filter((p) => !existingCodes.has(p.code.toLowerCase()))
        .map((p) => {
          const hasCheckIn = deliveryCheckIns.some(
            (c) =>
              c.status === "SUBMITTED" &&
              (c.memberId === "p-alex" ||
                c.memberId === "usr-developer" ||
                c.memberId === p.accountableDeveloperId ||
                c.lastSummary.includes(p.code))
          );
          const hasValidProgress = p.progress !== undefined && p.progress !== null && (p.progress > 0 || hasCheckIn);

          return {
            id: p.id,
            orgId: orgId,
            name: p.name,
            code: p.code,
            description: p.description || "",
            mode: p.mode,
            status: p.status === "ACTIVE" ? "ACTIVE" : "PLANNED",
            completionPercent: hasValidProgress ? Math.min(100, Math.max(0, p.progress || 0)) : null,
            hasReportedProgress: hasValidProgress,
            measurementType: p.mode === "INDIVIDUAL" ? "Individual Check-in" : "Calculated Baseline",
            targetCompletionDate: p.dueDate,
            lastReportedAt: p.startDate,
            blockedTasksCount: 0,
            overdueTasksCount: 0,
          };
        });

      const combined = [...storeMapped, ...deliveryMapped];
      setProjects(combined);
    });

    return () => {
      mounted = false;
    };
  }, [orgId, storeProjects, deliveryProjects, deliveryCheckIns]);

  // KPI summary calculations
  const totalCount = projects.length;
  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;
  const attentionCount = projects.filter(
    (p) =>
      p.blockedTasksCount > 0 ||
      p.overdueTasksCount > 0 ||
      p.status === "ON_HOLD" ||
      (p.targetCompletionDate && new Date(p.targetCompletionDate) < new Date() && p.status !== "DELIVERED" && p.status !== "CLOSED")
  ).length;
  const completedCount = projects.filter(
    (p) => p.status === "DELIVERED" || p.status === "CLOSED" || (p.hasReportedProgress && p.completionPercent === 100)
  ).length;

  const individualCount = projects.filter((p) => p.mode === "INDIVIDUAL").length;
  const structuredCount = projects.filter((p) => p.mode === "STRUCTURED").length;

  // Filter & Search Logic
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();

    return projects.filter((p) => {
      // Search
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);

      // Mode
      const matchesMode = modeFilter === "ALL" || p.mode === modeFilter;

      // Status
      const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;

      // Deadline
      let matchesDeadline = true;
      if (deadlineFilter !== "ALL" && p.targetCompletionDate) {
        const target = new Date(p.targetCompletionDate);
        const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (deadlineFilter === "OVERDUE") {
          matchesDeadline = diffDays < 0 && p.status !== "DELIVERED" && p.status !== "CLOSED";
        } else if (deadlineFilter === "DUE_SOON") {
          matchesDeadline = diffDays >= 0 && diffDays <= 14;
        } else if (deadlineFilter === "LATER") {
          matchesDeadline = diffDays > 14;
        }
      } else if (deadlineFilter !== "ALL" && !p.targetCompletionDate) {
        matchesDeadline = false;
      }

      return matchesSearch && matchesMode && matchesStatus && matchesDeadline;
    });
  }, [projects, search, modeFilter, statusFilter, deadlineFilter]);

  const handleCopyKey = (code: string) => {
    navigator.clipboard?.writeText(code);
    toast.success(`Copied key [${code}] to clipboard`);
    setOpenMenuId(null);
  };

  const handleCopyLink = (projectId: string) => {
    const url = `${window.location.origin}/org/${orgId}/developer/projects/${projectId}`;
    navigator.clipboard?.writeText(url);
    toast.success("Project link copied to clipboard");
    setOpenMenuId(null);
  };

  const formatDeadline = (targetDate?: string, status?: string) => {
    if (!targetDate) return { text: "No deadline", isOverdue: false, isNear: false };
    const date = new Date(targetDate);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    if (status === "DELIVERED" || status === "CLOSED") {
      return { text: formatted, isOverdue: false, isNear: false };
    }

    if (diffDays < 0) {
      return { text: `Overdue · ${formatted}`, isOverdue: true, isNear: false };
    }
    if (diffDays <= 7) {
      return { text: `Due in ${diffDays}d · ${formatted}`, isOverdue: false, isNear: true };
    }
    return { text: formatted, isOverdue: false, isNear: false };
  };

  const formatLastUpdated = (dateStr?: string) => {
    if (!dateStr) return "Recently updated";
    try {
      const d = new Date(dateStr);
      return `Updated ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } catch {
      return "Recently updated";
    }
  };

  return (
    <PanelLayout
      title="Assigned Projects"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Assigned Projects" }]}
    >
      <div className="space-y-6 w-full min-w-0 pb-12">
        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Assigned Projects
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Active engineering initiatives assigned to your developer profile across solo check-in and structured baseline modes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8.5 font-medium border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => router.push(`/org/${orgId}/developer/progress`)}
            >
              <Activity className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              All Progress
            </Button>
          </div>
        </div>

        {/* Small Summary Cards (Linear-Style KPIs) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Assigned</span>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 tracking-tight">
                {totalCount}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Portfolio initiatives</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Active</span>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 tracking-tight flex items-center gap-1.5">
                <span>{activeCount}</span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">In flight</span>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Need Attention</span>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 tracking-tight">
                {attentionCount}
              </div>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 block font-medium">
                {attentionCount === 0 ? "All on track" : "Blockers or overdue"}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Completed</span>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 tracking-tight">
                {completedCount}
              </div>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 block font-medium">Delivered & closed</span>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Filters & Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-[#181B20] p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          {/* Left Controls: Search + Segmented Mode Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Search by name, key or scope..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-8 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-lg focus-visible:ring-1 focus-visible:ring-blue-600"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Segmented Mode Control */}
            <div className="flex items-center rounded-lg border border-slate-200/80 dark:border-slate-800 p-0.5 bg-slate-100/70 dark:bg-slate-900/80 text-xs font-medium">
              <button
                type="button"
                onClick={() => setModeFilter("ALL")}
                className={`px-3 py-1 rounded-md transition-all ${
                  modeFilter === "ALL"
                    ? "bg-white dark:bg-[#181B20] text-slate-900 dark:text-white shadow-xs font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setModeFilter("INDIVIDUAL")}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  modeFilter === "INDIVIDUAL"
                    ? "bg-white dark:bg-[#181B20] text-slate-900 dark:text-white shadow-xs font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <User className="w-3 h-3 text-slate-400" />
                Individual ({individualCount})
              </button>
              <button
                type="button"
                onClick={() => setModeFilter("STRUCTURED")}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  modeFilter === "STRUCTURED"
                    ? "bg-white dark:bg-[#181B20] text-slate-900 dark:text-white shadow-xs font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Layers className="w-3 h-3 text-slate-400" />
                Structured ({structuredCount})
              </button>
            </div>
          </div>

          {/* Right Controls: Status filter + Deadline filter + View Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CLOSED">Closed</option>
              <option value="PLANNED">Planned</option>
            </select>

            {/* Deadline Select */}
            <select
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value)}
              className="text-xs h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">All Deadlines</option>
              <option value="DUE_SOON">Due Soon (&le; 14 days)</option>
              <option value="OVERDUE">Overdue</option>
              <option value="LATER">Later</option>
            </select>

            {/* Reset Filters */}
            {(search || modeFilter !== "ALL" || statusFilter !== "ALL" || deadlineFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setModeFilter("ALL");
                  setStatusFilter("ALL");
                  setDeadlineFilter("ALL");
                }}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 px-2 py-1 flex items-center gap-1"
                title="Reset filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}

            {/* View Mode Toggle (Grid vs List) */}
            <div className="flex items-center rounded-lg border border-slate-200/80 dark:border-slate-800 p-0.5 bg-slate-100/60 dark:bg-slate-900/60">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1 rounded transition-colors ${
                  viewMode === "grid"
                    ? "bg-white dark:bg-[#181B20] text-blue-600 shadow-xs"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-1 rounded transition-colors ${
                  viewMode === "list"
                    ? "bg-white dark:bg-[#181B20] text-blue-600 shadow-xs"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Section: Grid View or List View */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] py-16 text-center">
            <FolderKanban className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No matching projects</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No assigned projects match your current filters. Try searching for a different term or resetting the filters.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          /* Cards Grid: 3 per row on desktop, 2 on tablet, 1 on mobile */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
            {filtered.map((p) => {
              const isIndividual = p.mode === "INDIVIDUAL";
              const isDeliveredOrClosed = p.status === "DELIVERED" || p.status === "CLOSED";
              const targetRoute = isIndividual
                ? `/org/${orgId}/developer/projects/${p.id}/individual`
                : `/org/${orgId}/developer/projects/${p.id}/structured`;

              const deadlineInfo = formatDeadline(p.targetCompletionDate, p.status);
              const lastUpdatedText = formatLastUpdated(p.lastReportedAt);

              return (
                <div
                  key={p.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all duration-150"
                >
                  <div>
                    {/* Top Header: Key, Mode, Status, Menu */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Project Key */}
                        <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/70 dark:border-slate-700/60">
                          {p.code}
                        </span>

                        {/* Minimal Mode Badge */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 px-2 py-0.5 rounded-md">
                          {isIndividual ? (
                            <>
                              <User className="w-3 h-3 text-slate-400" />
                              <span>Individual</span>
                            </>
                          ) : (
                            <>
                              <Layers className="w-3 h-3 text-slate-400" />
                              <span>Structured</span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Status Indicator */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            p.status === "ACTIVE"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/50"
                              : p.status === "ON_HOLD"
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/50"
                              : p.status === "DELIVERED"
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/80 dark:border-blue-800/50"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              p.status === "ACTIVE"
                                ? "bg-emerald-500"
                                : p.status === "ON_HOLD"
                                ? "bg-amber-500"
                                : p.status === "DELIVERED"
                                ? "bg-blue-500"
                                : "bg-slate-400"
                            }`}
                          />
                          {p.status === "ACTIVE"
                            ? "Active"
                            : p.status === "ON_HOLD"
                            ? "On Hold"
                            : p.status === "DELIVERED"
                            ? "Delivered"
                            : p.status === "CLOSED"
                            ? "Closed"
                            : "Planned"}
                        </span>

                        {/* Three-Dot Menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Project options"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {openMenuId === p.id && (
                            <>
                              <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-6 z-30 w-44 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E2229] py-1 shadow-lg text-xs">
                                <button
                                  type="button"
                                  onClick={() => handleCopyKey(p.code)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Copy Key</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(p.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Copy Link</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    router.push(`/org/${orgId}/developer/progress`);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-left border-t border-slate-100 dark:border-slate-800"
                                >
                                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                                  <span>View History</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Project Title */}
                    <h3
                      onClick={() => router.push(targetRoute)}
                      className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-2 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      title={p.name}
                    >
                      {p.name}
                    </h3>

                    {/* Description (max 2 lines) */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed min-h-[2.25rem]">
                      {p.description || "Active engineering deliverable with baseline verification."}
                    </p>

                    {/* Progress Bar & Measurement Type */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {p.hasReportedProgress ? p.measurementType : "Progress"}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {p.hasReportedProgress && p.completionPercent !== null ? (
                            `${p.completionPercent}%`
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic font-normal text-[11px]">
                              Not reported yet
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        {p.hasReportedProgress && p.completionPercent !== null ? (
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              p.completionPercent === 100 ? "bg-emerald-500" : "bg-blue-600"
                            }`}
                            style={{ width: `${p.completionPercent}%` }}
                          />
                        ) : (
                          <div className="h-full w-full bg-slate-200/50 dark:bg-slate-800/40" />
                        )}
                      </div>
                    </div>

                    {/* Deadline & Last Updated Row */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className={`truncate ${deadlineInfo.isOverdue ? "text-rose-600 dark:text-rose-400 font-semibold" : deadlineInfo.isNear ? "text-amber-600 dark:text-amber-400 font-medium" : ""}`}>
                          {deadlineInfo.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-slate-400 text-[10px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{lastUpdatedText}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-3.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-medium rounded-lg"
                      onClick={() => router.push(`/org/${orgId}/developer/progress`)}
                    >
                      <Activity className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      View Progress
                    </Button>

                    {isDeliveredOrClosed ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium rounded-lg"
                        onClick={() => router.push(targetRoute)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                        View Summary
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8 px-3 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1"
                        onClick={() => router.push(targetRoute)}
                      >
                        <span>Open Project</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View: Clean, Notion/Linear-Style Table */
          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium">
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Progress</th>
                    <th className="py-3 px-4">Deadline</th>
                    <th className="py-3 px-4">Last Updated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filtered.map((p) => {
                    const isIndividual = p.mode === "INDIVIDUAL";
                    const isDeliveredOrClosed = p.status === "DELIVERED" || p.status === "CLOSED";
                    const targetRoute = isIndividual
                      ? `/org/${orgId}/developer/projects/${p.id}/individual`
                      : `/org/${orgId}/developer/projects/${p.id}/structured`;

                    const deadlineInfo = formatDeadline(p.targetCompletionDate, p.status);
                    const lastUpdatedText = formatLastUpdated(p.lastReportedAt);

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/70 dark:border-slate-700/60 shrink-0">
                              {p.code}
                            </span>
                            <div className="min-w-0">
                              <span
                                onClick={() => router.push(targetRoute)}
                                className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer truncate block"
                              >
                                {p.name}
                              </span>
                              <span className="text-[11px] text-slate-400 line-clamp-1 truncate block">
                                {p.description || "Active engineering deliverable"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 px-2 py-0.5 rounded-md">
                            {isIndividual ? <User className="w-3 h-3 text-slate-400" /> : <Layers className="w-3 h-3 text-slate-400" />}
                            <span>{isIndividual ? "Individual" : "Structured"}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                              p.status === "ACTIVE"
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/50"
                                : p.status === "ON_HOLD"
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/50"
                                : p.status === "DELIVERED"
                                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/80 dark:border-blue-800/50"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                p.status === "ACTIVE"
                                  ? "bg-emerald-500"
                                  : p.status === "ON_HOLD"
                                  ? "bg-amber-500"
                                  : p.status === "DELIVERED"
                                  ? "bg-blue-500"
                                  : "bg-slate-400"
                              }`}
                            />
                            {p.status === "ACTIVE"
                              ? "Active"
                              : p.status === "ON_HOLD"
                              ? "On Hold"
                              : p.status === "DELIVERED"
                              ? "Delivered"
                              : p.status === "CLOSED"
                              ? "Closed"
                              : "Planned"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap min-w-[140px]">
                          {p.hasReportedProgress && p.completionPercent !== null ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{p.completionPercent}%</span>
                                <span className="text-slate-400 text-[10px]">{p.mode === "INDIVIDUAL" ? "Check-in" : "Baseline"}</span>
                              </div>
                              <div className="h-1.5 w-24 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${p.completionPercent === 100 ? "bg-emerald-500" : "bg-blue-600"}`}
                                  style={{ width: `${p.completionPercent}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">Not reported yet</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-[11px]">
                          <span className={`inline-flex items-center gap-1 ${deadlineInfo.isOverdue ? "text-rose-600 dark:text-rose-400 font-semibold" : deadlineInfo.isNear ? "text-amber-600 dark:text-amber-400 font-medium" : "text-slate-600 dark:text-slate-300"}`}>
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {deadlineInfo.text}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-400">
                          {lastUpdatedText}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-slate-600 dark:text-slate-300"
                              onClick={() => router.push(`/org/${orgId}/developer/progress`)}
                            >
                              Progress
                            </Button>
                            {isDeliveredOrClosed ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs text-slate-600 dark:text-slate-300"
                                onClick={() => router.push(targetRoute)}
                              >
                                View
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                                onClick={() => router.push(targetRoute)}
                              >
                                Open
                                <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}
