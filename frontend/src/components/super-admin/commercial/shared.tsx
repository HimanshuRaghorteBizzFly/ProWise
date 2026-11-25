"use client";

import React from "react";
import type { CommercialOrganization, CommercialPlan } from "@/types/admin-commercial";
import { getOrgInitials } from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import type { ResourceState } from "../admin-resource";
import { planTheme } from "./PlansView";

/** Lookup tables from the server lists; an ID the list does not contain is shown as the ID (never a made-up name). */
export interface Lookups {
  orgName: (id: string | null | undefined) => string;
  plan: (id: string | null | undefined) => CommercialPlan | undefined;
  orgs: CommercialOrganization[];
  plans: CommercialPlan[];
}

export function buildLookups(
  orgs: ResourceState<CommercialOrganization[]>,
  plans: ResourceState<CommercialPlan[]>,
): Lookups {
  const orgList = orgs.status === "ready" ? orgs.data : [];
  const planList = plans.status === "ready" ? plans.data : [];
  const orgMap = new Map(orgList.map((o) => [o.id, o.name]));
  const planMap = new Map(planList.map((p) => [p.id, p]));
  return {
    orgName: (id) => (id ? orgMap.get(id) ?? id : "-"),
    plan: (id) => (id ? planMap.get(id) : undefined),
    orgs: orgList,
    plans: planList,
  };
}

export function OrgCell({ name, sub }: { name: string; sub?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="h-8 w-8 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[11px] shrink-0">
        {getOrgInitials(name)}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-[var(--color-text-primary)] truncate">{name}</div>
        {sub && <div className="text-[11px] text-[var(--color-text-muted)] truncate">{sub}</div>}
      </div>
    </div>
  );
}

/** Plan badge in the plan's stored brand colour; the raw ID when the plan is not in the list. */
export function PlanBadge({ planId, plan }: { planId: string | null | undefined; plan: CommercialPlan | undefined }) {
  if (!planId) return <span className="text-[var(--color-text-muted)]">-</span>;
  const theme = plan ? planTheme(plan) : planTheme({ brand_color: null });
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${theme.badge}`}>
      {plan ? plan.name : planId}
    </span>
  );
}

export const thClass = "px-4 py-3 whitespace-nowrap";
export const theadClass =
  "border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]";
export const tdClass = "px-4 py-3 align-top";

export const selectClass =
  "h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]";

/** "2026-11-24T00:00:00Z" from a date input value, null when empty. */
export function dateInputToInstant(value: string): string | null {
  return value ? `${value}T00:00:00Z` : null;
}

/** Date input value (UTC calendar date) from an instant. */
export function instantToDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
