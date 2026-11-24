"use client";

/**
 * Building blocks shared by the operator pages that read the real backend (through `_services/operator-api.ts`):
 * resource loading state, loading/error/empty rendering, the "Not available yet" control for actions that have no
 * real endpoint, and the write runner that shows a stale-version notice with Reload (never an automatic re-send).
 */
import React, { useCallback, useState } from "react";
import { Inbox, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ApiError, isStaleVersion } from "@/lib/api";
import { useAdminResource, useAdminDetail, errorMessage, type ResourceState } from "@/components/super-admin/admin-resource";
import {
  MutationNotice,
  STALE_VERSION_MESSAGE,
  toMutationNotice,
  type MutationNoticeState,
} from "@/components/super-admin/operations/shared";
import { OpButton, EmptyState, type OpButtonProps } from "./OperatorPrimitives";
import { operatorApi } from "../_services/operator-api";

export { MutationNotice, STALE_VERSION_MESSAGE, toMutationNotice, errorMessage };
export type { MutationNoticeState, ResourceState };

/** What an operator sees when the server refuses with 403 (reads and writes alike). */
export const PERMISSION_DENIED_MESSAGE = "You do not have permission for this.";

/** A 403 becomes the operator permission message; anything else is passed through unchanged. */
function mapPermissionDenied(error: unknown): never {
  if (error instanceof ApiError && error.status === 403) throw new Error(PERMISSION_DENIED_MESSAGE);
  throw error;
}

/** Message for a failed operator call: 403 = permission message, otherwise the standard client message. */
export function operatorErrorMessage(error: unknown, fallback = "The request failed."): string {
  if (error instanceof ApiError && error.status === 403) return PERMISSION_DENIED_MESSAGE;
  return errorMessage(error, fallback);
}

/**
 * Loads `loader()` on mount and when `key` changes; `reload()` repeats it. Never filled with sample values. A 403
 * shows "You do not have permission for this."
 */
export function useOperatorResource<T>(loader: () => Promise<T>, key: string) {
  return useAdminResource<T>(() => loader().catch(mapPermissionDenied), key);
}
/** Loads one record for a drawer on demand (403 = permission message). */
export function useOperatorDetail<T>(loader: (id: string) => Promise<T>) {
  return useAdminDetail<T>((id) => loader(id).catch(mapPermissionDenied));
}

/** Field-level refusals from the server's `field_errors`, keyed by field name. */
export type OperatorFieldErrors = Record<string, string>;

/**
 * A failed write as the operator sees it: stale version = Reload notice (never re-sent), 403 = permission message,
 * known error codes can be given friendlier text through `codeMessages`.
 */
export function toOperatorNotice(error: unknown, codeMessages: Record<string, string> = {}): MutationNoticeState {
  if (isStaleVersion(error)) return { stale: true, message: STALE_VERSION_MESSAGE };
  if (error instanceof ApiError) {
    if (codeMessages[error.code]) return { stale: false, message: codeMessages[error.code] };
    if (error.status === 403) return { stale: false, message: PERMISSION_DENIED_MESSAGE };
  }
  return toMutationNotice(error);
}

/** `field_errors` of a refused write as `{ field: message }` (first message per field). */
export function fieldErrorsOf(error: unknown): OperatorFieldErrors {
  const out: OperatorFieldErrors = {};
  if (error instanceof ApiError) {
    for (const fe of error.fieldErrors ?? []) {
      if (fe?.field && !out[fe.field]) out[fe.field] = fe.message;
    }
  }
  return out;
}

/**
 * Runs one server write at a time: success toasts and calls `onDone` (the reload), failure keeps a notice on screen
 * (stale version = "Reload" button; 403 = permission message) and exposes the server's `field_errors` so forms can
 * show them next to the field. Nothing is applied locally before the server answers and nothing is re-sent.
 */
