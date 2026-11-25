"use client";

import React, { useCallback, useRef, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { ApiError, isStaleVersion, newClientId } from "@/lib/api";
import { AdminButton, AdminModal } from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { errorMessage } from "../admin-resource";

/** Shown whenever the server refuses a write with 409 STALE_VERSION. The change is never re-sent automatically. */
export const STALE_VERSION_MESSAGE = "This record was changed by someone else. Reload to see the latest version.";

export type FieldErrors = Record<string, string>;

export type MutationFailure =
  | { kind: "stale"; message: string }
  | { kind: "error"; message: string; fieldErrors: FieldErrors };

/** Turns a failed write into what the form shows: the stale-version notice, or the server message + field errors. */
export function describeMutationError(error: unknown, fallback = "The change could not be saved."): MutationFailure {
  if (isStaleVersion(error)) return { kind: "stale", message: STALE_VERSION_MESSAGE };
  const fieldErrors: FieldErrors = {};
  if (error instanceof ApiError) {
    for (const fe of error.fieldErrors ?? []) {
      if (fe?.field && !fieldErrors[fe.field]) fieldErrors[fe.field] = fe.message;
    }
  }
  return { kind: "error", message: errorMessage(error, fallback), fieldErrors };
}

/** Server field error for `field` (snake_case, as the API reports it), or the client-side one. */
export function fieldError(failure: MutationFailure | null, client: FieldErrors, field: string): string | undefined {
  if (client[field]) return client[field];
  if (failure?.kind === "error") return failure.fieldErrors[field];
  return undefined;
}

export function MutationErrorNotice({
  failure,
  onReload,
}: {
  failure: MutationFailure | null;
  onReload?: () => void;
}) {
  if (!failure) return null;
  if (failure.kind === "stale") {
    return (
      <div
        role="alert"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-medium">{failure.message}</p>
        </div>
        {onReload && (
          <AdminButton type="button" variant="outline" size="xs" onClick={onReload}>
            <RotateCcw className="w-3.5 h-3.5" />
            Reload
          </AdminButton>
        )}
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-200"
    >
      <p className="font-semibold">The change was not saved</p>
      <p className="mt-0.5">{failure.message}</p>
    </div>
  );
}

/**
 * State of one logical write. The Idempotency-Key is created by `begin()` (when a form or confirmation opens) and
 * reused by every retry of that same change, so pressing Save twice cannot apply it twice.
 */
export function useMutation() {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<MutationFailure | null>(null);
  const keyRef = useRef<string>(newClientId());

  const begin = useCallback(() => {
    keyRef.current = newClientId();
    setFailure(null);
    setBusy(false);
  }, []);

  const run = useCallback(async <T,>(fn: (idempotencyKey: string) => Promise<T>, fallback?: string): Promise<{ ok: true; value: T } | { ok: false }> => {
    setBusy(true);
    setFailure(null);
    try {
      const value = await fn(keyRef.current);
      keyRef.current = newClientId();
      return { ok: true, value };
    } catch (error) {
      setFailure(describeMutationError(error, fallback));
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, failure, begin, run, clear: () => setFailure(null) };
}

export type Mutation = ReturnType<typeof useMutation>;

/** Modal with a form: error / stale notice on top, Cancel + submit at the bottom. */
export function CommercialFormModal({
  isOpen,
  title,
  description,
  maxWidth = "lg",
  busy,
  failure,
  onReload,
  onClose,
  onSubmit,
  submitLabel,
  submitVariant = "primary",
  children,
}: {
  isOpen: boolean;
  title: string;
  description?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";
  busy: boolean;
  failure: MutationFailure | null;
  onReload?: () => void;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitVariant?: "primary" | "danger";
  children?: React.ReactNode;
}) {
  return (
    <AdminModal isOpen={isOpen} onClose={() => !busy && onClose()} title={title} description={description} maxWidth={maxWidth}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onSubmit();
        }}
      >
        <MutationErrorNotice failure={failure} onReload={onReload} />
        {children}
        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
          <AdminButton type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </AdminButton>
          <AdminButton
            type="submit"
            variant={submitVariant}
            size="sm"
            isLoading={busy}
            disabled={busy || failure?.kind === "stale"}
          >
            {submitLabel}
          </AdminButton>
        </div>
      </form>
    </AdminModal>
  );
}

/* ---------------------------------------------------------------- small form helpers */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `null` for an empty box, the number otherwise (NaN when the text is not a number). */
export function parseOptionalNumber(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  return Number(t);
}

/** Trimmed text, or null when empty (so an optional field is sent as "not set"). */
export function optionalText(text: string): string | null {
  const t = text.trim();
  return t === "" ? null : t;
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-[var(--color-text-primary)] cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[var(--color-border)] accent-blue-600"
      />
      {label}
    </label>
  );
}
