"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { rolePath, type DeliveryRole } from "./delivery-nav";
import { ArrowLeft, ArrowUpRight, ChevronRight, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EmptyStateView,
  ErrorBanner,
  PageHeader,
  StatusBadge,
  SurfaceCard,
  type StatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import type { AvatarPerson, Health, Priority, ReviewStatus, Severity, TaskStatus } from "@/types/delivery-dashboard";

export type { AvatarPerson, Health, Priority, ReviewStatus, Severity, TaskStatus } from "@/types/delivery-dashboard";

export {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  EmptyStateView,
  ErrorBanner,
  FilterBar,
  StatusBadge,
  SurfaceCard,
  TableSkeleton,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";

/** Returns a function that builds links inside the given role workspace. */
export function useRoleHref(role: DeliveryRole) {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  return useCallback((path = "") => rolePath(role, orgId, path), [role, orgId]);
}

/** Read one query-string value on the client (no Suspense boundary needed). */
export function useQueryParam(name: string) {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return value;
}

/* ============================================================================
 * Formatting helpers (UTC)
 * ========================================================================== */

const DAY_MS = 86_400_000;

function toUtcDate(value: string) {
  return new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
}

export function formatDate(value: string, withYear = false) {
  return toUtcDate(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export function formatDateTime(value: string) {
  return toUtcDate(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days from today (UTC) to the date (negative = in the past). */
export function daysFromToday(date: string) {
  return Math.round((toUtcDate(date.slice(0, 10)).getTime() - toUtcDate(utcToday()).getTime()) / DAY_MS);
}

export function hoursSince(instant: string) {
  return Math.max(0, Math.round((Date.now() - toUtcDate(instant).getTime()) / 3_600_000));
}

export function formatWaiting(hours: number) {
  if (hours < 24) return `${hours}h`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return h ? `${d}d ${h}h` : `${d}d`;
}

export function dueLabel(date: string, done = false): { label: string; tone: StatusTone } {
  const d = daysFromToday(date);
  if (done) return { label: formatDate(date), tone: "neutral" };
  if (d < 0) return { label: `${Math.abs(d)}d overdue`, tone: "danger" };
  if (d === 0) return { label: "Due today", tone: "warning" };
  if (d === 1) return { label: "Due tomorrow", tone: "info" };
  return { label: `Due ${formatDate(date)}`, tone: d <= 5 ? "info" : "neutral" };
}

/* ============================================================================
 * Page load state
 * ========================================================================== */

export type LoadStatus = "loading" | "ready" | "error";

/* ============================================================================
 * Page frame: breadcrumb + back link + header + state handling
 * ========================================================================== */

export interface Crumb {
  label: string;
  href?: string;
}

export function PageFrame({
  crumbs,
  back,
  title,
  description,
  badge,
  actions,
  status = "ready",
  onRetry,
  errorMessage,
  skeleton = "dashboard",
  children,
}: {
  crumbs: Crumb[];
  back?: { href: string; label: string };
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
  status?: LoadStatus;
  onRetry?: () => void;
  errorMessage?: string;
  skeleton?: "dashboard" | "list" | "detail";
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5 min-w-0">
      <div className="space-y-2.5 min-w-0">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[11px] sm:text-xs text-[var(--color-text-muted)] min-w-0">
          {crumbs.map((c, i) => (
            <React.Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" />}
              {c.href && i < crumbs.length - 1 ? (
                <Link href={c.href} className="hover:text-[var(--color-text-primary)] transition-colors truncate max-w-[180px]">
                  {c.label}
                </Link>
              ) : (
                <span className="font-medium text-[var(--color-text-secondary)] truncate max-w-[220px]" aria-current="page">
                  {c.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
        {back && (
          <Link
            href={back.href}
            className="group inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            {back.label}
          </Link>
        )}
        <PageHeader title={title} description={description} badge={badge} actions={actions} />
      </div>

      {status === "loading" && <PageSkeleton variant={skeleton} />}
      {status === "error" && (
        <ErrorBanner message={errorMessage ?? "The workspace service did not respond. Your data is safe — try again."} onRetry={onRetry} />
      )}
      {status === "ready" && <div className="pw-rise space-y-5 min-w-0">{children}</div>}
    </div>
  );
}

export function PageSkeleton({ variant }: { variant: "dashboard" | "list" | "detail" }) {
  const block = "rounded-xl bg-[var(--color-elevated)] border border-[var(--color-border)] animate-pulse";
  if (variant === "list") {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading">
        <div className={cn(block, "h-10")} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn(block, "h-14")} />
        ))}
      </div>
    );
  }
  if (variant === "detail") {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading">
        <div className={cn(block, "h-64 xl:col-span-2")} />
        <div className={cn(block, "h-64")} />
        <div className={cn(block, "h-48 xl:col-span-3")} />
      </div>
    );
  }
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn(block, "h-32")} />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={cn(block, "h-72 xl:col-span-2")} />
        <div className={cn(block, "h-72")} />
      </div>
    </div>
  );
}

export function NotFoundState({ what, back }: { what: string; back: { href: string; label: string } }) {
  const router = useRouter();
  return (
    <SurfaceCard>
      <EmptyStateView
        icon={SearchX}
        title={`${what} not found`}
        description="It may have been removed, or you do not have access to it."
        actionLabel={back.label}
        onAction={() => router.push(back.href)}
      />
    </SurfaceCard>
  );
}

/* ============================================================================
 * KPI tile (mirrors Super Admin dashboard KPI cards)
 * ========================================================================== */

export type Tone = "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose" | "pink" | "teal";

const TONES: Record<Tone, { icon: string; hover: string; footer: string; bar: string }> = {
  blue: { icon: "bg-blue-500/12 text-blue-600 dark:text-blue-400", hover: "hover:border-blue-500/50", footer: "text-blue-600 dark:text-blue-400", bar: "from-blue-500 to-indigo-500" },
  cyan: { icon: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400", hover: "hover:border-cyan-500/50", footer: "text-cyan-600 dark:text-cyan-400", bar: "from-cyan-500 to-sky-500" },
  emerald: { icon: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400", hover: "hover:border-emerald-500/50", footer: "text-emerald-600 dark:text-emerald-400", bar: "from-emerald-500 to-teal-500" },
  violet: { icon: "bg-violet-500/12 text-violet-600 dark:text-violet-400", hover: "hover:border-violet-500/50", footer: "text-violet-600 dark:text-violet-400", bar: "from-violet-500 to-fuchsia-500" },
  amber: { icon: "bg-amber-500/12 text-amber-600 dark:text-amber-400", hover: "hover:border-amber-500/50", footer: "text-amber-600 dark:text-amber-400", bar: "from-amber-500 to-orange-500" },
  rose: { icon: "bg-rose-500/12 text-rose-600 dark:text-rose-400", hover: "hover:border-rose-500/50", footer: "text-rose-600 dark:text-rose-400", bar: "from-rose-500 to-pink-500" },
  pink: { icon: "bg-pink-500/12 text-pink-600 dark:text-pink-400", hover: "hover:border-pink-500/50", footer: "text-pink-600 dark:text-pink-400", bar: "from-pink-500 to-rose-400" },
  teal: { icon: "bg-teal-500/12 text-teal-600 dark:text-teal-400", hover: "hover:border-teal-500/50", footer: "text-teal-600 dark:text-teal-400", bar: "from-teal-500 to-emerald-400" },
};

const CHIP: Record<StatusTone, string> = {
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  neutral: "bg-[var(--color-elevated)] text-[var(--color-text-secondary)]",
};

export function KpiTile({
  label,
  value,
  icon: Icon,
  tone,
  chip,
  meta,
  footer,
  href,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  tone: Tone;
  chip?: { label: string; tone: StatusTone };
  meta?: React.ReactNode;
  footer: string;
  /** Optional: without a destination the tile is a plain card. */
  href?: string;
}) {
  const t = TONES[tone];
  const tile = (
      <SurfaceCard
        className={cn(
          "relative overflow-hidden h-full p-4 flex flex-col justify-between gap-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer",
          t.hover
        )}
      >
        <span className={cn("absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r opacity-80", t.bar)} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate">{label}</span>
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform", t.icon)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text-primary)] tabular-nums">{value}</span>
            {chip && (
              <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-md", CHIP[chip.tone])}>{chip.label}</span>
            )}
          </div>
          {meta && (
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--color-text-muted)] flex-wrap">{meta}</div>
          )}
        </div>
        <div className={cn("pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] font-medium", t.footer)}>
          <span className="truncate">{footer}</span>
          {href && <ArrowUpRight className="w-3.5 h-3.5 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />}
        </div>
      </SurfaceCard>
  );
  if (!href) return <div className="group block rounded-xl min-w-0">{tile}</div>;
  return (
    <Link href={href} className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-w-0">
      {tile}
    </Link>
  );
}

/** A link that looks like the Super Admin primary / outline button. */
export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline" | "subtle";
}) {
  const styles = {
    primary: "bg-[#1A73E8] hover:bg-[#1557B0] text-white dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] shadow-xs",
    outline: "bg-transparent hover:bg-[var(--color-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)]",
    subtle: "bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/20",
  };
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-xs font-medium whitespace-nowrap transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        styles[variant]
      )}
    >
      {children}
    </Link>
  );
}

