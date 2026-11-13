"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Globe,
  Info,
  Layers,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminCalendarEvent,
  CalendarEventCategory,
  CalendarEventStatus,
  CalendarNotificationChannel,
  CalendarReminder,
} from "../_types";
import {
  useAdminPermissions,
  useSuperAdminStore,
} from "../_store/useSuperAdminStore";
import {
  CALENDAR_CATEGORIES,
  CALENDAR_STATUSES,
  CATEGORY_STYLES,
  STATUS_STYLES,
  SUPPORTED_TIMEZONES,
  formatInTimezone,
  formatLiveClock,
  formatTimeInTimezone,
  generateSynchronizedCalendarEvents,
  getLocalDateString,
  getLocalDateTimeString,
  getRelativeDateLabel,
  getStartOfToday,
  isDateInPast,
  isDayInPast,
} from "../_services/calendar-service";
import {
  AdminButton,
  EmptyStateView,
  StatusBadge,
  SurfaceCard,
} from "./SuperAdminPrimitives";

type CalendarViewMode = "month" | "week" | "day" | "agenda";

// 48 standard half-hour slots for intuitive 1-click time selection
const STANDARD_TIME_OPTIONS: Array<{ value: string; label: string }> = Array.from(
  { length: 48 },
  (_, i) => {
    const totalMinutes = i * 30;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const timeVal = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const label = `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
    return { value: timeVal, label };
  }
);

function getTimeSlots(currentTime: string): Array<{ value: string; label: string }> {
  if (!currentTime || STANDARD_TIME_OPTIONS.some((o) => o.value === currentTime)) {
    return STANDARD_TIME_OPTIONS;
  }
  const [hStr, mStr] = currentTime.split(":");
  const h = parseInt(hStr || "0", 10);
  const m = parseInt(mStr || "0", 10);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const label = `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
  const customSlot = { value: currentTime, label };
  return [...STANDARD_TIME_OPTIONS, customSlot].sort((a, b) =>
    a.value.localeCompare(b.value)
  );
}

interface ResponsiveDateTimePickerProps {
  label: string;
  value: string; // YYYY-MM-DDTHH:mm
  onChange: (val: string) => void;
  minDate?: string; // YYYY-MM-DD
  required?: boolean;
  error?: string;
  helpText?: React.ReactNode;
  isAllDay?: boolean;
  quickDurations?: boolean;
  onAddMinutes?: (mins: number) => void;
  disabled?: boolean;
}

function ResponsiveDateTimePicker({
  label,
  value,
  onChange,
  minDate,
  required = false,
  error,
  helpText,
  isAllDay = false,
  quickDurations = false,
  onAddMinutes,
  disabled = false,
}: ResponsiveDateTimePickerProps) {
  const datePart = useMemo(() => {
    if (!value) return "";
    return value.split("T")[0] || "";
  }, [value]);

  const timePart = useMemo(() => {
    if (!value) return "09:00";
    const parts = value.split("T");
    return (parts[1] || "09:00").slice(0, 5);
  }, [value]);

  const timeOptions = useMemo(() => {
    return getTimeSlots(timePart);
  }, [timePart]);

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    onChange(`${newDate}T${timePart || "09:00"}`);
  };

  const handleTimeChange = (newTime: string) => {
    if (!newTime) return;
    onChange(`${datePart || minDate || getLocalDateString(new Date())}T${newTime}`);
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-[var(--color-text-primary)]">
        {label}
      </label>

      {isAllDay ? (
        <div className="relative">
          <input
            type="date"
            required={required}
            disabled={disabled}
            min={minDate}
            value={datePart}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark] transition-colors"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {/* Date Picker */}
          <div className="sm:col-span-3">
            <input
              type="date"
              required={required}
              disabled={disabled}
              min={minDate}
              value={datePart}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark] transition-colors"
            />
          </div>

          {/* Time Picker Dropdown */}
          <div className="sm:col-span-2">
            <select
              disabled={disabled}
              value={timePart}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-2 text-xs font-semibold text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
            >
              {timeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Quick Add Duration Pills */}
      {quickDurations && onAddMinutes && !isAllDay && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[10px] text-[var(--color-text-muted)] font-medium">Quick duration:</span>
          {[
            { label: "+30m", mins: 30 },
            { label: "+1 hr", mins: 60 },
            { label: "+2 hrs", mins: 120 },
            { label: "+4 hrs", mins: 240 },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onAddMinutes(item.mins)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)] hover:bg-blue-500/15 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30 transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {helpText && !error && (
        <div className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
          {helpText}
        </div>
      )}

      {error && (
        <p className="text-rose-500 text-[11px] font-medium">{error}</p>
      )}
    </div>
  );
}

interface AdminCalendarProps {
  selectedEventFromUpcoming?: AdminCalendarEvent | null;
  onClearSelectedUpcoming?: () => void;
  timezone: string;
  onChangeTimezone: (tz: string) => void;
  onEventCountUpdate?: (count: number) => void;
  onOpenCreateWithDate?: (dateStr: string) => void;
  triggerCreateSignal?: number;
}

export function AdminCalendar({
  selectedEventFromUpcoming,
  onClearSelectedUpcoming,
  timezone,
  onChangeTimezone,
  onEventCountUpdate,
  triggerCreateSignal,
}: AdminCalendarProps) {
  const organizations = useSuperAdminStore((s) => s.organizations);
  const subscriptions = useSuperAdminStore((s) => s.subscriptions);
  const invoices = useSuperAdminStore((s) => s.invoices);
  const announcements = useSuperAdminStore((s) => s.announcements);
  const accessApprovals = useSuperAdminStore((s) => s.accessApprovals);
  const incidents = useSuperAdminStore((s) => s.incidents);
  const plans = useSuperAdminStore((s) => s.plans);
  const manualEvents = useSuperAdminStore((s) => s.manualCalendarEvents);

  const addCalendarEvent = useSuperAdminStore((s) => s.addCalendarEvent);
  const updateCalendarEvent = useSuperAdminStore((s) => s.updateCalendarEvent);
  const deleteCalendarEvent = useSuperAdminStore((s) => s.deleteCalendarEvent);
  const rescheduleCalendarEvent = useSuperAdminStore(
    (s) => s.rescheduleCalendarEvent
  );

  const { can } = useAdminPermissions();

  // 1. Live system date & ticking real-time clock (updates every second)
  const [liveNow, setLiveNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => getLocalDateString(liveNow), [liveNow]);
  const liveClockStr = useMemo(() => formatLiveClock(liveNow, timezone), [liveNow, timezone]);
  const minDateTimeStr = useMemo(() => `${todayStr}T00:00`, [todayStr]);

  // Active view date: initialize to live current date
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedOrgId, setSelectedOrgId] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Drawers and Modals
  const [activeEvent, setActiveEvent] = useState<AdminCalendarEvent | null>(
    null
  );
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Form State for Create / Edit (defaults dynamically to upcoming live time)
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] =
    useState<CalendarEventCategory>("Meetings");
  const [formStartDate, setFormStartDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return getLocalDateTimeString(d);
  });
  const [formEndDate, setFormEndDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return getLocalDateTimeString(d);
  });
  const [formAllDay, setFormAllDay] = useState(false);
  const [formOrgId, setFormOrgId] = useState<string>("");
  const [formLocation, setFormLocation] = useState("");
  const [formPriority, setFormPriority] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  >("MEDIUM");
  const [formStatus, setFormStatus] =
    useState<CalendarEventStatus>("SCHEDULED");
  const [formReminder, setFormReminder] =
    useState<CalendarReminder>("30_MIN");
  const [formNotification, setFormNotification] =
    useState<CalendarNotificationChannel>("IN_APP");
  const [formDescription, setFormDescription] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Reschedule Quick State
  const [rescheduleDate, setRescheduleDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return getLocalDateTimeString(d);
  });

  // Responsive Date & Time synchronization handlers
  const handleStartDateChange = (newStart: string) => {
    setFormStartDate(newStart);
    setFormErrors((prev) => ({ ...prev, startDate: "" }));
    try {
      const s = new Date(newStart);
      const e = new Date(formEndDate);
      if (isNaN(e.getTime()) || e <= s) {
        const bumped = new Date(s.getTime() + 60 * 60 * 1000);
        setFormEndDate(getLocalDateTimeString(bumped));
        setFormErrors((prev) => ({ ...prev, endDate: "" }));
      }
    } catch {}
  };

  const handleEndDateChange = (newEnd: string) => {
    setFormEndDate(newEnd);
    setFormErrors((prev) => ({ ...prev, endDate: "" }));
  };

  const handleAddMinutesToEndDate = (mins: number) => {
    try {
      const base = formStartDate ? new Date(formStartDate) : new Date();
      const updated = new Date(base.getTime() + mins * 60 * 1000);
      setFormEndDate(getLocalDateTimeString(updated));
      setFormErrors((prev) => ({ ...prev, endDate: "" }));
    } catch {}
  };

  // Listen to upcoming widget selection
  useEffect(() => {
    if (selectedEventFromUpcoming) {
      setActiveEvent(selectedEventFromUpcoming);
      setIsDetailOpen(true);
      onClearSelectedUpcoming?.();
    }
  }, [selectedEventFromUpcoming, onClearSelectedUpcoming]);

  // Combine auto-generated events and manual events with deduplication
  const allEvents = useMemo(() => {
    const autoEvents = generateSynchronizedCalendarEvents({
      subscriptions,
      invoices,
      announcements,
      accessApprovals,
      incidents,
      organizations,
      plans,
    });

    // Merge manual and auto-generated
    const merged = [...autoEvents, ...manualEvents];

    onEventCountUpdate?.(merged.length);
    return merged;
  }, [
    subscriptions,
    invoices,
    announcements,
    accessApprovals,
    incidents,
    organizations,
    plans,
    manualEvents,
    onEventCountUpdate,
  ]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return allEvents.filter((evt) => {
      // Search keyword
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = evt.title.toLowerCase().includes(q);
        const matchDesc = evt.description?.toLowerCase().includes(q);
        const matchOrg = evt.orgName?.toLowerCase().includes(q);
        const matchCategory = evt.category.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchOrg && !matchCategory) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== "ALL" && evt.category !== selectedCategory) {
        return false;
      }

      // Organization filter
      if (selectedOrgId !== "ALL" && evt.orgId !== selectedOrgId) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "ALL" && evt.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [allEvents, searchQuery, selectedCategory, selectedOrgId, selectedStatus]);

  // Trigger create modal when external signal is sent (e.g. from UpcomingEventsWidget)
  useEffect(() => {
    if (triggerCreateSignal && triggerCreateSignal > 0) {
      handleOpenCreateModal();
    }
  }, [triggerCreateSignal]);

  // Navigation handlers
  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    toast.info(`Jumped to Today: ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);
  };

  const handlePrev = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "month") {
        d.setMonth(d.getMonth() - 1);
      } else if (viewMode === "week") {
        d.setDate(d.getDate() - 7);
      } else if (viewMode === "day") {
        d.setDate(d.getDate() - 1);
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "month") {
        d.setMonth(d.getMonth() + 1);
      } else if (viewMode === "week") {
        d.setDate(d.getDate() + 7);
      } else if (viewMode === "day") {
        d.setDate(d.getDate() + 1);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  };

  // Header Title label calculation
  const headerDateLabel = useMemo(() => {
    if (viewMode === "month" || viewMode === "agenda") {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    if (viewMode === "week") {
      const start = new Date(currentDate);
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      const m1 = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const m2 = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${m1} – ${m2}`;
    }
    return currentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [currentDate, viewMode]);

  // Open Create Modal with optional pre-filled date (RESTRICTED TO TODAY & FUTURE)
  const handleOpenCreateModal = (prefillDate?: string) => {
    // Check if clicked date is in the past
    if (prefillDate && isDayInPast(prefillDate, liveNow)) {
      toast.error(
        "Cannot schedule events on past dates. All scheduling and modifications must be for today or future dates."
      );
      return;
    }

    const targetDateStr = prefillDate || todayStr;
    let initialStart = `${targetDateStr}T10:00`;
    let initialEnd = `${targetDateStr}T11:00`;

    if (targetDateStr === todayStr) {
      const nextHour = new Date(liveNow);
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      const twoHours = new Date(nextHour);
      twoHours.setHours(twoHours.getHours() + 1);
      initialStart = getLocalDateTimeString(nextHour);
      initialEnd = getLocalDateTimeString(twoHours);
    }

    setFormTitle("");
    setFormCategory("Meetings");
    setFormStartDate(initialStart);
    setFormEndDate(initialEnd);
    setFormAllDay(false);
    setFormOrgId("");
    setFormLocation("");
    setFormPriority("MEDIUM");
    setFormStatus("SCHEDULED");
    setFormReminder("30_MIN");
    setFormNotification("IN_APP");
    setFormDescription("");
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal for active event
  const handleOpenEditModal = () => {
    if (!activeEvent) return;
    setFormTitle(activeEvent.title);
    setFormCategory(activeEvent.category);
    setFormStartDate(activeEvent.startDate.slice(0, 16));
    setFormEndDate(activeEvent.endDate.slice(0, 16));
    setFormAllDay(Boolean(activeEvent.allDay));
    setFormOrgId(activeEvent.orgId || "");
    setFormLocation(activeEvent.locationOrUrl || "");
    setFormPriority(activeEvent.priority || "MEDIUM");
    setFormStatus(activeEvent.status);
    setFormReminder(activeEvent.reminder || "NONE");
    setFormNotification(activeEvent.notificationChannel || "IN_APP");
    setFormDescription(activeEvent.description || "");
    setFormErrors({});
    setIsDetailOpen(false);
    setIsEditModalOpen(true);
  };

  // Open Reschedule Modal
  const handleOpenRescheduleModal = () => {
    if (!activeEvent) return;
    const currentEventStart = activeEvent.startDate.slice(0, 16);
    // If the event was in the past, default reschedule proposal to upcoming hour today
    if (isDateInPast(activeEvent.startDate, liveNow)) {
      const nextHour = new Date(liveNow);
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      setRescheduleDate(getLocalDateTimeString(nextHour));
    } else {
      setRescheduleDate(currentEventStart);
    }
    setIsDetailOpen(false);
    setIsRescheduleModalOpen(true);
  };

  // Submit Create with Strict Today/Future Validation
  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formTitle.trim()) {
      errors.title = "Event title is required";
    }
    if (!formStartDate) {
      errors.startDate = "Start date is required";
    }
    if (!formEndDate) {
      errors.endDate = "End date is required";
    }
    if (new Date(formStartDate) > new Date(formEndDate)) {
      errors.endDate = "End date must be after start date";
    }

    // Strict validation: cannot schedule on past dates!
    if (formStartDate && isDateInPast(formStartDate, liveNow)) {
      errors.startDate =
        "Events cannot be scheduled in the past. All changes must be for today or future dates.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.startDate) {
        toast.error(
          "Cannot schedule events on past dates. Please select today or a future date."
        );
      }
      return;
    }

    const matchedOrg = organizations.find((o) => o.id === formOrgId);

    const created = addCalendarEvent({
      title: formTitle.trim(),
      category: formCategory,
      startDate: new Date(formStartDate).toISOString(),
      endDate: new Date(formEndDate).toISOString(),
      allDay: formAllDay,
      orgId: formOrgId || undefined,
      orgName: matchedOrg?.name,
      locationOrUrl: formLocation.trim() || undefined,
      priority: formPriority,
      status: formStatus,
      reminder: formReminder,
      notificationChannel: formNotification,
      timezone,
      description: formDescription.trim() || undefined,
    });

    toast.success(`Scheduled "${created.title}" successfully`);
    setIsCreateModalOpen(false);
    setActiveEvent(created);
    setIsDetailOpen(true);
  };

  // Submit Edit with Strict Today/Future Validation
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent) return;

    const errors: Record<string, string> = {};
    if (!formTitle.trim()) errors.title = "Event title is required";
    if (new Date(formStartDate) > new Date(formEndDate)) {
      errors.endDate = "End date must be after start date";
    }

    // Strict validation: cannot move event dates into the past!
    if (formStartDate && isDateInPast(formStartDate, liveNow)) {
      errors.startDate =
        "Event cannot be scheduled on past dates. All changes must be for today or future dates.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.startDate) {
        toast.error(
          "Cannot move event to a past date. All changes must be for today or future dates."
        );
      }
      return;
    }

    const matchedOrg = organizations.find((o) => o.id === formOrgId);

    if (activeEvent.isAutoGenerated) {
      // If user edits an auto-generated event, create a manual version and notify
      addCalendarEvent({
        title: formTitle.trim(),
        category: formCategory,
        startDate: new Date(formStartDate).toISOString(),
        endDate: new Date(formEndDate).toISOString(),
        allDay: formAllDay,
        orgId: formOrgId || undefined,
        orgName: matchedOrg?.name,
        locationOrUrl: formLocation.trim() || undefined,
        priority: formPriority,
        status: formStatus,
        reminder: formReminder,
        notificationChannel: formNotification,
        timezone,
        description: formDescription.trim() || undefined,
      });
      toast.success(
        `Created manual checkpoint override for "${formTitle.trim()}"`
      );
    } else {
      const res = updateCalendarEvent(activeEvent.id, {
        title: formTitle.trim(),
        category: formCategory,
        startDate: new Date(formStartDate).toISOString(),
        endDate: new Date(formEndDate).toISOString(),
        allDay: formAllDay,
        orgId: formOrgId || undefined,
        orgName: matchedOrg?.name,
        locationOrUrl: formLocation.trim() || undefined,
        priority: formPriority,
        status: formStatus,
        reminder: formReminder,
        notificationChannel: formNotification,
        description: formDescription.trim() || undefined,
      });
      if (res && !res.ok) {
        toast.error(res.error || "Failed to update event");
        return;
      }
      toast.success(`Updated event "${formTitle.trim()}"`);
    }

    setIsEditModalOpen(false);
  };

  // Submit Reschedule with Strict Today/Future Validation
  const handleSaveReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent) return;

    const newStart = new Date(rescheduleDate);
    if (isNaN(newStart.getTime())) {
      toast.error("Please enter a valid reschedule date and time");
      return;
    }

    // Strict validation: cannot reschedule to past dates!
    if (isDateInPast(newStart, liveNow)) {
      toast.error(
        "Cannot reschedule to a past date. All changes can only be done for today and future dates."
      );
      return;
    }

    const originalStart = new Date(activeEvent.startDate);
    const originalEnd = new Date(activeEvent.endDate);
    const durationMs = originalEnd.getTime() - originalStart.getTime();
    const newEnd = new Date(newStart.getTime() + Math.max(1800000, durationMs));

    if (activeEvent.isAutoGenerated) {
      toast.info(
        "Auto-generated checkpoint source record dates must be updated in their origin service."
      );
    } else {
      const res = rescheduleCalendarEvent(
        activeEvent.id,
        newStart.toISOString(),
        newEnd.toISOString()
      );
      if (res && !res.ok) {
        toast.error(res.error || "Failed to reschedule event");
        return;
      }
      toast.success(
        `Rescheduled "${activeEvent.title}" to ${formatInTimezone(
          newStart.toISOString(),
          timezone
        )}`
      );
    }

    setIsRescheduleModalOpen(false);
  };

  // Submit Delete with Confirmation
  const handleConfirmDelete = () => {
    if (!activeEvent) return;

    if (activeEvent.isAutoGenerated) {
      toast.error(
        "Synchronized records cannot be deleted directly from the calendar. Update or resolve the underlying subscription, invoice, or incident."
      );
      setIsDeleteConfirmOpen(false);
      return;
    }

    deleteCalendarEvent(activeEvent.id);
    toast.success(`Removed event "${activeEvent.title}"`);
    setIsDeleteConfirmOpen(false);
    setIsDetailOpen(false);
    setActiveEvent(null);
  };

  // Toggle Completed status
  const handleToggleStatus = (status: CalendarEventStatus) => {
    if (!activeEvent) return;
    if (activeEvent.isAutoGenerated) {
      toast.info("Status is driven by source record state.");
      return;
    }
    updateCalendarEvent(activeEvent.id, { status });
    setActiveEvent((prev) => (prev ? { ...prev, status } : null));
    toast.success(`Event marked as ${status.toLowerCase()}`);
  };

  // ==========================================
  // Calendar Grid Computations for Month View
  // ==========================================
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
    const totalDays = lastDayOfMonth.getDate();

    // Previous month filler days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days: {
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isPast: boolean;
    }[] = [];

    // Leading days from prev month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const str = getLocalDateString(d);
      days.push({
        date: d,
        dateStr: str,
        isCurrentMonth: false,
        isToday: str === todayStr,
        isPast: str < todayStr,
      });
    }

    // Days in current month
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const str = getLocalDateString(d);
      days.push({
        date: d,
        dateStr: str,
        isCurrentMonth: true,
        isToday: str === todayStr,
        isPast: str < todayStr,
      });
    }

    // Trailing days from next month to complete 35 or 42 cells
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const str = getLocalDateString(d);
      days.push({
        date: d,
        dateStr: str,
        isCurrentMonth: false,
        isToday: str === todayStr,
        isPast: str < todayStr,
      });
    }

    return days;
  }, [currentDate, todayStr]);

  // Group events by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map: Record<string, AdminCalendarEvent[]> = {};
    filteredEvents.forEach((evt) => {
      const dateKey = evt.startDate.split("T")[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(evt);
    });
    return map;
  }, [filteredEvents]);

  // Week View Days
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek);

    const days: {
      date: Date;
      dateStr: string;
      dayName: string;
      dayNumber: number;
      isToday: boolean;
      isPast: boolean;
    }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const str = getLocalDateString(d);
      days.push({
        date: d,
        dateStr: str,
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayNumber: d.getDate(),
        isToday: str === todayStr,
        isPast: str < todayStr,
      });
    }
    return days;
  }, [currentDate, todayStr]);

  return (
    <SurfaceCard className="p-4 sm:p-5 transition-all duration-200 hover:border-blue-500/35 overflow-hidden">
      {/* 1. Card Header: Title & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[var(--color-border)]">
        {/* Left: Title & Subtitle */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-blue-500/12 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              Administrative Calendar
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Cross-organization milestones, renewals, audits, and maintenance windows
            </p>
          </div>
        </div>

        {/* Right: Primary Create Event Button */}
        <div className="flex items-center gap-2 shrink-0">
          <AdminButton
            variant="primary"
            size="sm"
            onClick={() => handleOpenCreateModal()}
            className="font-medium shadow-xs transition-transform active:scale-95 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Event</span>
          </AdminButton>
        </div>
      </div>

      {/* 2. Navigation, Date & View Mode Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-3 border-b border-[var(--color-border)]">
        {/* Left: Navigation, Date & Live Clock */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
          <AdminButton
            variant="outline"
            size="xs"
            onClick={handleToday}
            className="font-semibold text-xs h-7 px-2.5"
          >
            Today
          </AdminButton>

          <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 h-7 items-center">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous period"
              className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next period"
              className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-sm font-bold text-[var(--color-text-primary)] px-1 tabular-nums whitespace-nowrap">
            {headerDateLabel}
          </span>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live: {liveClockStr}</span>
          </div>
        </div>

        {/* Right: View Mode Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs">
            {(
              [
                { id: "month", label: "Month" },
                { id: "week", label: "Week" },
                { id: "day", label: "Day" },
                { id: "agenda", label: "Agenda" },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setViewMode(v.id)}
                className={`rounded-md px-2.5 py-1 font-medium transition-all duration-150 ${
                  viewMode === v.id
                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-300 shadow-xs font-semibold"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Filter Strip & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-3 border-b border-[var(--color-border)] text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search events, organizations, runbooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-8 pr-7 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
          >
            <option value="ALL">All Categories</option>
            {CALENDAR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Org Filter */}
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            aria-label="Filter by organization"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
          >
            <option value="ALL">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="Filter by status"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
          >
            <option value="ALL">All Statuses</option>
            {CALENDAR_STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_STYLES[st].label}
              </option>
            ))}
          </select>

          {/* Timezone Selector */}
          <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2 py-1 text-xs">
            <Globe className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <select
              value={timezone}
              onChange={(e) => onChangeTimezone(e.target.value)}
              aria-label="Select timezone"
              className="bg-transparent text-xs text-[var(--color-text-secondary)] font-medium focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
            >
              {SUPPORTED_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Category Legend Badges */}
      <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto text-[11px] no-scrollbar">
        <span className="text-[var(--color-text-muted)] text-[10px] font-semibold uppercase tracking-wider shrink-0 mr-1">
          Legend:
        </span>
        {CALENDAR_CATEGORIES.map((cat) => {
          const st = CATEGORY_STYLES[cat];
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(isSelected ? "ALL" : cat)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-all duration-150 shrink-0 border ${
                st.border
              } ${isSelected ? `${st.bg} ring-1 ring-blue-500` : "bg-[var(--color-app-bg)]"} text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Calendar Views Area */}
      <div className="mt-2 min-w-0">
        {/* ========================================================= */}
        {/* VIEW 1: MONTH VIEW                                         */}
        {/* ========================================================= */}
        {viewMode === "month" && (
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-app-bg)]">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-2 border-r border-[var(--color-border)] last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Month Day Cells */}
            <div className="grid grid-cols-7 divide-y divide-[var(--color-border)]">
              {monthGridDays.map((dayItem, idx) => {
                const dayEvents = eventsByDate[dayItem.dateStr] || [];
                const isCurrent = dayItem.isCurrentMonth;
                const isPast = dayItem.isPast;
                const isToday = dayItem.isToday;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (isPast) {
                        toast.info(
                          `Past dates (${dayItem.dateStr}) are read-only. Events can only be scheduled for today and future dates.`
                        );
                      }
                    }}
                    className={`min-h-[90px] sm:min-h-[110px] p-1.5 sm:p-2 border-r border-[var(--color-border)] last:border-r-0 flex flex-col justify-between transition-colors relative group ${
                      isToday
                        ? "bg-blue-50/40 dark:bg-blue-950/20 ring-1 sm:ring-2 ring-blue-500/50"
                        : isPast
                        ? "bg-slate-500/[0.03] dark:bg-slate-900/30 text-[var(--color-text-muted)]"
                        : isCurrent
                        ? "bg-[var(--color-surface)]"
                        : "bg-[var(--color-app-bg)]/60 text-[var(--color-text-muted)] opacity-60"
                    } hover:bg-[var(--color-hover)]/40`}
                  >
                    {/* Date Number Header */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs font-semibold tabular-nums inline-flex items-center justify-center h-5 w-5 rounded-full ${
                            isToday
                              ? "bg-blue-600 text-white font-bold shadow-xs"
                              : isCurrent
                              ? isPast
                                ? "text-[var(--color-text-muted)] font-normal"
                                : "text-[var(--color-text-primary)]"
                              : "text-[var(--color-text-muted)]"
                          }`}
                        >
                          {dayItem.date.getDate()}
                        </span>
                        {isToday && (
                          <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-blue-600 text-white uppercase tracking-wider hidden sm:inline-flex items-center gap-0.5">
                            <span className="h-1 w-1 rounded-full bg-white animate-ping" />
                            Live
                          </span>
                        )}
                        {isPast && isCurrent && (
                          <span className="text-[8px] text-[var(--color-text-muted)] font-medium px-1 rounded bg-[var(--color-app-bg)] border border-[var(--color-border)] hidden md:inline">
                            Past
                          </span>
                        )}
                      </div>

                      {/* Add event on this day button - LOCKED ON PAST DAYS */}
                      {isPast ? (
                        <span
                          title="Past dates are locked. Events cannot be added in the past."
                          className="opacity-0 group-hover:opacity-75 p-0.5 rounded text-[var(--color-text-muted)] cursor-not-allowed"
                        >
                          <Lock className="w-2.5 h-2.5" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          title={`Add event on ${dayItem.dateStr} (Today or Future)`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCreateModal(dayItem.dateStr);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--color-text-muted)] hover:text-blue-600 hover:bg-[var(--color-surface)] transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Events list */}
                    <div className="space-y-1 flex-1 overflow-hidden">
                      {dayEvents.slice(0, 3).map((evt) => {
                        const st = CATEGORY_STYLES[evt.category] || CATEGORY_STYLES.Meetings;
                        return (
                          <button
                            key={evt.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveEvent(evt);
                              setIsDetailOpen(true);
                            }}
                            className={`w-full text-left rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] font-medium truncate block border transition-all duration-150 hover:brightness-95 hover:scale-[1.02] ${st.bg} ${st.border} ${st.text}`}
                            title={`${evt.title} (${evt.category})`}
                          >
                            <span className="font-semibold mr-1">
                              {evt.allDay ? "" : formatTimeInTimezone(evt.startDate, timezone)}
                            </span>
                            {evt.title}
                          </button>
                        );
                      })}

                      {dayEvents.length > 3 && (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentDate(dayItem.date);
                            setViewMode("day");
                          }}
                          className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline block pt-0.5"
                        >
                          +{dayEvents.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: WEEK VIEW                                          */}
        {/* ========================================================= */}
        {viewMode === "week" && (
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]">
            <div className="grid grid-cols-7 divide-x divide-[var(--color-border)] border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-center">
              {weekDays.map((d) => (
                <div
                  key={d.dateStr}
                  className={`py-2.5 px-1 ${
                    d.isToday ? "bg-blue-500/15 border-b-2 border-blue-600" : d.isPast ? "opacity-70 bg-[var(--color-app-bg)]/40" : ""
                  }`}
                >
                  <div className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase flex items-center justify-center gap-1">
                    {d.dayName}
                    {d.isToday && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </div>
                  <div
                    className={`text-sm font-bold mt-0.5 tabular-nums inline-flex items-center justify-center h-6 w-6 rounded-full ${
                      d.isToday ? "bg-blue-600 text-white shadow-xs" : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {d.dayNumber}
                  </div>
                  {d.isToday && (
                    <span className="block text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-0.5">
                      Live Today
                    </span>
                  )}
                  {d.isPast && (
                    <span className="block text-[8px] text-[var(--color-text-muted)] uppercase tracking-widest mt-0.5">
                      Past
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-[var(--color-border)] min-h-[380px]">
              {weekDays.map((d) => {
                const dayEvents = eventsByDate[d.dateStr] || [];
                return (
                  <div
                    key={d.dateStr}
                    className={`p-2 space-y-2 relative group hover:bg-[var(--color-hover)]/30 transition-colors ${
                      d.isToday ? "bg-blue-50/20 dark:bg-blue-950/10" : d.isPast ? "bg-slate-500/[0.02]" : ""
                    }`}
                  >
                    {d.isPast ? (
                      <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] mb-1 px-0.5">
                        <span className="flex items-center gap-0.5 opacity-60">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenCreateModal(d.dateStr)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-0.5 mb-1 hover:underline cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" /> Add
                      </button>
                    )}

                    {dayEvents.length === 0 ? (
                      <span className="text-[10px] text-[var(--color-text-muted)] italic block text-center pt-8">
                        No events
                      </span>
                    ) : (
                      dayEvents.map((evt) => {
                        const st = CATEGORY_STYLES[evt.category] || CATEGORY_STYLES.Meetings;
                        return (
                          <div
                            key={evt.id}
                            onClick={() => {
                              setActiveEvent(evt);
                              setIsDetailOpen(true);
                            }}
                            className={`rounded-lg border p-2 text-xs cursor-pointer transition-all hover:shadow-xs hover:-translate-y-0.5 ${st.bg} ${st.border} ${st.text}`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span>
                                {evt.allDay ? "All Day" : formatTimeInTimezone(evt.startDate, timezone)}
                              </span>
                              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            </div>
                            <h4 className="font-semibold text-[var(--color-text-primary)] mt-1 line-clamp-2">
                              {evt.title}
                            </h4>
                            {evt.orgName && (
                              <p className="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">
                                {evt.orgName}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: DAY VIEW                                           */}
        {/* ========================================================= */}
        {viewMode === "day" && (
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface)]">
            {(() => {
              const currentDayStr = getLocalDateString(currentDate);
              const isViewingToday = currentDayStr === todayStr;
              const isViewingPast = currentDayStr < todayStr;

              return (
                <div className="space-y-3 pb-3 border-b border-[var(--color-border)] mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                          {currentDate.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </h4>
                        {isViewingToday && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live Today ({liveClockStr})
                          </span>
                        )}
                        {isViewingPast && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                            <Lock className="w-2.5 h-2.5" />
                            Past Date (Read-Only)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        {isViewingPast
                          ? "Historical checkpoints archive. You cannot add or reschedule events to past dates."
                          : "Scheduled checkpoints and window tasks for this date."}
                      </p>
                    </div>

                    {isViewingPast ? (
                      <AdminButton
                        variant="outline"
                        size="xs"
                        onClick={handleToday}
                        className="font-medium text-blue-600 dark:text-blue-400"
                      >
                        <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                        <span>Jump to Today (Live)</span>
                      </AdminButton>
                    ) : (
                      <AdminButton
                        variant="outline"
                        size="xs"
                        onClick={() => handleOpenCreateModal(currentDayStr)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isViewingToday ? "Add Event Today" : "Add Event on this Date"}</span>
                      </AdminButton>
                    )}
                  </div>

                  {isViewingPast && (
                    <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                      <span>
                        Past dates are historical. Event scheduling, editing, and rescheduling are restricted to today and future dates.
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {(() => {
              const dateStr = currentDate.toISOString().split("T")[0];
              const dayEvents = eventsByDate[dateStr] || [];

              if (dayEvents.length === 0) {
                return (
                  <EmptyStateView
                    icon={CalendarIcon}
                    title="No events scheduled for this day"
                    description="You can schedule a subscription renewal review, maintenance window, or meeting."
                    actionLabel="Schedule Event"
                    onAction={() => handleOpenCreateModal(dateStr)}
                  />
                );
              }

              return (
                <div className="space-y-3">
                  {dayEvents.map((evt) => {
                    const st = CATEGORY_STYLES[evt.category] || CATEGORY_STYLES.Meetings;
                    return (
                      <div
                        key={evt.id}
                        onClick={() => {
                          setActiveEvent(evt);
                          setIsDetailOpen(true);
                        }}
                        className={`rounded-xl border p-4 cursor-pointer transition-all hover:border-blue-500/50 hover:shadow-md ${st.bg} ${st.border}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${st.border} ${st.text}`}
                            >
                              <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                              {evt.category}
                            </span>
                            <StatusBadge
                              label={STATUS_STYLES[evt.status].label}
                              tone={STATUS_STYLES[evt.status].tone}
                            />
                            {evt.priority === "CRITICAL" && (
                              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                Critical Priority
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-[var(--color-text-secondary)] font-medium flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                            <span>
                              {evt.allDay
                                ? "All Day"
                                : `${formatTimeInTimezone(evt.startDate, timezone)} – ${formatTimeInTimezone(
                                    evt.endDate,
                                    timezone
                                  )}`}
                            </span>
                          </div>
                        </div>

                        <h4 className="text-sm font-bold text-[var(--color-text-primary)] mt-2">
                          {evt.title}
                        </h4>

                        {evt.description && (
                          <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                            {evt.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] flex-wrap">
                          {evt.orgName && (
                            <span className="flex items-center gap-1 text-[var(--color-text-primary)] font-medium">
                              <Users className="w-3.5 h-3.5 text-blue-500" />
                              {evt.orgName}
                            </span>
                          )}
                          {evt.locationOrUrl && (
                            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <MapPin className="w-3.5 h-3.5" />
                              {evt.locationOrUrl}
                            </span>
                          )}
                          {evt.isAutoGenerated && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                              Synced from {evt.sourceType}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 4: AGENDA VIEW                                        */}
        {/* ========================================================= */}
        {viewMode === "agenda" && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Scheduled Agenda List
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Chronological overview of upcoming administrative checkpoints
                </p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] font-medium">
                {filteredEvents.length} events matching filter
              </span>
            </div>

            {filteredEvents.length === 0 ? (
              <EmptyStateView
                icon={CalendarIcon}
                title="No events match your current filter"
                description="Try clearing search or changing the category filter."
                actionLabel="Reset Filters"
                onAction={() => {
                  setSearchQuery("");
                  setSelectedCategory("ALL");
                  setSelectedOrgId("ALL");
                  setSelectedStatus("ALL");
                }}
              />
            ) : (
              <div className="space-y-2.5">
                {[...filteredEvents]
                  .sort(
                    (a, b) =>
                      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
                  )
                  .map((evt) => {
                    const st = CATEGORY_STYLES[evt.category] || CATEGORY_STYLES.Meetings;
                    const dateFormatted = formatInTimezone(evt.startDate, timezone, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    const timeFormatted = evt.allDay
                      ? "All Day"
                      : `${formatTimeInTimezone(evt.startDate, timezone)} – ${formatTimeInTimezone(
                          evt.endDate,
                          timezone
                        )}`;

                    return (
                      <div
                        key={evt.id}
                        onClick={() => {
                          setActiveEvent(evt);
                          setIsDetailOpen(true);
                        }}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 cursor-pointer transition-all duration-150 hover:border-blue-500/40 hover:bg-[var(--color-hover)] hover:translate-x-0.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${st.bg} ${st.border} ${st.text}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                              {evt.category}
                            </span>
                            {(() => {
                              const rel = getRelativeDateLabel(evt.startDate);
                              if (!rel) return null;
                              const isToday = rel === "Today";
                              const isPast = rel === "Past";
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    isToday
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                      : isPast
                                      ? "bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/25"
                                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                  }`}
                                >
                                  {isToday && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  )}
                                  {isPast && <Lock className="w-2.5 h-2.5" />}
                                  {rel}
                                </span>
                              );
                            })()}
                            <StatusBadge
                              label={STATUS_STYLES[evt.status].label}
                              tone={STATUS_STYLES[evt.status].tone}
                            />
                            {evt.priority === "CRITICAL" && (
                              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                Critical
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-bold text-[var(--color-text-primary)] mt-1.5">
                            {evt.title}
                          </h4>

                          {evt.description && (
                            <p className="text-xs text-[var(--color-text-secondary)] line-clamp-1 mt-0.5">
                              {evt.description}
                            </p>
                          )}
                        </div>

                        <div className="sm:text-right shrink-0">
                          <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                            {dateFormatted}
                          </div>
                          <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1 sm:justify-end mt-0.5">
                            <Clock className="w-3 h-3" />
                            {timeFormatted}
                          </div>
                          {evt.orgName && (
                            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium truncate max-w-[150px] mt-0.5">
                              {evt.orgName}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 5. EVENT DETAIL DRAWER / MODAL                            */}
      {/* ========================================================= */}
      {isDetailOpen && activeEvent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-5 sm:p-6 text-[var(--color-text-primary)] max-h-[90vh] overflow-y-auto space-y-4">
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--color-border)]">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {(() => {
                    const st =
                      CATEGORY_STYLES[activeEvent.category] ||
                      CATEGORY_STYLES.Meetings;
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${st.border} ${st.bg} ${st.text}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                        {activeEvent.category}
                      </span>
                    );
                  })()}
                  <StatusBadge
                    label={STATUS_STYLES[activeEvent.status].label}
                    tone={STATUS_STYLES[activeEvent.status].tone}
                  />
                  {activeEvent.priority && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        activeEvent.priority === "CRITICAL"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          : activeEvent.priority === "HIGH"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {activeEvent.priority} Priority
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  {activeEvent.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Event Timing */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)] font-medium">
                  Date &amp; Time:
                </span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {formatInTimezone(activeEvent.startDate, timezone, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)] font-medium">
                  Window:
                </span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {activeEvent.allDay
                    ? "All Day Event"
                    : `${formatTimeInTimezone(
                        activeEvent.startDate,
                        timezone
                      )} – ${formatTimeInTimezone(
                        activeEvent.endDate,
                        timezone
                      )} (${timezone})`}
                </span>
              </div>
              {activeEvent.reminder && (
                <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
                  <span className="text-[var(--color-text-secondary)] font-medium flex items-center gap-1">
                    <Bell className="w-3 h-3 text-blue-500" /> Reminder:
                  </span>
                  <span className="text-[var(--color-text-primary)]">
                    {activeEvent.reminder.replace("_", " ").toLowerCase()} before
                  </span>
                </div>
              )}
            </div>

            {/* Organization Reference */}
            {activeEvent.orgName && (
              <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3 text-xs bg-[var(--color-app-bg)]">
                <div>
                  <span className="text-[var(--color-text-muted)] text-[10px] uppercase font-bold block">
                    Target Workspace
                  </span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {activeEvent.orgName}
                  </span>
                </div>
                {activeEvent.orgId && (
                  <Link
                    href={`/super-admin/organizations?inspect=${activeEvent.orgId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Inspect Org <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            )}

            {/* Description / Notes */}
            {activeEvent.description && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                  Description &amp; Runbook
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-app-bg)] p-3 rounded-lg border border-[var(--color-border)] leading-relaxed whitespace-pre-wrap">
                  {activeEvent.description}
                </p>
              </div>
            )}

            {/* Location / Video link */}
            {activeEvent.locationOrUrl && (
              <div className="text-xs flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-[var(--color-text-secondary)]">Location:</span>
                <span className="font-semibold text-[var(--color-text-primary)] truncate">
                  {activeEvent.locationOrUrl}
                </span>
              </div>
            )}

            {/* Auto-sync source tag */}
            {activeEvent.isAutoGenerated && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                <div>
                  <span className="font-semibold">Auto-Synchronized Event: </span>
                  Generated automatically from platform{" "}
                  <strong>{activeEvent.sourceType}</strong> records. Source updates dynamically reflect here.
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <AdminButton
                  variant="outline"
                  size="sm"
                  onClick={handleOpenRescheduleModal}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Reschedule</span>
                </AdminButton>

                <AdminButton
                  variant="outline"
                  size="sm"
                  onClick={handleOpenEditModal}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </AdminButton>

                {activeEvent.status !== "COMPLETED" && (
                  <AdminButton
                    variant="subtle"
                    size="sm"
                    onClick={() => handleToggleStatus("COMPLETED")}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Done</span>
                  </AdminButton>
                )}
              </div>

              {!activeEvent.isAutoGenerated && (
                <AdminButton
                  variant="danger"
                  size="sm"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </AdminButton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. CREATE EVENT MODAL                                     */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-5 sm:p-6 text-[var(--color-text-primary)] max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-blue-500/12 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Schedule Administrative Event
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreate} className="space-y-3.5 text-xs">
              {/* Title */}
              <div>
                <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Platform Security Audit & SOC2 Review"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
                />
                {formErrors.title && (
                  <p className="text-rose-500 text-[11px] mt-1">{formErrors.title}</p>
                )}
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as CalendarEventCategory)
                    }
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    {CALENDAR_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) =>
                      setFormPriority(
                        e.target.value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
                      )
                    }
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              {/* Start & End Date with User-Friendly Time Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResponsiveDateTimePicker
                  label="Start Date & Time *"
                  required
                  minDate={todayStr}
                  value={formStartDate}
                  onChange={handleStartDateChange}
                  error={formErrors.startDate}
                  isAllDay={formAllDay}
                  helpText={
                    <>
                      <Clock className="w-3 h-3 text-blue-500" />
                      <span>Today ({todayStr}) or future dates only</span>
                    </>
                  }
                />

                <ResponsiveDateTimePicker
                  label="End Date & Time *"
                  required
                  minDate={formStartDate.split("T")[0] || todayStr}
                  value={formEndDate}
                  onChange={handleEndDateChange}
                  error={formErrors.endDate}
                  isAllDay={formAllDay}
                  quickDurations
                  onAddMinutes={handleAddMinutesToEndDate}
                />
              </div>

              {/* All Day Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create-all-day"
                  checked={formAllDay}
                  onChange={(e) => setFormAllDay(e.target.checked)}
                  className="rounded border-[var(--color-border)] text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="create-all-day"
                  className="font-medium text-[var(--color-text-secondary)] select-none cursor-pointer"
                >
                  All day event
                </label>
              </div>

              {/* Organization & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                    Associated Organization
                  </label>
                  <select
                    value={formOrgId}
                    onChange={(e) => setFormOrgId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="">None (Platform-wide)</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                    Location / Meeting Link
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://meet.google.com/xyz"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Reminder & Notification Channel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                    Reminder
                  </label>
                  <select
                    value={formReminder}
                    onChange={(e) =>
                      setFormReminder(e.target.value as CalendarReminder)
                    }
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="NONE">No Reminder</option>
                    <option value="15_MIN">15 minutes before</option>
                    <option value="30_MIN">30 minutes before</option>
                    <option value="1_HOUR">1 hour before</option>
                    <option value="1_DAY">1 day before</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                    Notification Channel
                  </label>
                  <select
                    value={formNotification}
                    onChange={(e) =>
                      setFormNotification(
                        e.target.value as CalendarNotificationChannel
                      )
                    }
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="IN_APP">In-App Banner Notification</option>
                    <option value="EMAIL">Email Dispatch</option>
                    <option value="BOTH">In-App + Email Broadcast</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                  Description &amp; Runbook Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Add agenda, checklists, deployment links, or attendee briefing..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 text-[11px] text-[var(--color-text-muted)] italic">
                * Simulated notifications and reminders for demonstration purposes.
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
                <AdminButton
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </AdminButton>
                <AdminButton variant="primary" size="sm" type="submit">
                  Save Event
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. EDIT EVENT MODAL                                       */}
      {/* ========================================================= */}
      {isEditModalOpen && activeEvent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-5 sm:p-6 text-[var(--color-text-primary)] max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                Edit Event: {activeEvent.title}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as CalendarEventCategory)
                    }
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    {CALENDAR_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as CalendarEventStatus)
                    }
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    {CALENDAR_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {STATUS_STYLES[st].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start & End Date with User-Friendly Time Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResponsiveDateTimePicker
                  label="Start Date & Time *"
                  required
                  minDate={todayStr}
                  value={formStartDate}
                  onChange={handleStartDateChange}
                  error={formErrors.startDate}
                  isAllDay={formAllDay}
                  helpText={
                    <>
                      <Lock className="w-3 h-3 text-amber-500" />
                      <span>Cannot move into past dates (today or future only)</span>
                    </>
                  }
                />

                <ResponsiveDateTimePicker
                  label="End Date & Time *"
                  required
                  minDate={formStartDate.split("T")[0] || todayStr}
                  value={formEndDate}
                  onChange={handleEndDateChange}
                  error={formErrors.endDate}
                  isAllDay={formAllDay}
                  quickDurations
                  onAddMinutes={handleAddMinutesToEndDate}
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
                <AdminButton
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </AdminButton>
                <AdminButton variant="primary" size="sm" type="submit">
                  Save Changes
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. RESCHEDULE MODAL                                       */}
      {/* ========================================================= */}
      {isRescheduleModalOpen && activeEvent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-5 text-[var(--color-text-primary)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Reschedule Event
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRescheduleModalOpen(false)}
                className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReschedule} className="space-y-3 text-xs">
              <p className="text-[var(--color-text-secondary)]">
                Reschedule <strong>{activeEvent.title}</strong> to a new time window:
              </p>

              <div>
                <ResponsiveDateTimePicker
                  label={`New Start Date & Time (${timezone}) *`}
                  required
                  minDate={todayStr}
                  value={rescheduleDate}
                  onChange={(val) => setRescheduleDate(val)}
                  helpText={
                    <>
                      <Clock className="w-3 h-3 text-blue-500" />
                      <span>Select today ({todayStr}) or a future date/time. Past dates are blocked.</span>
                    </>
                  }
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
                <AdminButton
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsRescheduleModalOpen(false)}
                >
                  Cancel
                </AdminButton>
                <AdminButton variant="primary" size="sm" type="submit">
                  Confirm Reschedule
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. DELETE CONFIRMATION MODAL                              */}
      {/* ========================================================= */}
      {isDeleteConfirmOpen && activeEvent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-[var(--color-surface)] shadow-2xl p-5 text-[var(--color-text-primary)] space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold">Delete Event?</h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Are you sure you want to delete <strong>{activeEvent.title}</strong>? This action will remove the event from your administrative calendar and audit history.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <AdminButton
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancel
              </AdminButton>
              <AdminButton
                variant="danger"
                size="sm"
                type="button"
                onClick={handleConfirmDelete}
              >
                Delete Event
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}
