"use client";

import React, { useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronRight,
  Clock,
  Plus,
  Radio,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { AdminCalendarEvent } from "../_types";
import {
  CATEGORY_STYLES,
  formatInTimezone,
  formatTimeInTimezone,
  getRelativeDateLabel,
  getStartOfToday,
} from "../_services/calendar-service";
import { AdminButton, StatusBadge, SurfaceCard } from "./SuperAdminPrimitives";

interface UpcomingEventsWidgetProps {
  events: AdminCalendarEvent[];
  timezone: string;
  onSelectEvent: (event: AdminCalendarEvent) => void;
  onOpenCreateModal: () => void;
}

export function UpcomingEventsWidget({
  events,
  timezone,
  onSelectEvent,
  onOpenCreateModal,
}: UpcomingEventsWidgetProps) {
  const upcomingFive = useMemo(() => {
    const startOfTodayMs = getStartOfToday().getTime();

    // Sort chronologically ascending and show only today & future checkpoints
    return [...events]
      .filter((evt) => {
        const endTime = new Date(evt.endDate || evt.startDate).getTime();
        return !isNaN(endTime) && endTime >= startOfTodayMs;
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);
  }, [events]);

  return (
    <SurfaceCard className="p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 hover:border-blue-500/35 h-full">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-500/12 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Upcoming Events
              </h3>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Next 5 scheduled administrative checkpoints
              </p>
            </div>
          </div>

          <AdminButton
            variant="outline"
            size="xs"
            onClick={onOpenCreateModal}
            className="shrink-0 transition-transform active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Event</span>
          </AdminButton>
        </div>

        {upcomingFive.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)] space-y-1">
            <p>No upcoming events scheduled.</p>
            <p className="text-[11px]">Click &ldquo;New Event&rdquo; to schedule a review, meeting, or maintenance window.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingFive.map((evt) => {
              const styles = CATEGORY_STYLES[evt.category] || CATEGORY_STYLES.Meetings;
              const dateDisplay = formatInTimezone(evt.startDate, timezone, {
                month: "short",
                day: "numeric",
              });
              const timeDisplay = evt.allDay
                ? "All Day"
                : formatTimeInTimezone(evt.startDate, timezone);

              return (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => onSelectEvent(evt)}
                  className="w-full text-left rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5 transition-all duration-200 hover:border-blue-500/40 hover:bg-[var(--color-hover)] hover:translate-x-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 group flex items-start gap-2.5"
                >
                  {/* Date badge */}
                  <div className="shrink-0 flex flex-col items-center justify-center h-10 w-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xs text-center py-0.5">
                    <span className="text-[9px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wider">
                      {dateDisplay.split(" ")[0]}
                    </span>
                    <span className="text-xs font-bold text-[var(--color-text-primary)] tabular-nums">
                      {dateDisplay.split(" ")[1]}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${styles.bg} ${styles.border} ${styles.text}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                        {evt.category}
                      </span>
                      {(() => {
                        const rel = getRelativeDateLabel(evt.startDate);
                        if (!rel) return null;
                        const isToday = rel === "Today";
                        return (
                          <span
                            className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              isToday
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {isToday && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                            {rel}
                          </span>
                        );
                      })()}
                      {evt.priority === "CRITICAL" && (
                        <span className="inline-flex items-center text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          Critical
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-semibold text-[var(--color-text-primary)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate mt-1">
                      {evt.title}
                    </h4>

                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {timeDisplay}
                      </span>
                      {evt.orgName && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[120px] text-[var(--color-text-secondary)] font-medium">
                            {evt.orgName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] group-hover:translate-x-0.5 transition-all shrink-0 mt-2" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 pt-2.5 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
        <span>Timezone: <strong className="text-[var(--color-text-secondary)]">{timezone}</strong></span>
        <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
          Auto-synchronized
        </span>
      </div>
    </SurfaceCard>
  );
}