export function useOperatorMutation(onDone: () => void, codeMessages?: Record<string, string>) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<MutationNoticeState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<OperatorFieldErrors>({});

  const run = useCallback(
    async (key: string, action: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
      setBusy(key);
      setNotice(null);
      setFieldErrors({});
      try {
        await action();
        toast.success(successMessage);
        onDone();
        return true;
      } catch (error) {
        setNotice(toOperatorNotice(error, codeMessages));
        setFieldErrors(fieldErrorsOf(error));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [onDone, codeMessages],
  );

  const clearNotice = useCallback(() => {
    setNotice(null);
    setFieldErrors({});
  }, []);

  return { busy, notice, fieldErrors, clearNotice, run };
}

/** The server's message for one form field, rendered under it (nothing when the field was accepted). */
export function FieldErrorText({ errors, field }: { errors: OperatorFieldErrors; field: string }) {
  const message = errors[field];
  if (!message) return null;
  return (
    <p role="alert" data-field-error={field} className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
      {message}
    </p>
  );
}

/* ---------------------------------------------------------------- server paging & formatting */

/** Items of a paged console response, or none while it is not ready. */
export function pageItemsOf<T>(state: ResourceState<{ items: T[] }>): T[] {
  return state.status === "ready" ? state.data.items ?? [] : [];
}

/** Total matching rows reported by the server (0 while not ready). */
export function pageTotalOf(state: ResourceState<{ total: number }>): number {
  return state.status === "ready" ? state.data.total ?? 0 : 0;
}

/** The UI's 1-based page and page size as the server's 0-based paging params (size clamped to 1..100). */
export function toServerPaging(page: number, pageSize: number): { page: number; size: number } {
  return { page: Math.max(0, page - 1), size: Math.min(100, Math.max(1, pageSize)) };
}

/** Bytes as "12.4 MB" (or "-" when the server has no size). */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

/** Money from the server (amount may arrive as a number or a decimal string). */
export function formatMoney(amount: number | string | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined || amount === "") return "-";
  const n = typeof amount === "number" ? amount : Number(amount);
  if (Number.isNaN(n)) return String(amount);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency ?? ""}`.trim();
  }
}

export const NOT_AVAILABLE = "Not available yet";

/**
 * A control kept on screen for an action the backend cannot perform yet. Always disabled; the wrapper carries the
 * tooltip (a disabled button gets no pointer events) and, unless `hideLabel`, a small muted label.
 */
export function NotAvailableButton({
  children,
  hideLabel = false,
  reason,
  className,
  wrapperClassName,
  ...props
}: Omit<OpButtonProps, "disabled" | "onClick"> & { hideLabel?: boolean; reason?: string; wrapperClassName?: string }) {
  const tip = reason ? `${NOT_AVAILABLE}: ${reason}` : NOT_AVAILABLE;
  return (
    <span
      title={tip}
      data-not-available="true"
      className={cn("inline-flex flex-col items-start gap-0.5 cursor-not-allowed", wrapperClassName)}
    >
      <OpButton {...props} type="button" disabled aria-disabled="true" title={tip} className={className}>
        {children}
      </OpButton>
      {!hideLabel && <span className="text-[10px] leading-none text-[var(--color-text-muted)]">{NOT_AVAILABLE}</span>}
    </span>
  );
}

/** Inline muted marker for a figure or field the server does not provide. */
export function NotAvailableText({ className, reason }: { className?: string; reason?: string }) {
  return (
    <span
      title={reason ? `${NOT_AVAILABLE}: ${reason}` : NOT_AVAILABLE}
      className={cn("text-[var(--color-text-muted)] italic text-xs font-normal", className)}
    >
      {NOT_AVAILABLE}
    </span>
  );
}

/** KPI value from a loaded resource: the real figure when ready, "-" while loading or after a failure. */
export function readyValue<T>(state: ResourceState<T>, pick: (data: T) => number | string): number | string {
  return state.status === "ready" ? pick(state.data) : "-";
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="p-4 space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 rounded-lg bg-[var(--color-elevated)] animate-pulse" />
      ))}
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="m-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-200"
    >
      <p className="min-w-0">{message}</p>
      <OpButton variant="outline" size="xs" onClick={onRetry}>
        <RotateCcw className="w-3.5 h-3.5" />
        Retry
      </OpButton>
    </div>
  );
}

/**
 * Loading skeleton, error with Retry, or the empty state for a list resource; returns null when there is data so the
 * caller renders its table / cards.
 */
export function OperatorResourceStatus<T>({
  state,
  isEmpty,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyIcon = Inbox,
  rows,
}: {
  state: ResourceState<T>;
  isEmpty: (data: T) => boolean;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: React.ElementType;
  rows?: number;
}) {
  if (state.status === "loading") return <LoadingRows rows={rows} />;
  if (state.status === "error") return <LoadError message={state.message} onRetry={onRetry} />;
  if (isEmpty(state.data)) return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  return null;
}

/** Rows of a list resource, or an empty list while it is not ready (never sample rows). */
export function rowsOf<T>(state: ResourceState<T[]>): T[] {
  return state.status === "ready" ? state.data : [];
}

/** Real platform operators (GET /v1/operators) for assignee pickers. */
export function useOperatorDirectory() {
  return useOperatorResource(() => operatorApi.operators(), "operator-directory");
}

/** Active operators as select options (value = operator id). */
export function operatorChoices(state: ResourceState<{ id: string; name: string; status: string }[]>) {
  return rowsOf(state)
    .filter((o) => (o.status ?? "").toUpperCase() === "ACTIVE")
    .map((o) => ({ value: o.id, label: o.name }));
}

/** "SEV_1" -> "Sev 1", "WAITING_CUSTOMER" -> "Waiting Customer". */
export function humanizeCode(value: string | null | undefined): string {
  if (!value) return "-";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
