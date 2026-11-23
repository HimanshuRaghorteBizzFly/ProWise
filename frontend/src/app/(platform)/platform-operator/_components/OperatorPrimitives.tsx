"use client";

import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FlaskConical,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

export function PageHeader({
  title,
  description,
  badge,
  demoLabel = "Demo Data (Simulated)",
  actions,
}: {
  title: string;
  description?: string;
  badge?: string;
  demoLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text-primary)] truncate">
            {title}
          </h2>
          {badge && (
            <span className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
              {badge}
            </span>
          )}
          {demoLabel && (
            <span
              title="Uses persistent simulated telemetry until connected to live Spring Boot services."
              className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300"
            >
              <FlaskConical className="w-3 h-3 shrink-0" />
              <span>{demoLabel}</span>
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function DemoDataBanner({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3.5 py-2.5 text-xs text-teal-900 dark:text-teal-200",
        className
      )}
    >
      <FlaskConical className="w-4 h-4 shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
      <div className="min-w-0">
        <span className="font-semibold">{title}: </span>
        <span className="text-teal-800 dark:text-teal-200/90">{description}</span>
      </div>
    </div>
  );
}

export function SurfaceCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-subtle min-w-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface OpButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "subtle";
  size?: "xs" | "sm" | "md";
  isLoading?: boolean;
}

export const OpButton = React.forwardRef<HTMLButtonElement, OpButtonProps>(
  ({ className, variant = "primary", size = "sm", isLoading, disabled, children, ...props }, ref) => {
    const isDisabled = Boolean(disabled || isLoading);
    const variantStyles = {
      primary:
        "bg-[#0D9488] hover:bg-[#0F766E] active:bg-[#115E59] text-white dark:bg-[#0D9488] dark:hover:bg-[#14B8A6] dark:text-white shadow-xs",
      secondary:
        "bg-[var(--color-elevated)] hover:bg-[var(--color-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)]",
      outline:
        "bg-transparent hover:bg-[var(--color-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)]",
      ghost:
        "bg-transparent hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
      danger: "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-xs",
      subtle:
        "bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/25",
    };
    const sizeStyles = {
      xs: "h-7 px-2.5 text-[11px] gap-1 rounded-lg",
      sm: "h-9 px-3.5 text-xs gap-1.5 rounded-lg",
      md: "h-10 px-4 text-sm gap-2 rounded-lg",
    };

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50 disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);
OpButton.displayName = "OpButton";

export interface OpInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const OpInput = React.forwardRef<HTMLInputElement, OpInputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? `op-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
    return (
      <div className="w-full space-y-1.5 min-w-0">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-red-500 dark:text-red-400">{error}</p>}
        {helperText && !error && <p className="text-[11px] text-[var(--color-text-muted)]">{helperText}</p>}
      </div>
    );
  }
);
OpInput.displayName = "OpInput";

export interface OpTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const OpTextarea = React.forwardRef<HTMLTextAreaElement, OpTextareaProps>(
  ({ className, label, error, helperText, id, rows = 3, ...props }, ref) => {
    const inputId = id || (label ? `op-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
    return (
      <div className="w-full space-y-1.5 min-w-0">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={cn(
            "flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-red-500 dark:text-red-400">{error}</p>}
        {helperText && !error && <p className="text-[11px] text-[var(--color-text-muted)]">{helperText}</p>}
      </div>
    );
  }
);
OpTextarea.displayName = "OpTextarea";

export interface OpSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: { label: string; value: string | number }[];
}

