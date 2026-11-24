"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Inbox } from "lucide-react";
import { ApiError, apiClient } from "@/lib/api";
import {
  EmptyStateView,
  ErrorBanner,
  TableSkeleton,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";

/** State of one server read: never filled with sample values while loading or after a failure. */
export type ResourceState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export function errorMessage(error: unknown, fallback = "The request failed."): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "You do not have permission to view this.";
    if (error.status === 404) return "Not found.";
    if (error.status === 0) return "Cannot reach the ProWise server. Check that the backend is running.";
    return error.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Loads `loader()` on mount and whenever `key` changes; `reload` repeats the last call. Late answers from an older
 * key are dropped so a slow request never overwrites a newer filter.
 */
export function useAdminResource<T>(loader: () => Promise<T>, key: string) {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const callId = useRef(0);

  const run = useCallback(async () => {
    const id = ++callId.current;
    setState({ status: "loading" });
    try {
      const data = await loaderRef.current();
      if (id === callId.current) setState({ status: "ready", data });
    } catch (error) {
      if (id === callId.current) setState({ status: "error", message: errorMessage(error) });
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run, key]);

  return { state, reload: run };
}

/** Loads one record for a detail drawer; `null` state while nothing is open. */
export function useAdminDetail<T>(loader: (id: string) => Promise<T>) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [state, setState] = useState<ResourceState<T> | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const callId = useRef(0);

  const load = useCallback(async (id: string) => {
    const call = ++callId.current;
    setState({ status: "loading" });
    try {
      const data = await loaderRef.current(id);
      if (call === callId.current) setState({ status: "ready", data });
    } catch (error) {
      if (call === callId.current) setState({ status: "error", message: errorMessage(error) });
    }
  }, []);

  const open = useCallback(
    (id: string) => {
      setOpenId(id);
      void load(id);
    },
    [load],
  );
  const close = useCallback(() => {
    callId.current++;
    setOpenId(null);
    setState(null);
  }, []);
  const retry = useCallback(() => {
    if (openId) void load(openId);
  }, [load, openId]);

  return { openId, state, open, close, retry };
}

/**
 * Resolves organization IDs to names from the server's organization list. An ID the list does not contain is shown
 * as the ID itself (never a made-up name).
 */
export function useOrgNames(): (id: string) => string {
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let alive = true;
    apiClient.admin.organizations
      .list()
      .then((orgs) => {
        if (alive) setNames(new Map(orgs.map((o) => [o.id, o.name])));
      })
      .catch(() => {
        /* names stay unresolved; IDs are shown instead */
      });
    return () => {
      alive = false;
    };
  }, []);
  return useCallback((id: string) => names.get(id) ?? id, [names]);
}

/** Delays a fast-changing value (search box) so the server is not asked on every keystroke. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Renders the loading skeleton, the error with a Retry button, or the empty state; returns null when there are
 * rows so the caller renders its table.
 */
export function ResourceStatus<T>({
  state,
  isEmpty,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyIcon = Inbox,
}: {
  state: ResourceState<T>;
  isEmpty: (data: T) => boolean;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: React.ElementType;
}) {
  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading">
        <TableSkeleton rows={4} />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="p-4">
        <ErrorBanner message={state.message} onRetry={onRetry} />
      </div>
    );
  }
  if (isEmpty(state.data)) {
    return <EmptyStateView icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }
  return null;
}

export function formatInstant(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

/** Date-only values (LocalDate) are shown as the calendar date the server sent, without shifting time zones. */
export function formatLocalDate(value: string | null | undefined): string {
  return value ? value : "-";
}

export function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "-";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(Number(amount));
  } catch {
    return `${Number(amount).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

export function humanize(value: string | null | undefined): string {
  if (!value) return "-";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Plain table wrapper shared by the Super Admin list pages. */
export function AdminTable({
  headers,
  children,
  label,
}: {
  headers: string[];
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse" aria-label={label}>
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)] font-semibold text-[11px]">
            {headers.map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">{children}</tbody>
      </table>
    </div>
  );
}

export const cellClass = "px-4 py-2.5 align-top text-[var(--color-text-primary)]";
export const mutedCellClass = "px-4 py-2.5 align-top text-[var(--color-text-secondary)]";

/** Banner for billing pages: the module is kept in the codebase but dormant (no payments are processed). */
export function BillingDormantNotice({ editable = false }: { editable?: boolean } = {}) {
  return (
    <div
      role="note"
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200"
    >
      <p className="font-semibold">Billing is dormant</p>
      <p className="mt-0.5">
        {editable
          ? "Billing is outside the V1 scope: no card, bank or payment gateway is charged. Changes here only edit the records stored on the server."
          : "Billing is outside the V1 scope and no payments are processed. This page shows the records stored on the server, read-only."}
      </p>
    </div>
  );
}
