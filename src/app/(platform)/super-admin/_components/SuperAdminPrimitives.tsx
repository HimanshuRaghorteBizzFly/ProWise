"use client";

import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FlaskConical,
  Lock,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

/* ============================================================================
 * 1. PAGE HEADER & SIMULATION NOTICE
 * ============================================================================ */

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  simulationLabel?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  badge,
  simulationLabel,
  actions,
}: PageHeaderProps) {
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
          {simulationLabel && (
            <span
              title="Frontend mock service active — connect Spring Boot / Stripe / SMTP backend endpoints for live execution."
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
            >
              <FlaskConical className="w-3 h-3 shrink-0" />
              <span>{simulationLabel}</span>
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
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

export function SimulationNotice({
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
        "flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200",
        className
      )}
    >
      <FlaskConical className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0">
        <span className="font-semibold">{title}: </span>
        <span className="text-amber-700 dark:text-amber-200/90">{description}</span>
      </div>
    </div>
  );
}

/* ============================================================================
 * 2. SURFACES, BUTTONS & INPUTS (100% DARK-MODE SAFE)
 * ============================================================================ */

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

export interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "subtle";
  size?: "xs" | "sm" | "md";
  isLoading?: boolean;
  permissionLocked?: boolean;
  lockedReason?: string;
}

export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "sm",
      isLoading,
      permissionLocked,
      lockedReason,
      disabled,
      children,
      title,
      ...props
    },
    ref
  ) => {
    const isDisabled = Boolean(disabled || isLoading || permissionLocked);

    const variantStyles = {
      primary:
        "bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#124993] text-white dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] dark:text-white shadow-xs",
      secondary:
        "bg-[var(--color-elevated)] hover:bg-[var(--color-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)]",
      outline:
        "bg-transparent hover:bg-[var(--color-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)]",
      ghost:
        "bg-transparent hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
      danger:
        "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-xs",
      subtle:
        "bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/20",
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
        title={permissionLocked ? lockedReason || "Missing required role permission" : title}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {permissionLocked && <Lock className="w-3 h-3 shrink-0" />}
        {isLoading && (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);
AdminButton.displayName = "AdminButton";

export interface AdminInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const AdminInput = React.forwardRef<HTMLInputElement, AdminInputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? `sa-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
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
            "flex h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]",
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
AdminInput.displayName = "AdminInput";

export interface AdminTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const AdminTextarea = React.forwardRef<HTMLTextAreaElement, AdminTextareaProps>(
  ({ className, label, error, helperText, id, rows = 3, ...props }, ref) => {
    const inputId = id || (label ? `sa-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
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
            "flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]",
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
AdminTextarea.displayName = "AdminTextarea";

export interface AdminSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: { label: string; value: string | number }[];
}

export const AdminSelect = React.forwardRef<HTMLSelectElement, AdminSelectProps>(
  ({ className, label, error, options, children, id, ...props }, ref) => {
    const selectId = id || (label ? `sa-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
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
            "flex h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
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
AdminSelect.displayName = "AdminSelect";

/* ============================================================================
 * 3. KPI CARD & STATUS BADGE
 * ============================================================================ */

export interface KpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: { value: string; positive?: boolean };
  icon: React.ElementType;
  tone?: "blue" | "emerald" | "violet" | "amber" | "rose" | "slate";
}

export function KpiCard({ label, value, sublabel, trend, icon: Icon, tone = "blue" }: KpiCardProps) {
  const toneMap = {
    blue: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
    slate: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  };

  return (
    <SurfaceCard className="p-4 flex flex-col justify-between gap-2.5 hover:border-blue-500/40 transition-colors">
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
      "bg-[var(--color-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)]",
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
  if (["ACTIVE", "PAID", "SUCCEEDED", "PUBLISHED", "CONNECTED", "DELIVERED_SIMULATED", "APPROVED", "ENFORCED", "OPERATIONAL", "HEALTHY", "RESOLVED"].includes(s)) {
    return "success";
  }
  if (["TRIAL", "TRIALING", "OPEN", "SCHEDULED", "PENDING", "INVITED", "PARTIALLY_REFUNDED", "UNTESTED", "MONITORING", "DRAFT"].includes(s)) {
    return "warning";
  }
  if (["SUSPENDED", "FAILED", "OVERDUE", "CANCELLED", "REFUNDED", "FAILED_SIMULATED", "CRITICAL", "DENIED", "INACTIVE"].includes(s)) {
    return "danger";
  }
  if (["RELEASE", "INFO", "SYSTEM"].includes(s)) {
    return "info";
  }
  return "neutral";
}

/* ============================================================================
 * 4. TOOLBAR & PAGINATION
 * ============================================================================ */

export interface FilterBarProps {
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
}: FilterBarProps) {
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
            className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-8 pr-8 text-xs sm:text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <AdminButton variant="ghost" size="sm" onClick={onResetFilters}>
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </AdminButton>
        )}
      </div>

      {(onExportCsv || rightActions) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onExportCsv && (
            <AdminButton variant="outline" size="sm" onClick={onExportCsv} disabled={exportDisabled}>
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </AdminButton>
          )}
          {rightActions}
        </div>
      )}
    </div>
  );
}

export interface PaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
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
        <AdminButton
          variant="outline"
          size="xs"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </AdminButton>
        <span className="px-2 text-xs font-medium text-[var(--color-text-primary)]">
          {currentPage} / {totalPages}
        </span>
        <AdminButton
          variant="outline"
          size="xs"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </AdminButton>
      </div>
    </div>
  );
}

/* ============================================================================
 * 5. MODAL, SLIDE-OVER DRAWER & CONFIRMATION
 * ============================================================================ */

export interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "5xl";
  children: React.ReactNode;
}

export function AdminModal({
  isOpen,
  onClose,
  title,
  description,
  maxWidth = "lg",
  children,
}: AdminModalProps) {
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
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
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
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
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
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>
      </aside>
    </div>
  );
}

export function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  requireMatchText,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  requireMatchText?: string;
}) {
  const [typed, setTyped] = React.useState("");

  useEffect(() => {
    if (isOpen) setTyped("");
  }, [isOpen]);

  const canConfirm = !requireMatchText || typed.trim() === requireMatchText;

  return (
    <AdminModal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="space-y-4">
        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {description}
        </p>
        {requireMatchText && (
          <AdminInput
            label={`Type "${requireMatchText}" to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={requireMatchText}
          />
        )}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
          <AdminButton variant="outline" size="sm" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            disabled={!canConfirm}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </AdminButton>
        </div>
      </div>
    </AdminModal>
  );
}

/* ============================================================================
 * 6. LOADING / EMPTY / ERROR STATES
 * ============================================================================ */

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="h-11 w-full rounded-lg bg-[var(--color-elevated)] animate-pulse"
        />
      ))}
    </div>
  );
}

