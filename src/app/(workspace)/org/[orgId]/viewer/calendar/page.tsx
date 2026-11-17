"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Clock,
  AlertTriangle,
  FolderGit2,
  List,
  Grid,
  CheckCircle2,
  Eye,
  Rocket,
} from "lucide-react";
import { HealthBadge } from "@/components/ui/health-badge";
import {
  ViewerPageHeader,
  ViewerSurfaceCard,
  ViewerKpiCard,
  ViewerFilterBar,
  ViewerPaginationBar,
  ViewerStatusBadge,
  ViewerButton,
  ViewerSerialBadge,
  EmptyState,
} from "../_components/ViewerPrimitives";
import { useViewerStore } from "../_store/useViewerStore";
import {
  getViewerCalendarEvents,
  getViewerProjects,
} from "../_services/viewer-service";
import { ViewerCalendarEvent } from "../_types";

export default function ViewerCalendarPage() {
  const params = useParams();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const { setSelectedEvent } = useViewerStore();

  // Calendar Date State (November 2026 default)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 10, 17));
  const [viewMode, setViewMode] = useState<"agenda" | "month">("agenda");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const projects = getViewerProjects(orgId);
  const rawEvents = getViewerCalendarEvents(orgId);

  const filteredEvents = useMemo(() => {
    return rawEvents
      .filter((e) => {
        if (projectFilter !== "ALL" && e.projectId !== projectFilter) return false;
        if (typeFilter !== "ALL" && e.type !== typeFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            e.title.toLowerCase().includes(q) ||
            e.projectName.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [rawEvents, projectFilter, typeFilter, search]);

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Month grid calculation
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { day: number; isCurrentMonth: boolean; dateStr: string; events: ViewerCalendarEvent[] }[] = [];

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayEvents = filteredEvents.filter((e) => e.date === dateStr);
      days.push({ day: d, isCurrentMonth: false, dateStr, events: dayEvents });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayEvents = filteredEvents.filter((e) => e.date === dateStr);
      days.push({ day: d, isCurrentMonth: true, dateStr, events: dayEvents });
    }

    // Trailing days from next month
    const remainingDays = 42 - days.length;
    for (let d = 1; d <= remainingDays; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayEvents = filteredEvents.filter((e) => e.date === dateStr);
      days.push({ day: d, isCurrentMonth: false, dateStr, events: dayEvents });
    }

    return days;
  }, [year, month, filteredEvents]);

  const overdueCount = rawEvents.filter((e) => e.daysRemaining < 0 && e.status !== "COMPLETED").length;
  const imminentCount = rawEvents.filter((e) => e.daysRemaining >= 0 && e.daysRemaining <= 7 && e.status !== "COMPLETED").length;
  const completedCount = rawEvents.filter((e) => e.status === "COMPLETED").length;

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header */}
      <ViewerPageHeader
        title="Roadmap Calendar & Milestones"
        description="Inspect scheduled delivery milestones, sprint release dates, and critical architectural deadlines across authorized initiatives."
        badge={`${rawEvents.length} Events Scheduled`}
        simulationLabel="Reactive Demo Data"
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ViewerKpiCard
          label="Total Scheduled Events"
          value={rawEvents.length}
          sublabel="Milestones, deadlines & releases"
          icon={CalendarIcon}
          tone="blue"
        />
        <ViewerKpiCard
          label="Imminent Deadlines"
          value={imminentCount}
          sublabel="Due within next 7 days"
          trend={{ value: `${imminentCount} upcoming`, positive: imminentCount === 0 }}
          icon={Clock}
          tone="amber"
        />
        <ViewerKpiCard
          label="Overdue Slippages"
          value={overdueCount}
          sublabel="Target date exceeded"
          trend={{ value: `${overdueCount} alerts`, positive: false }}
          icon={AlertTriangle}
          tone={overdueCount > 0 ? "rose" : "emerald"}
        />
        <ViewerKpiCard
          label="Shipped Milestones"
          value={completedCount}
          sublabel="Successfully verified delivery"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      {/* 3. Surface Card with Table Page Format */}
      <ViewerSurfaceCard className="overflow-hidden">
        {/* FilterBar & View Switcher */}
        <div className="p-4 border-b border-[var(--color-border,#E2E8F0)]">
          <ViewerFilterBar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search event title or project..."
            hasActiveFilters={Boolean(search || projectFilter !== "ALL" || typeFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setProjectFilter("ALL");
              setTypeFilter("ALL");
              setCurrentPage(1);
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={projectFilter}
                  onChange={(e) => {
                    setProjectFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Project"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.key} - {p.name}
                    </option>
                  ))}
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Event Type"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Event Types</option>
                  <option value="MILESTONE">Milestones</option>
                  <option value="DEADLINE">Deadlines</option>
                  <option value="RELEASE">Releases</option>
                  <option value="CHECKIN">Check-ins</option>
                </select>

                {/* View Mode Toggle */}
                <div className="flex items-center rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] p-0.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setViewMode("agenda")}
                    aria-label="Agenda Table view"
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === "agenda"
                        ? "bg-[var(--color-surface,#FFFFFF)] text-blue-600 shadow-xs"
                        : "text-[var(--color-text-muted,#80868B)] hover:text-[var(--color-text-primary,#202124)]"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("month")}
                    aria-label="Month Grid view"
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === "month"
                        ? "bg-[var(--color-surface,#FFFFFF)] text-blue-600 shadow-xs"
                        : "text-[var(--color-text-muted,#80868B)] hover:text-[var(--color-text-primary,#202124)]"
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            }
          />
        </div>

        {/* View Mode 1: Primary Agenda Table with Numbering */}
        {viewMode === "agenda" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                <tr>
                  <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3 whitespace-nowrap">Target Date</th>
                  <th className="px-4 py-3">Event / Milestone Title</th>
                  <th className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">Initiative</th>
                  <th className="px-4 py-3 whitespace-nowrap">Event Type</th>
                  <th className="px-4 py-3 whitespace-nowrap">Timeline Status</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
                {paginatedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-xs text-[var(--color-text-muted,#80868B)]">
                      No roadmap milestones match your filter.
                    </td>
                  </tr>
                ) : (
                  paginatedEvents.map((evt, idx) => {
                    const serialNum = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className="border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)] cursor-pointer"
                      >
                        {/* 1. Sr. No. (Modern SaaS interactive badge without hash) */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <ViewerSerialBadge num={serialNum} />
                        </td>

                        {/* 2. Date */}
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] font-bold text-[var(--color-text-primary,#202124)]">
                          {evt.date}
                        </td>

                        {/* 3. Title */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[var(--color-text-primary,#202124)]">
                            {evt.title}
                          </div>
                          <div className="text-[11px] text-[var(--color-text-muted,#80868B)] line-clamp-1 max-w-sm">
                            {evt.description}
                          </div>
                        </td>

                        {/* 4. Project */}
                        <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                          <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                            {evt.projectName}
                          </span>
                        </td>

                        {/* 5. Type */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <ViewerStatusBadge label={evt.type} tone="info" />
                        </td>

                        {/* 6. Timeline Status */}
                        <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-xs">
                          <span
                            className={
                              evt.daysRemaining < 0
                                ? "text-red-600"
                                : evt.daysRemaining <= 3
                                ? "text-amber-600"
                                : "text-emerald-600"
                            }
                          >
                            {evt.daysRemaining < 0
                              ? `${Math.abs(evt.daysRemaining)}d Overdue`
                              : evt.daysRemaining === 0
                              ? "Due Today"
                              : `${evt.daysRemaining}d Left`}
                          </span>
                        </td>

                        {/* 7. Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <ViewerStatusBadge
                            label={evt.status}
                            tone={evt.status === "COMPLETED" ? "success" : "neutral"}
                            dot
                          />
                        </td>

                        {/* 8. Action */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(evt);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-primary,#202124)] transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* View Mode 2: Month Calendar Grid */
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border,#E2E8F0)]">
              <h3 className="font-bold text-sm text-[var(--color-text-primary,#202124)]">
                {monthNames[month]} {year}
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                  className="p-1 rounded-md border border-[var(--color-border,#E2E8F0)] hover:bg-[var(--color-hover,#EEF3FB)]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date(2026, 10, 17))}
                  className="px-2.5 py-1 rounded-md border border-[var(--color-border,#E2E8F0)] text-xs font-medium hover:bg-[var(--color-hover,#EEF3FB)]"
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                  className="p-1 rounded-md border border-[var(--color-border,#E2E8F0)] hover:bg-[var(--color-hover,#EEF3FB)]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-[var(--color-text-secondary,#5F6368)] pb-2">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarGrid.map((dayObj, i) => (
                <div
                  key={i}
                  className={`min-h-[85px] rounded-lg border border-[var(--color-border,#E2E8F0)] p-1.5 flex flex-col justify-between text-left transition-colors ${
                    dayObj.isCurrentMonth
                      ? "bg-[var(--color-surface,#FFFFFF)]"
                      : "bg-[var(--color-app-bg,#F8FAFD)] opacity-60"
                  }`}
                >
                  <div className="font-mono text-[10px] font-bold text-[var(--color-text-secondary,#5F6368)]">
                    {dayObj.day}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    {dayObj.events.slice(0, 2).map((evt) => (
                      <div
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className="truncate text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 font-semibold cursor-pointer hover:bg-blue-500/20"
                      >
                        {evt.title}
                      </div>
                    ))}
                    {dayObj.events.length > 2 && (
                      <div className="text-[9px] text-[var(--color-text-muted,#80868B)] font-mono pl-1">
                        +{dayObj.events.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination Bar */}
        <ViewerPaginationBar
          currentPage={currentPage}
          totalItems={filteredEvents.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </ViewerSurfaceCard>
    </div>
  );
}
