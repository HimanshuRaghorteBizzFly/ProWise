import {
  AccessApprovalRequest,
  AdminCalendarEvent,
  Announcement,
  BillingPlan,
  CalendarEventCategory,
  CalendarEventStatus,
  IncidentGovernanceItem,
  Invoice,
  Subscription,
  TenantOrganization,
} from "../_types";
import { formatCurrency } from "./super-admin-service";

export const CALENDAR_CATEGORIES: CalendarEventCategory[] = [
  "Subscription Renewals",
  "Invoice Due Dates",
  "Maintenance Windows",
  "Security Reviews",
  "Access Approval Expiry",
  "Meetings",
  "Announcements",
];

export const CALENDAR_STATUSES: CalendarEventStatus[] = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "PENDING",
  "CANCELLED",
];

export const CATEGORY_STYLES: Record<
  CalendarEventCategory,
  {
    bg: string;
    border: string;
    text: string;
    dot: string;
    badgeTone: "success" | "warning" | "danger" | "info" | "neutral" | "violet";
  }
> = {
  "Subscription Renewals": {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    border: "border-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    badgeTone: "success",
  },
  "Invoice Due Dates": {
    bg: "bg-amber-500/10 dark:bg-amber-500/15",
    border: "border-amber-500/30",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    badgeTone: "warning",
  },
  "Maintenance Windows": {
    bg: "bg-violet-500/10 dark:bg-violet-500/15",
    border: "border-violet-500/30",
    text: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
    badgeTone: "violet",
  },
  "Security Reviews": {
    bg: "bg-rose-500/10 dark:bg-rose-500/15",
    border: "border-rose-500/30",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    badgeTone: "danger",
  },
  "Access Approval Expiry": {
    bg: "bg-sky-500/10 dark:bg-sky-500/15",
    border: "border-sky-500/30",
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
    badgeTone: "info",
  },
  Meetings: {
    bg: "bg-blue-500/10 dark:bg-blue-500/15",
    border: "border-blue-500/30",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
    badgeTone: "info",
  },
  Announcements: {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/15",
    border: "border-indigo-500/30",
    text: "text-indigo-700 dark:text-indigo-300",
    dot: "bg-indigo-500",
    badgeTone: "neutral",
  },
};

export const STATUS_STYLES: Record<
  CalendarEventStatus,
  {
    label: string;
    tone: "success" | "warning" | "danger" | "info" | "neutral";
  }
> = {
  SCHEDULED: { label: "Scheduled", tone: "info" },
  IN_PROGRESS: { label: "In Progress", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  PENDING: { label: "Pending", tone: "warning" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const SUPPORTED_TIMEZONES = [
  { value: "LOCAL", label: "Local Device Timezone" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "Eastern Time (US / EST)" },
  { value: "America/Chicago", label: "Central Time (US / CST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US / PST)" },
  { value: "Europe/London", label: "London (GMT / BST)" },
  { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
];

/** Formats a date string in the chosen timezone */
export function formatInTimezone(
  isoDateStr: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!isoDateStr) return "—";
  const date = new Date(isoDateStr);
  if (Number.isNaN(date.getTime())) return isoDateStr;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(timezone !== "LOCAL" ? { timeZone: timezone } : {}),
    ...options,
  };

  try {
    return new Intl.DateTimeFormat("en-US", defaultOptions).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }
}

/** Formats short time in chosen timezone */
export function formatTimeInTimezone(isoDateStr: string, timezone: string): string {
  if (!isoDateStr) return "";
  const date = new Date(isoDateStr);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...(timezone !== "LOCAL" ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

/** Returns YYYY-MM-DD in local time */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns YYYY-MM-DDTHH:mm for datetime-local input in local time */
export function getLocalDateTimeString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Returns start of today (midnight 00:00:00) */
export function getStartOfToday(referenceDate: Date = new Date()): Date {
  const d = new Date(referenceDate);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Check if a date is strictly before today */
export function isDateInPast(date: string | Date, referenceDate: Date = new Date()): boolean {
  if (!date) return false;
  const target = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(target.getTime())) return false;
  const startOfToday = getStartOfToday(referenceDate);
  return target.getTime() < startOfToday.getTime();
}

/** Check if a YYYY-MM-DD date string is strictly before today */
export function isDayInPast(dateStr: string, referenceDate: Date = new Date()): boolean {
  if (!dateStr) return false;
  const todayStr = getLocalDateString(referenceDate);
  const cmp = dateStr.slice(0, 10);
  return cmp < todayStr;
}

/** Returns relative human badge: Today, Tomorrow, In X days, etc. */
export function getRelativeDateLabel(date: string | Date, referenceDate: Date = new Date()): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";

  const targetStr = getLocalDateString(d);
  const todayStr = getLocalDateString(referenceDate);

  if (targetStr === todayStr) return "Today";

  const diffTime = d.getTime() - referenceDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays > 7) return `In ${Math.round(diffDays / 7)}w`;
  if (diffDays < -1) return "Past";

  return "";
}

/** Formats a live ticking clock string with seconds */
export function formatLiveClock(d: Date = new Date(), timezone: string = "LOCAL"): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      ...(timezone !== "LOCAL" ? { timeZone: timezone } : {}),
    }).format(d);
  } catch {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
}