export function EmptyStateView({
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
        <AdminButton size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </AdminButton>
      )}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-200">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
        <div>
          <p className="font-semibold">Failed to load data</p>
          <p className="mt-0.5 text-rose-600 dark:text-rose-300">{message}</p>
        </div>
      </div>
      {onRetry && (
        <AdminButton variant="outline" size="xs" onClick={onRetry}>
          <RotateCcw className="w-3.5 h-3.5" />
          Retry
        </AdminButton>
      )}
    </div>
  );
}

/* ============================================================================
 * 7. SHARED COLORFUL TABLE HELPERS & BULK SELECTION BAR
 * ============================================================================ */

const SHARED_PLAN_THEMES = {
  amber: {
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    avatar: "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  violet: {
    badge: "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    avatar: "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  emerald: {
    badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    avatar: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  sky: {
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    avatar: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  rose: {
    badge: "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    avatar: "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  blue: {
    badge: "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
    avatar: "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
};

export function getPlanBadgeTheme(
  plan?: { code?: string; name?: string; brandColor?: string } | null
) {
  const brand = plan?.brandColor as keyof typeof SHARED_PLAN_THEMES | undefined;
  if (brand && SHARED_PLAN_THEMES[brand]) return SHARED_PLAN_THEMES[brand];

  const key = `${plan?.code || ""} ${plan?.name || ""}`.toLowerCase();
  if (key.includes("enterprise")) return SHARED_PLAN_THEMES.amber;
  if (key.includes("pro")) return SHARED_PLAN_THEMES.violet;
  if (key.includes("growth")) return SHARED_PLAN_THEMES.emerald;
  if (key.includes("starter") || key.includes("free")) return SHARED_PLAN_THEMES.sky;
  return SHARED_PLAN_THEMES.blue;
}

export function getOrgInitials(label: string): string {
  return (
    label
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "PW"
  );
}

export function getCycleBadgeClass(cycle: "MONTHLY" | "ANNUAL"): string {
  return cycle === "ANNUAL"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
}

export function getPaymentMethodBadgeClass(method: "CARD" | "ACH" | "WIRE"): string {
  if (method === "ACH") {
    return "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300";
  }
  if (method === "WIRE") {
    return "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300";
  }
  return "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300";
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
    <div className="border-b border-[var(--color-border)] bg-blue-500/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-0.5 font-semibold text-blue-700 dark:text-blue-300">
          {selectedCount} selected
        </span>
        {typeof totalFilteredCount === "number" &&
          totalFilteredCount > selectedCount &&
          onSelectAllMatching && (
            <button
              type="button"
              onClick={onSelectAllMatching}
              className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
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



