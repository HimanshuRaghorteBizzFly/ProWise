"use client";

import React from "react";

import { ApiError } from "@/lib/api";
import { ErrorBanner, NotFoundState, PageSkeleton, StatusBadge } from "@/components/delivery/DeliveryUI";
import { AccessDeniedState, SessionExpiredState } from "@/components/org-console/AccessStates";
import { apiErrorMessage, type LoadState } from "@/components/org-console/useRoleApi";

/** Loading / denied / gone / signed-out / error states for one developer query, then the content. */
export function DevGate<T>({
  state,
  what,
  back,
  skeleton = "list",
  children,
}: {
  state: LoadState<T>;
  what: string;
  back: { href: string; label: string };
  skeleton?: "dashboard" | "list" | "detail";
  children: (data: T) => React.ReactNode;
}) {
  if (state.kind === "loading") return <PageSkeleton variant={skeleton} />;
  if (state.kind === "forbidden") return <AccessDeniedState backHref={back.href} />;
  if (state.kind === "access-lost") return <NotFoundState what={what} back={back} />;
  if (state.kind === "unauthenticated") return <SessionExpiredState />;
  if (state.kind === "error") return <ErrorBanner message={`${what} could not be loaded.`} onRetry={state.retry} />;
  return <>{children(state.data)}</>;
}

/** A compact inline variant for a section inside a page (no full-page skeleton). */
export function SectionGate<T>({ state, what, children }: { state: LoadState<T>; what: string; children: (data: T) => React.ReactNode }) {
  if (state.kind === "loading") {
    return <div className="h-16 rounded-lg bg-[var(--color-elevated)] animate-pulse" aria-label={`Loading ${what}`} />;
  }
  if (state.kind === "ready") return <>{children(state.data)}</>;
  const retry = state.kind === "error" ? state.retry : undefined;
  const message =
    state.kind === "forbidden" || state.kind === "access-lost"
      ? `You no longer have access to ${what}.`
      : state.kind === "unauthenticated"
        ? "Your session has ended. Sign in again."
        : `${what} could not be loaded.`;
  return <ErrorBanner message={message} onRetry={retry} />;
}

/** The server's message for a failed change (field errors included), for toasts and inline form errors. */
export function changeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "STALE_VERSION") return "Someone else changed this item first. It has been refreshed; review it and try again.";
    const fields = (error.fieldErrors ?? []).map((f) => `${f.field}: ${f.message}`).join("; ");
    return fields ? `${error.message} (${fields})` : error.message;
  }
  return apiErrorMessage(error);
}

const STATE_LABEL: Record<string, { label: string; tone: "neutral" | "info" | "violet" | "success" | "danger" }> = {
  TODO: { label: "To do", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  IN_REVIEW: { label: "In review", tone: "violet" },
  DONE: { label: "Done", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

export function WorkStateBadge({ state, blocked }: { state: string; blocked?: boolean }) {
  const s = STATE_LABEL[state] ?? { label: state, tone: "neutral" as const };
  return (
    <span className="inline-flex items-center gap-1">
      <StatusBadge label={s.label} tone={s.tone} />
      {blocked && <StatusBadge label="Blocked" tone="danger" />}
    </span>
  );
}

export function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "ACCEPTED" || decision === "APPROVED") return <StatusBadge label="Accepted" tone="success" />;
  if (decision === "CHANGES_REQUESTED") return <StatusBadge label="Changes requested" tone="warning" />;
  return <StatusBadge label={decision} tone="neutral" />;
}

export function dateText(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function dateTimeText(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** A date-only deadline is compared as a local calendar day (rule 8), never by adding hours. */
export function isOverdue(dueOn?: string | null, state?: string): boolean {
  if (!dueOn || state === "DONE" || state === "CANCELLED") return false;
  const today = new Date();
  const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dueOn.slice(0, 10) < local;
}
