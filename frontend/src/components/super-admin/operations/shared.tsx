"use client";

import React, { useCallback, useState } from "react";
import { AlertCircle, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { isStaleVersion } from "@/lib/api";
import { operationsApi } from "@/lib/admin-api/operations";
import type { OpsOperator } from "@/types/admin-operations";
import { AdminButton, KpiCard, type KpiCardProps } from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { errorMessage, useAdminResource, type ResourceState } from "../admin-resource";

export const STALE_VERSION_MESSAGE = "This record was changed by someone else. Reload to see the latest version.";

/** Platform operator departments (the backend's OperatorDepartment ids). */
export const OPERATOR_DEPARTMENTS: { value: string; label: string }[] = [
  { value: "platform-operations", label: "Platform Operations" },
  { value: "site-reliability", label: "Site Reliability" },
  { value: "lifecycle-messaging", label: "Lifecycle Messaging" },
  { value: "customer-communications", label: "Customer Communications" },
  { value: "finance-tax", label: "Finance & Tax" },
  { value: "revenue-operations", label: "Revenue Operations" },
  { value: "trust-compliance", label: "Trust & Compliance" },
];

export function departmentLabel(value: string | null | undefined): string {
  if (!value) return "-";
  return OPERATOR_DEPARTMENTS.find((d) => d.value === value)?.label ?? value;
}

/** A failed write as shown to the person: a stale version is told apart so the page offers Reload, never a re-send. */
export interface MutationNoticeState {
  stale: boolean;
  message: string;
}

export function toMutationNotice(error: unknown): MutationNoticeState {
  if (isStaleVersion(error)) return { stale: true, message: STALE_VERSION_MESSAGE };
  return { stale: false, message: errorMessage(error, "The change was not saved.") };
}

export function MutationNotice({
  notice,
  onReload,
  onDismiss,
}: {
  notice: MutationNoticeState | null;
  onReload: () => void;
  onDismiss: () => void;
}) {
  if (!notice) return null;
  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-200"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
        <p className="min-w-0">{notice.message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {notice.stale && (
          <AdminButton variant="outline" size="xs" onClick={onReload}>
            <RotateCcw className="w-3.5 h-3.5" />
            Reload
          </AdminButton>
        )}
        <AdminButton variant="ghost" size="xs" onClick={onDismiss} aria-label="Dismiss message">
          <X className="w-3.5 h-3.5" />
        </AdminButton>
      </div>
    </div>
  );
}

/**
 * Runs one server write at a time. Success shows a toast and calls `onDone` (normally the list reload); failure keeps
 * the message on screen. Nothing is applied locally before the server answers.
 */
export function useOpsMutation(onDone: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<MutationNoticeState | null>(null);

  const run = useCallback(
    async (key: string, action: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
      setBusy(key);
      setNotice(null);
      try {
        await action();
        toast.success(successMessage);
        onDone();
        return true;
      } catch (error) {
        setNotice(toMutationNotice(error));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [onDone],
  );

  return { busy, notice, clearNotice: () => setNotice(null), run };
}

/** Platform operators for assignee pickers (real list from /v1/operators). */
export function useOperators(): ResourceState<OpsOperator[]> {
  return useAdminResource(() => operationsApi.operators(), "operators").state;
}

export function operatorOptions(operators: ResourceState<OpsOperator[]>): { label: string; value: string }[] {
  if (operators.status !== "ready") return [];
  return operators.data
    .filter((o) => (o.status ?? "").toUpperCase() === "ACTIVE")
    .map((o) => ({ label: o.department ? `${o.name} (${departmentLabel(o.department)})` : o.name, value: o.id }));
}

/** KPI tile whose value is a real count from loaded data, or "-" while that data is not available. */
export function CountKpi<T>({
  state,
  count,
  ...rest
}: Omit<KpiCardProps, "value"> & { state: ResourceState<T>; count: (data: T) => number }) {
  return <KpiCard {...rest} value={state.status === "ready" ? count(state.data) : "-"} />;
}

export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

export function paginate<T>(rows: T[], page: number, pageSize: number): { rows: T[]; page: number } {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safe = Math.min(Math.max(1, page), totalPages);
  return { rows: rows.slice((safe - 1) * pageSize, safe * pageSize), page: safe };
}

/** Convert a `datetime-local` value (the viewer's local time) into a UTC instant for the API. */
export function localInputToInstant(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Convert a UTC instant into a `datetime-local` value in the viewer's local time. */
export function instantToLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const INCIDENT_SEVERITY_OPTIONS = [
  { label: "SEV 1 (critical)", value: "SEV_1" },
  { label: "SEV 2 (major)", value: "SEV_2" },
  { label: "SEV 3 (minor)", value: "SEV_3" },
  { label: "SEV 4 (low)", value: "SEV_4" },
];

export function severityTone(severity: string): "danger" | "warning" | "info" | "neutral" {
  const s = severity.toUpperCase();
  if (s === "SEV_1" || s === "CRITICAL" || s === "URGENT") return "danger";
  if (s === "SEV_2" || s === "HIGH" || s === "WARNING") return "warning";
  if (s === "SEV_3" || s === "MEDIUM" || s === "INFO") return "info";
  return "neutral";
}
