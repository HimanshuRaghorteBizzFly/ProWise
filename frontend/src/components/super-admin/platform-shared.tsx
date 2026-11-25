"use client";

import React, { useCallback, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { ApiError, isStaleVersion } from "@/lib/api";
import { downloadCsv, generateCsv } from "@/lib/csv";
import { AdminButton } from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { errorMessage } from "./admin-resource";

/** Shown whenever the server refuses a write with 409 STALE_VERSION. The page never overwrites on its own. */
export const STALE_VERSION_MESSAGE = "This record was changed by someone else. Reload to see the latest version.";

export interface MutationFailure {
  message: string;
  stale: boolean;
  /** Server `field_errors`, keyed by the snake_case field name the server reported. */
  fieldErrors: Record<string, string>;
}

/** `targetAudience` / `body.target_audience` -> `target_audience`, so forms can look errors up by wire name. */
export function snakeField(field: string): string {
  const last = field.split(".").pop() ?? field;
  return last.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/** Turns any thrown error from a write into the message, stale flag and per-field errors to show. */
export function describeMutationError(error: unknown, fallback = "The change could not be saved."): MutationFailure {
  if (isStaleVersion(error)) return { message: STALE_VERSION_MESSAGE, stale: true, fieldErrors: {} };
  const fieldErrors: Record<string, string> = {};
  if (error instanceof ApiError) {
    for (const fe of error.fieldErrors ?? []) {
      if (!fe?.field) continue;
      const key = snakeField(fe.field);
      if (!fieldErrors[key]) fieldErrors[key] = fe.message;
    }
  }
  return { message: errorMessage(error, fallback), stale: false, fieldErrors };
}

/**
 * Runs one write at a time and keeps its failure. `run` resolves to true on success; on failure the error is kept
 * for the banner / field messages and false is returned (nothing is retried automatically).
 */
export function useMutation() {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<MutationFailure | null>(null);

  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    setPending(true);
    setFailure(null);
    try {
      await action();
      return true;
    } catch (error) {
      setFailure(describeMutationError(error));
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  const clear = useCallback(() => setFailure(null), []);
  return { run, pending, failure, clear };
}

/** Error banner for a failed write. A stale write offers Reload (which re-reads the server state). */
export function MutationErrorBanner({ failure, onReload }: { failure: MutationFailure | null; onReload?: () => void }) {
  if (!failure) return null;
  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-200"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>{failure.message}</p>
      </div>
      {failure.stale && onReload && (
        <AdminButton type="button" variant="outline" size="xs" onClick={onReload}>
          <RotateCcw className="w-3.5 h-3.5" />
          Reload
        </AdminButton>
      )}
    </div>
  );
}

/** Underline tab bar matching the earlier Super Admin designs. */
export function TabBar<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: K; label: string; icon?: React.ElementType; badge?: string }[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-2 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.key)}
            className={`shrink-0 py-3 px-3.5 border-b-2 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer ${
              selected
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="rounded-full bg-[var(--color-elevated)] px-1.5 text-[10px] text-[var(--color-text-muted)]">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Downloads rows that are already loaded in the page as a CSV (formula-injection safe). */
export function downloadRowsCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): void {
  downloadCsv(filename, generateCsv(headers, rows));
}

/** ISO instant -> value for <input type="datetime-local"> in the browser's zone ("" when unset). */
export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (browser zone) -> ISO instant in UTC, or null when empty / invalid. */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Small "label: value" row used in previews and detail panels. */
export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <strong className="text-right font-semibold text-[var(--color-text-primary)] break-all">{value}</strong>
    </div>
  );
}