export function Dot({ className }: { className: string }) {
  return <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", className)} />;
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3.5 min-w-0">{children}</div>;
}

/* ============================================================================
 * Panel (card with header)
 * ========================================================================== */

export function Panel({
  title,
  description,
  icon: Icon,
  iconTone = "blue",
  action,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  iconTone?: Tone;
  action?: { label: string; href: string } | React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const isLinkAction = action && typeof action === "object" && "href" in (action as object) && "label" in (action as object);
  return (
    <SurfaceCard className={cn("flex flex-col transition-shadow duration-200 hover:shadow-md", className)}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-[var(--color-border)]">
        <div className="flex items-start gap-2.5 min-w-0">
          {Icon && (
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", TONES[iconTone].icon)}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{title}</h3>
            {description && <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{description}</p>}
          </div>
        </div>
        {isLinkAction ? (
          <Link
            href={(action as { href: string }).href}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            {(action as { label: string }).label}
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        ) : (
          action && <div className="shrink-0">{action as React.ReactNode}</div>
        )}
      </div>
      <div className={cn("p-4 flex-1 min-w-0", bodyClassName)}>{children}</div>
    </SurfaceCard>
  );
}

/* ============================================================================
 * Small building blocks
 * ========================================================================== */

export function ProgressBar({
  value,
  planned,
  color,
  size = "md",
  showLabel = false,
}: {
  value: number;
  planned?: number;
  color?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  const v = Math.max(0, Math.min(100, value));
  const auto = v >= 75 ? "#10B981" : v >= 45 ? "#3B82F6" : v >= 25 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-2 min-w-0 w-full">
      <div className={cn("relative flex-1 rounded-full bg-[var(--color-elevated)] border border-[var(--color-border)] overflow-hidden", size === "sm" ? "h-1.5" : "h-2")}>
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${v}%`, backgroundColor: color || auto }}
        />
        {planned !== undefined && (
          <span
            title={`Planned ${planned}%`}
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--color-text-primary)]/60"
            style={{ left: `${Math.min(100, planned)}%` }}
          />
        )}
      </div>
      {showLabel && <span className="text-[11px] font-semibold tabular-nums text-[var(--color-text-primary)] w-9 text-right shrink-0">{v}%</span>}
    </div>
  );
}

export function Avatar({ person, size = "md" }: { person?: Pick<AvatarPerson, "initials" | "color" | "name"> | null; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-6 w-6 text-[9px]", md: "h-8 w-8 text-[11px]", lg: "h-14 w-14 text-base" };
  if (!person) {
    return (
      <span className={cn("inline-flex items-center justify-center rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] shrink-0", sizes[size])}>
        ?
      </span>
    );
  }
  return (
    <span
      title={person.name}
      className={cn("inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 ring-2 ring-[var(--color-surface)]", sizes[size])}
      style={{ backgroundColor: person.color }}
    >
      {person.initials}
    </span>
  );
}

export function AvatarStack({ people, max = 4 }: { people: Pick<AvatarPerson, "id" | "initials" | "color" | "name">[]; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p) => (
        <Avatar key={p.id} person={p} size="sm" />
      ))}
      {people.length > max && (
        <span className="h-6 w-6 rounded-full bg-[var(--color-elevated)] border border-[var(--color-border)] text-[9px] font-semibold flex items-center justify-center text-[var(--color-text-secondary)]">
          +{people.length - max}
        </span>
      )}
    </div>
  );
}

export function utilisationTone(pct: number): { color: string; tone: StatusTone; label: string } {
  if (pct > 100) return { color: "#EF4444", tone: "danger", label: "Over capacity" };
  if (pct >= 85) return { color: "#F59E0B", tone: "warning", label: "Near capacity" };
  if (pct >= 60) return { color: "#10B981", tone: "success", label: "Healthy" };
  return { color: "#3B82F6", tone: "info", label: "Has room" };
}

/* ============================================================================
 * Status badges
 * ========================================================================== */

const HEALTH: Record<Health, [string, StatusTone]> = {
  ON_TRACK: ["On track", "success"],
  AT_RISK: ["At risk", "warning"],
  OFF_TRACK: ["Off track", "danger"],
};
export function HealthBadge({ health }: { health: Health }) {
  const [label, tone] = HEALTH[health];
  return <StatusBadge label={label} tone={tone} dot />;
}

const TASK: Record<TaskStatus, [string, StatusTone]> = {
  TODO: ["To do", "neutral"],
  IN_PROGRESS: ["In progress", "info"],
  IN_REVIEW: ["In review", "violet"],
  BLOCKED: ["Blocked", "danger"],
  DONE: ["Done", "success"],
};
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  BLOCKED: "Blocked",
  DONE: "Done",
};
export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: "#94A3B8",
  IN_PROGRESS: "#3B82F6",
  IN_REVIEW: "#8B5CF6",
  BLOCKED: "#EF4444",
  DONE: "#10B981",
};
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const [label, tone] = TASK[status];
  return <StatusBadge label={label} tone={tone} dot />;
}

const PRIORITY: Record<Priority, [string, StatusTone]> = {
  LOW: ["Low", "neutral"],
  MEDIUM: ["Medium", "info"],
  HIGH: ["High", "warning"],
  CRITICAL: ["Critical", "danger"],
};
export function PriorityBadge({ priority }: { priority: Priority }) {
  const [label, tone] = PRIORITY[priority];
  return <StatusBadge label={label} tone={tone} />;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const [label, tone] = PRIORITY[severity];
  return <StatusBadge label={label} tone={tone} dot />;
}

const REVIEW: Record<ReviewStatus, [string, StatusTone]> = {
  PENDING: ["Awaiting review", "warning"],
  APPROVED: ["Approved", "success"],
  CHANGES_REQUESTED: ["Changes requested", "danger"],
};
export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const [label, tone] = REVIEW[status];
  return <StatusBadge label={label} tone={tone} dot />;
}

/* ============================================================================
 * Responsive data table (columns drop at narrow widths; rows open a page)
 * ========================================================================== */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  /** Hide this column below the given breakpoint. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
}

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  rowHref,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowHref?: (row: T) => string;
  empty?: { icon: React.ElementType; title: string; description: string };
}) {
  const router = useRouter();
  if (rows.length === 0 && empty) {
    return <EmptyStateView icon={empty.icon} title={empty.title} description={empty.description} />;
  }
  return (
    <table className="w-full table-fixed text-xs">
      <thead>
        <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {columns.map((c) => (
            <th key={c.key} scope="col" className={cn("px-4 py-2.5 font-semibold", c.hideBelow && HIDE[c.hideBelow], c.className)}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--color-border)]">
        {rows.map((row) => {
          const href = rowHref?.(row);
          return (
            <tr
              key={row.id}
              onClick={href ? () => router.push(href) : undefined}
              onKeyDown={href ? (e) => e.key === "Enter" && router.push(href) : undefined}
              tabIndex={href ? 0 : undefined}
              className={cn(
                "transition-colors",
                href && "cursor-pointer hover:bg-[var(--color-hover)] focus:outline-none focus-visible:bg-[var(--color-hover)]"
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3 align-middle min-w-0", c.hideBelow && HIDE[c.hideBelow], c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** A clickable list row used in dashboard widgets. */
export function LinkRow({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 -mx-1 transition-all duration-200 hover:border-[var(--color-border)] hover:bg-[var(--color-hover)] hover:translate-x-0.5 min-w-0",
        className
      )}
    >
      {children}
      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

export function StatPill({ label, value, tone = "neutral" }: { label: string; value: React.ReactNode; tone?: StatusTone }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] truncate">{label}</p>
      <p className={cn("mt-0.5 text-sm font-bold tabular-nums truncate", tone === "danger" ? "text-rose-600 dark:text-rose-400" : tone === "warning" ? "text-amber-600 dark:text-amber-400" : tone === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-text-primary)]")}>
        {value}
      </p>
    </div>
  );
}

export function SegmentTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
            value === o.value
              ? "bg-[var(--color-surface)] text-blue-700 dark:text-blue-300 shadow-subtle"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1 text-[var(--color-text-muted)]">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