export const OpSelect = React.forwardRef<HTMLSelectElement, OpSelectProps>(
  ({ className, label, error, options, children, id, ...props }, ref) => {
    const selectId = id || (label ? `op-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
    return (
      <div className="w-full space-y-1.5 min-w-0">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "flex h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                >
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error && <p className="text-[11px] text-red-500 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);
OpSelect.displayName = "OpSelect";

export function KpiCard({
  label,
  value,
  sublabel,
  trend,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: { value: string; positive?: boolean };
  icon: React.ElementType;
  tone?: "teal" | "blue" | "emerald" | "amber" | "rose" | "violet" | "slate";
}) {
  const toneMap = {
    teal: "bg-teal-500/12 text-teal-600 dark:text-teal-400",
    blue: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
    violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    slate: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  };

  return (
    <SurfaceCard className="p-4 flex flex-col justify-between gap-2.5 hover:border-teal-500/40 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate">{label}</span>
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", toneMap[tone])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
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
      {sublabel && <p className="text-[11px] text-[var(--color-text-muted)] truncate">{sublabel}</p>}
    </SurfaceCard>
  );
}

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "violet";

export function StatusBadge({
  label,
  tone = "neutral",
  dot = false,
  className,
}: {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
}) {
  const tones: Record<StatusTone, string> = {
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    warning: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/25",
    danger: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25",
    info: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25",
    violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25",
    neutral: "bg-[var(--color-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)]",
  };
  const dotTones: Record<StatusTone, string> = {
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

export function getStatusTone(status: string): StatusTone {
  const s = status.toUpperCase();
  if (
    [
      "OPERATIONAL",
      "HEALTHY",
      "SYNCED",
      "DELIVERED",
      "SMTP_ACCEPTED",
      "COMPLETED",
      "RESOLVED",
      "VERIFIED",
      "APPROVED",
      "ACTIVE",
      "ON TRACK",
      "NORMAL",
      "RETRIED — SUCCEEDED",
    ].some((k) => s.includes(k))
  ) {
    return "success";
  }
  if (
    [
      "ELEVATED",
      "WARNING",
      "MONITORING",
      "INVESTIGATING",
      "IDENTIFIED",
      "RETRYING",
      "DELAYED",
      "DEFERRED",
      "QUEUED",
      "SCHEDULED",
      "PENDING",
      "AT RISK",
      "PAST DUE",
      "SUBMITTED FOR APPROVAL",
      "CHANGES REQUESTED",
      "IN PROGRESS",
      "RUNNING",
      "TRIAL",
      "WAITING ON CUSTOMER",
      "ATTENTION NEEDED",
    ].some((k) => s.includes(k))
  ) {
    return "warning";
  }
  if (
    [
      "DEGRADED",
      "OUTAGE",
      "CRITICAL",
      "FAILED",
      "BOUNCED",
      "ESCALATED",
      "SUSPENDED",
      "DENIED",
      "REVOKED",
      "BREACHED",
      "CANCELLED",
      "EXPIRED",
    ].some((k) => s.includes(k))
  ) {
    return "danger";
  }
  if (["INFO", "OPEN", "PAUSED", "DRAFT"].some((k) => s.includes(k))) {
    return "info";
  }
  return "neutral";
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  onResetFilters,
  hasActiveFilters,
  onExportCsv,
  exportDisabled,
  rightActions,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  onExportCsv?: () => void;
  exportDisabled?: boolean;
  rightActions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between min-w-0">
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
        <div className="relative w-full sm:w-64 md:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-8 pr-8 text-xs sm:text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {filters}
        {hasActiveFilters && onResetFilters && (
          <OpButton variant="ghost" size="sm" onClick={onResetFilters}>
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </OpButton>
        )}
      </div>

      {(onExportCsv || rightActions) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onExportCsv && (
            <OpButton variant="outline" size="sm" onClick={onExportCsv} disabled={exportDisabled}>
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </OpButton>
          )}
          {rightActions}
        </div>
      )}
    </div>
  );
}

export function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
      <div className="flex items-center gap-3 flex-wrap">
        <span>
          Showing <strong className="text-[var(--color-text-primary)]">{start}</strong>–
          <strong className="text-[var(--color-text-primary)]">{end}</strong> of{" "}
          <strong className="text-[var(--color-text-primary)]">{totalItems}</strong>
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-7 rounded-md border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <OpButton
          variant="outline"
          size="xs"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </OpButton>
        <span className="px-2 text-xs font-medium text-[var(--color-text-primary)]">
          {currentPage} / {totalPages}
        </span>
        <OpButton
          variant="outline"
          size="xs"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </OpButton>
      </div>
    </div>
  );
}

export function OpModal({
  isOpen,
  onClose,
  title,
  description,
  maxWidth = "lg",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widths = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="fixed inset-0 bg-black/65 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex max-h-[92vh] w-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-modal",
          widths[maxWidth]
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">{title}</h3>
            {description && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function SlideOverDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/65 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>
      </aside>
    </div>
  );
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
}) {
  return (
    <OpModal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="space-y-4">
        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {description}
        </p>
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
          <OpButton variant="outline" size="sm" onClick={onClose}>
            Cancel
          </OpButton>
          <OpButton
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </OpButton>
        </div>
      </div>
    </OpModal>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="h-12 w-12 rounded-xl bg-[var(--color-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h4>
      <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mt-1">{description}</p>
      {actionLabel && onAction && (
        <OpButton size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </OpButton>
      )}
    </div>
  );
}

export function getOrgInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PW";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function SortableHeader({
  label,
  active,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onSort: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onSort}
      className={cn(
        "inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-[10px] hover:text-[var(--color-text-primary)] transition-colors",
        active ? "text-teal-600 dark:text-teal-400" : "text-[var(--color-text-muted)]",
        align === "right" && "ml-auto"
      )}
    >
      <span>{label}</span>
      {active ? (
        direction === "asc" ? (
          <ArrowUp className="w-3 h-3 shrink-0" />
        ) : (
          <ArrowDown className="w-3 h-3 shrink-0" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-50 shrink-0" />
      )}
    </button>
  );
}

export function BulkSelectionBar({
  selectedCount,
  totalFilteredCount,
  onSelectAllMatching,
  onClear,
  actions,
}: {
  selectedCount: number;
  totalFilteredCount?: number;
  onSelectAllMatching?: () => void;
  onClear: () => void;
  actions: React.ReactNode;
}) {
  if (selectedCount <= 0) return null;
  return (
    <div className="border-b border-[var(--color-border)] bg-teal-500/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center rounded-full border border-teal-500/35 bg-teal-500/15 px-2.5 py-0.5 font-semibold text-teal-700 dark:text-teal-300">
          {selectedCount} selected
        </span>
        {typeof totalFilteredCount === "number" &&
          totalFilteredCount > selectedCount &&
          onSelectAllMatching && (
            <button
              type="button"
              onClick={onSelectAllMatching}
              className="text-[11px] font-medium text-teal-700 dark:text-teal-300 hover:underline"
            >
              Select all {totalFilteredCount} matching
            </button>
          )}
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
    </div>
  );
}

export function useTableSelection(allIds: string[], pageIds: string[]) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const allIdsKey = allIds.join(",");

  useEffect(() => {
    const valid = new Set(allIds);
    setSelectedIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allIdsKey]);

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
  const somePageSelected = pageIds.some((id) => selectedSet.has(id)) && !allPageSelected;

  const toggleSelectPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  };
}