/**
 * Automatically synthesizes platform records (subscriptions, invoices, maintenance,
 * approvals, and incidents) into deduplicated calendar events.
 */
export function generateSynchronizedCalendarEvents(params: {
  subscriptions: Subscription[];
  invoices: Invoice[];
  announcements: Announcement[];
  accessApprovals: AccessApprovalRequest[];
  incidents: IncidentGovernanceItem[];
  organizations: TenantOrganization[];
  plans: BillingPlan[];
}): AdminCalendarEvent[] {
  const {
    subscriptions,
    invoices,
    announcements,
    accessApprovals,
    incidents,
    organizations,
    plans,
  } = params;

  const orgMap = new Map(organizations.map((o) => [o.id, o]));
  const planMap = new Map(plans.map((p) => [p.id, p]));
  const events: AdminCalendarEvent[] = [];

  // 1. Subscriptions -> Subscription Renewals
  subscriptions.forEach((sub) => {
    if (!sub.currentPeriodEnd) return;
    const org = orgMap.get(sub.orgId);
    const plan = planMap.get(sub.planId);
    const dateStr = sub.currentPeriodEnd.includes("T")
      ? sub.currentPeriodEnd
      : `${sub.currentPeriodEnd}T18:00:00Z`;

    events.push({
      id: `sync-sub-${sub.id}`,
      title: `Subscription Renewal: ${org?.name || "Workspace"} (${plan?.name || "Custom"})`,
      category: "Subscription Renewals",
      startDate: dateStr,
      endDate: dateStr,
      allDay: true,
      status: sub.status === "ACTIVE" ? "SCHEDULED" : sub.status === "PAST_DUE" ? "PENDING" : "CANCELLED",
      description: `Automated ${sub.billingCycle.toLowerCase()} renewal of ${sub.seats} seats (${formatCurrency(
        sub.amount
      )}). Auto-renew is ${sub.autoRenew ? "enabled" : "disabled"}. Payment method: ${sub.paymentMethodLabel}.`,
      orgId: sub.orgId,
      orgName: org?.name,
      priority: sub.status === "PAST_DUE" ? "HIGH" : "MEDIUM",
      reminder: "1_DAY",
      notificationChannel: "EMAIL",
      isAutoGenerated: true,
      sourceRecordId: sub.id,
      sourceType: "subscription",
      createdAt: sub.updatedAt,
      updatedAt: sub.updatedAt,
    });
  });

  // 2. Invoices -> Invoice Due Dates
  invoices.forEach((inv) => {
    if (!inv.dueDate) return;
    const org = orgMap.get(inv.orgId);
    const dateStr = inv.dueDate.includes("T") ? inv.dueDate : `${inv.dueDate}T17:00:00Z`;

    events.push({
      id: `sync-inv-${inv.id}`,
      title: `Invoice Due: ${inv.invoiceNumber} (${formatCurrency(inv.total)})`,
      category: "Invoice Due Dates",
      startDate: dateStr,
      endDate: dateStr,
      allDay: true,
      status: inv.status === "PAID" ? "COMPLETED" : inv.status === "OVERDUE" ? "PENDING" : "SCHEDULED",
      description: `Commercial invoice ${inv.invoiceNumber} due for ${org?.name || "Tenant"}. Status: ${
        inv.status
      }. Total balance: ${formatCurrency(inv.total)} USD.`,
      orgId: inv.orgId,
      orgName: org?.name,
      priority: inv.status === "OVERDUE" ? "CRITICAL" : "HIGH",
      reminder: "1_DAY",
      notificationChannel: "EMAIL",
      isAutoGenerated: true,
      sourceRecordId: inv.id,
      sourceType: "invoice",
      createdAt: inv.createdAt,
      updatedAt: inv.paidAt || inv.createdAt,
    });
  });

  // 3. Announcements -> Maintenance Windows & Announcements
  announcements.forEach((anc) => {
    const rawDate = anc.scheduledFor || anc.publishedAt || anc.createdAt;
    if (!rawDate) return;
    const isMaintenance = anc.type === "MAINTENANCE";

    events.push({
      id: `sync-anc-${anc.id}`,
      title: isMaintenance ? anc.title : `Announcement Broadcast: ${anc.title}`,
      category: isMaintenance ? "Maintenance Windows" : "Announcements",
      startDate: rawDate,
      endDate: anc.expiresAt || rawDate,
      allDay: false,
      status:
        anc.status === "PUBLISHED"
          ? "COMPLETED"
          : anc.status === "SCHEDULED"
          ? "SCHEDULED"
          : "PENDING",
      description: anc.message,
      locationOrUrl: "Global Platform Notification Engine",
      priority: anc.type === "CRITICAL" ? "CRITICAL" : isMaintenance ? "HIGH" : "MEDIUM",
      reminder: "1_HOUR",
      notificationChannel: "BOTH",
      isAutoGenerated: true,
      sourceRecordId: anc.id,
      sourceType: isMaintenance ? "maintenance" : "announcement",
      createdAt: anc.createdAt,
      updatedAt: anc.updatedAt,
    });
  });

  // 4. Access Approvals -> Access Approval Expiry
  accessApprovals.forEach((appr) => {
    if (!appr.requestedAt) return;
    const reqDate = new Date(appr.requestedAt);
    const expiryDate = new Date(reqDate.getTime() + (appr.expiresInHours || 4) * 3600 * 1000);

    events.push({
      id: `sync-appr-${appr.id}`,
      title: `Access Window Expiry: ${appr.operatorName} (${appr.ticketRef})`,
      category: "Access Approval Expiry",
      startDate: appr.requestedAt,
      endDate: expiryDate.toISOString(),
      allDay: false,
      status: appr.status === "APPROVED" ? "SCHEDULED" : appr.status === "PENDING" ? "PENDING" : "CANCELLED",
      description: `Elevated support access requested by ${appr.operatorName} for ${appr.targetOrgName}. Ticket: ${appr.ticketRef}. Reason: ${appr.reason}`,
      orgId: appr.targetOrgId,
      orgName: appr.targetOrgName,
      priority: appr.status === "PENDING" ? "HIGH" : "MEDIUM",
      reminder: "30_MIN",
      notificationChannel: "IN_APP",
      isAutoGenerated: true,
      sourceRecordId: appr.id,
      sourceType: "access_approval",
      createdAt: appr.requestedAt,
      updatedAt: appr.reviewedAt || appr.requestedAt,
    });
  });

  // 5. Active Incidents -> Security Reviews & Maintenance
  incidents.forEach((inc) => {
    events.push({
      id: `sync-inc-${inc.id}`,
      title: `Security Review Checkpoint: ${inc.incidentCode} (${inc.title})`,
      category: "Security Reviews",
      startDate: inc.updatedAt || inc.createdAt,
      endDate: inc.updatedAt || inc.createdAt,
      allDay: false,
      status: inc.status === "Resolved" ? "COMPLETED" : "IN_PROGRESS",
      description: `Incident governance checkpoint for ${inc.incidentCode}. Severity: ${inc.severity}. Status: ${inc.status}. Affected: ${inc.affectedAreas.join(", ")}.`,
      priority: inc.severity === "Critical" ? "CRITICAL" : "HIGH",
      reminder: "1_HOUR",
      notificationChannel: "BOTH",
      isAutoGenerated: true,
      sourceRecordId: inc.id,
      sourceType: "incident",
      createdAt: inc.createdAt,
      updatedAt: inc.updatedAt,
    });
  });

  return events;
}
