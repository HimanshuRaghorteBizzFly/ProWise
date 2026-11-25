"use client";

import React from "react";
import {
  Lock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Search,
  X,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================================
 * 1. PAGE HEADER (SUPER ADMIN SPACING & STRUCTURE)
 * ============================================================================ */

export interface ViewerPageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  readOnly?: boolean;
  actions?: React.ReactNode;
}

export function ViewerPageHeader({
  title,
  description,
  badge,
  readOnly = true,
  actions,
}: ViewerPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text-primary,#202124)] truncate">
            {title}
          </h1>
          {badge && (
            <span className="inline-flex items-center rounded-md border border-[var(--color-border,#E2E8F0)] bg-[var(--color-elevated,#FFFFFF)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary,#5F6368)]">
              {badge}
            </span>
          )}
          {readOnly && (
            <span
              title="Stakeholder Viewer role: Read-only governance. Mutations are restricted."
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 select-none"
            >
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Read-Only</span>
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary,#5F6368)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

/* ============================================================================
 * 2. MODERN SAAS SERIAL BADGE (NO HASH, USER-FRIENDLY & INTERACTIVE)
 * ============================================================================ */

export function ViewerSerialBadge({
  num,
  className,
}: {
  num: number | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-md font-mono text-xs font-semibold tabular-nums text-[var(--color-text-secondary,#5F6368)] bg-[var(--color-app-bg,#F8FAFD)] border border-[var(--color-border,#E2E8F0)] hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 dark:hover:border-blue-800 transition-colors select-none shadow-2xs",
        className
      )}
      title={`Record Row ${num}`}
    >
      {num}
    </span>
  );
}

/* ============================================================================
 * 3. SURFACE CARDS & BUTTONS
 * ============================================================================ */

export function ViewerSurfaceCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] text-[var(--color-text-primary,#202124)] shadow-xs min-w-0 transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ViewerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "subtle";
  size?: "xs" | "sm" | "md";
  isLoading?: boolean;
}

export const ViewerButton = React.forwardRef<HTMLButtonElement, ViewerButtonProps>(
  (
    {
      className,
      variant = "outline",
      size = "sm",
      isLoading,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      xs: "h-7 px-2.5 text-xs rounded-md gap-1",
      sm: "h-8 sm:h-9 px-3 text-xs font-medium rounded-lg gap-1.5",
      md: "h-9 sm:h-10 px-4 text-sm font-medium rounded-lg gap-2",
    };

    const variantClasses = {
      primary:
        "bg-blue-600 text-white hover:bg-blue-700 border border-blue-600 shadow-xs",
      secondary:
        "bg-[var(--color-elevated,#FFFFFF)] text-[var(--color-text-primary,#202124)] hover:bg-[var(--color-hover,#EEF3FB)] border border-[var(--color-border,#E2E8F0)]",
      outline:
        "bg-[var(--color-surface,#FFFFFF)] text-[var(--color-text-primary,#202124)] hover:bg-[var(--color-hover,#EEF3FB)] border border-[var(--color-border,#E2E8F0)]",
      ghost:
        "bg-transparent text-[var(--color-text-secondary,#5F6368)] hover:bg-[var(--color-hover,#EEF3FB)] hover:text-[var(--color-text-primary,#202124)]",
      danger:
        "bg-rose-600 text-white hover:bg-rose-700 border border-rose-600",
      subtle:
        "bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 border border-blue-500/20",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center transition-colors font-medium select-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {isLoading && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent mr-1" />
        )}
        {children}
      </button>
    );
  }
);
ViewerButton.displayName = "ViewerButton";

/* ============================================================================
 * 4. KPI CARDS (SUPER ADMIN SPACING)
 * ============================================================================ */

export interface ViewerKpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: { value: string; positive?: boolean };
  icon: React.ElementType;
  tone?: "blue" | "emerald" | "violet" | "amber" | "rose" | "slate";
}

export function ViewerKpiCard({
  label,
  value,
  sublabel,
  trend,
  icon: Icon,
  tone = "blue",
}: ViewerKpiCardProps) {
  const toneMap = {
    blue: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
    slate: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  };

  return (
    <ViewerSurfaceCard className="p-4 flex flex-col justify-between gap-2.5 hover:border-blue-500/40 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--color-text-secondary,#5F6368)] truncate">
          {label}
        </span>
        <div
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
            toneMap[tone]
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text-primary,#202124)]">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-[11px] font-semibold px-1.5 py-0.5 rounded-md",
              trend.positive
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      {sublabel && (
        <p className="text-[11px] text-[var(--color-text-muted,#80868B)] truncate">
          {sublabel}
        </p>
      )}
    </ViewerSurfaceCard>
  );
}

/* ============================================================================
 * 5. FILTER BAR (SUPER ADMIN PATTERN)
 * ============================================================================ */

export interface ViewerFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  onExportCsv?: () => void;
  exportDisabled?: boolean;
  rightActions?: React.ReactNode;
}

export function ViewerFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search table data...",
  filters,
  onResetFilters,
  hasActiveFilters,
  onExportCsv,
  exportDisabled,
  rightActions,
}: ViewerFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between min-w-0">
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
        <div className="relative w-full sm:w-64 md:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted,#80868B)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 w-full rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] pl-8 pr-8 text-xs sm:text-sm text-[var(--color-text-primary,#202124)] placeholder:text-[var(--color-text-muted,#80868B)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted,#80868B)] hover:text-[var(--color-text-primary,#202124)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {filters}

        {hasActiveFilters && onResetFilters && (
          <ViewerButton variant="ghost" size="sm" onClick={onResetFilters}>
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </ViewerButton>
        )}
      </div>

      {(onExportCsv || rightActions) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onExportCsv && (
            <ViewerButton
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              disabled={exportDisabled}
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </ViewerButton>
          )}
          {rightActions}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 6. PAGINATION BAR (SUPER ADMIN PATTERN)
 * ============================================================================ */

export interface ViewerPaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function ViewerPaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ViewerPaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-[var(--color-border,#E2E8F0)] px-4 py-3 text-xs text-[var(--color-text-secondary,#5F6368)]">
      <div className="flex items-center gap-3 flex-wrap">
        <span>
          Showing <strong className="text-[var(--color-text-primary,#202124)] font-mono">{start}</strong>–
          <strong className="text-[var(--color-text-primary,#202124)] font-mono">{end}</strong> of{" "}
          <strong className="text-[var(--color-text-primary,#202124)] font-mono">{totalItems}</strong> entries
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-7 rounded-md border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
            >
              {[5, 10, 20, 50].map((n) => (
                <option
                  key={n}
                  value={n}
                  className="bg-[var(--color-surface,#FFFFFF)] text-[var(--color-text-primary,#202124)]"
                >
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] text-[var(--color-text-primary,#202124)] hover:bg-[var(--color-hover,#EEF3FB)] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="px-2 text-xs font-medium">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] text-[var(--color-text-primary,#202124)] hover:bg-[var(--color-hover,#EEF3FB)] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
 * 7. STATUS BADGES & HELPERS
 * ============================================================================ */

export type ViewerStatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "violet";

export function ViewerStatusBadge({
  label,
  tone = "neutral",
  dot = false,
  className,
}: {
  label: string;
  tone?: ViewerStatusTone;
  dot?: boolean;
  className?: string;
}) {
  const tones: Record<ViewerStatusTone, string> = {
    success:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    warning:
      "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/25",
    danger:
      "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25",
    info:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25",
    violet:
      "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25",
    neutral:
      "bg-[var(--color-elevated,#FFFFFF)] text-[var(--color-text-secondary,#5F6368)] border-[var(--color-border,#E2E8F0)]",
  };

  const dotTones: Record<ViewerStatusTone, string> = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    info: "bg-blue-500",
    violet: "bg-violet-500",
    neutral: "bg-slate-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tones[tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotTones[tone])} />}
      <span>{label}</span>
    </span>
  );
}

export function ReadOnlyBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 select-none",
        className
      )}
      title="You possess read-only governance authority. Mutations are restricted."
    >
      <Lock className="w-3 h-3 text-slate-500" />
      <span>Read-Only</span>
    </span>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionText,
  onAction,
}: {
  icon?: React.ElementType;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)]/50 my-4">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-[var(--color-text-primary,#202124)]">{title}</h3>
      <p className="text-xs text-[var(--color-text-secondary,#5F6368)] max-w-sm mt-1">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({
  count = 3,
  type = "card",
}: {
  count?: number;
  type?: "card" | "row" | "metric";
}) {
  if (type === "metric") {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (type === "row") {
    return (
      <div className="space-y-2 animate-pulse p-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800/80" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-44 rounded-xl bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Unable to load data",
  description = "A temporary connection issue occurred while fetching read-only records.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30 text-center my-4">
      <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
      <h3 className="text-sm font-bold text-red-800 dark:text-red-300">{title}</h3>
      <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-md mx-auto">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export function PaginationControl(props: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}) {
  return (
    <ViewerPaginationBar
      currentPage={props.currentPage}
      totalItems={props.totalItems}
      pageSize={props.pageSize}
      onPageChange={props.onPageChange}
    />
  );
}
