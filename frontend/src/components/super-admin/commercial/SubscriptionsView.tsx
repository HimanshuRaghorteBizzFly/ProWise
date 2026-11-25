"use client";

import React, { useEffect, useState } from "react";
import { Ban, CheckCircle2, CreditCard, Edit3, Plus, RefreshCw, RotateCcw, Trash2, XCircle } from "lucide-react";
import type {
  AssignSubscriptionBody,
  CommercialSubscription,
  UpdateSubscriptionBody,
} from "@/types/admin-commercial";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getCycleBadgeClass,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { BillingDormantNotice, ResourceStatus, formatInstant, formatMoney, humanize, type ResourceState } from "../admin-resource";
import {
  Checkbox,
  CommercialFormModal,
  fieldError,
  optionalText,
  parseOptionalNumber,
  type FieldErrors,
  type MutationFailure,
} from "./mutation";
import { usePagedRows } from "../use-paged-rows";
import {
  OrgCell,
  PlanBadge,
  dateInputToInstant,
  instantToDateInput,
  selectClass,
  tdClass,
  thClass,
  theadClass,
  type Lookups,
} from "./shared";

export const SUBSCRIPTION_STATUS_OPTIONS = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELLED"];
export const BILLING_CYCLES = ["MONTHLY", "ANNUAL"];

export type SubscriptionAction = "edit" | "renew" | "cancel" | "reactivate" | "delete";

/** Actions the backend offers for a subscription in this state. */
export function subscriptionActions(s: CommercialSubscription): SubscriptionAction[] {
  const actions: SubscriptionAction[] = ["edit"];
  if (s.status !== "CANCELLED") actions.push("renew");
  if (s.status !== "CANCELLED" && !s.cancel_at_period_end) actions.push("cancel");
  if (s.status === "CANCELLED" || s.cancel_at_period_end) actions.push("reactivate");
  actions.push("delete");
  return actions;
}

export interface SubscriptionsViewProps {
  state: ResourceState<CommercialSubscription[]>;
  lookups: Lookups;
  search: string;
  status: string;
  planId: string;
  cycle: string;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onPlanChange: (v: string) => void;
  onCycleChange: (v: string) => void;
  onRetry: () => void;
  onAssign: () => void;
  onAction: (s: CommercialSubscription, action: SubscriptionAction) => void;
}

export function SubscriptionsView(props: SubscriptionsViewProps) {
  const { state, lookups, search, status, planId, cycle, onSearchChange, onStatusChange, onPlanChange, onCycleChange, onRetry, onAssign, onAction } =
    props;
  const all = state.status === "ready" ? state.data : [];
  const q = search.trim().toLowerCase();
  const rows = all.filter(
    (s) =>
      (cycle === "ALL" || s.billing_cycle === cycle) &&
      (!q || lookups.orgName(s.org_id).toLowerCase().includes(q) || s.id.toLowerCase().includes(q)),
  );
  const ready = state.status === "ready";
  const count = (pred: (s: CommercialSubscription) => boolean) => (ready ? all.filter(pred).length : "-");
  const filtered = Boolean(q) || status !== "ALL" || planId !== "ALL" || cycle !== "ALL";
  const { pageRows, barProps } = usePagedRows(rows);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Subscriptions"
        description="Plan assignments of each organization: cycle, seats, contract amount and renewal."
        badge={ready ? `${rows.length} shown` : undefined}
        actions={
          <>
            <AdminButton variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={onAssign}>
              <Plus className="w-3.5 h-3.5" /> Assign Subscription
            </AdminButton>
          </>
        }
      />
      <BillingDormantNotice editable />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Active" value={count((s) => s.status === "ACTIVE")} sublabel="In the loaded list" icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Cancelling" value={count((s) => s.cancel_at_period_end && s.status !== "CANCELLED")} sublabel="End at period end" icon={XCircle} tone="amber" />
        <KpiCard label="Past due" value={count((s) => s.status === "PAST_DUE")} icon={Ban} tone="rose" />
        <KpiCard label="Total" value={ready ? all.length : "-"} sublabel="Matching the server filters" icon={CreditCard} tone="violet" />
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder="Search organization or subscription ID"
            hasActiveFilters={filtered}
            onResetFilters={() => {
              onSearchChange("");
              onStatusChange("ALL");
              onPlanChange("ALL");
              onCycleChange("ALL");
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Filter subscription status" className={selectClass} value={status} onChange={(e) => onStatusChange(e.target.value)}>
                  <option value="ALL">All statuses</option>
                  {SUBSCRIPTION_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </select>
                <select aria-label="Filter plan" className={selectClass} value={planId} onChange={(e) => onPlanChange(e.target.value)}>
                  <option value="ALL">All plans</option>
                  {lookups.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select aria-label="Filter billing cycle" className={selectClass} value={cycle} onChange={(e) => onCycleChange(e.target.value)}>
                  <option value="ALL">All cycles</option>
                  {BILLING_CYCLES.map((c) => (
                    <option key={c} value={c}>
                      {humanize(c)}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
        </div>

        <ResourceStatus
          state={state.status === "ready" ? { status: "ready", data: rows } : state}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={CreditCard}
          emptyTitle={filtered ? "No subscriptions match" : "No subscriptions stored"}
          emptyDescription={filtered ? "Change the search or filters." : "Assign a plan to an organization to create one."}
        />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Subscriptions">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Organization</th>
                  <th className={thClass}>Plan &amp; cycle</th>
                  <th className={thClass}>Seats</th>
                  <th className={thClass}>Amount</th>
                  <th className={thClass}>Current period</th>
                  <th className={thClass}>Renewal</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {pageRows.map((s) => {
                  const actions = subscriptionActions(s);
                  return (
                    <tr key={s.id} className="hover:bg-[var(--color-hover)]">
                      <td className={tdClass}>
                        <OrgCell name={lookups.orgName(s.org_id)} sub={<span className="font-mono">{s.id}</span>} />
                      </td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <PlanBadge planId={s.plan_id} plan={lookups.plan(s.plan_id)} />
                          {(s.billing_cycle === "MONTHLY" || s.billing_cycle === "ANNUAL") ? (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getCycleBadgeClass(s.billing_cycle)}`}>
                              {humanize(s.billing_cycle)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--color-text-muted)]">{humanize(s.billing_cycle)}</span>
                          )}
                        </div>
                      </td>
                      <td className={`${tdClass} tabular-nums`}>{s.seats}</td>
                      <td className={`${tdClass} font-semibold tabular-nums`}>{formatMoney(s.amount, s.currency)}</td>
                      <td className={`${tdClass} text-[var(--color-text-secondary)] whitespace-nowrap`}>
                        <div>{formatInstant(s.current_period_start)}</div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">to {formatInstant(s.current_period_end)}</div>
                      </td>
                      <td className={`${tdClass} text-[var(--color-text-secondary)]`}>
                        {s.cancel_at_period_end ? "Cancels at period end" : s.auto_renew ? "Auto-renew" : "Manual"}
                        {s.payment_method_label && <div className="text-[11px] text-[var(--color-text-muted)]">{s.payment_method_label}</div>}
                      </td>
                      <td className={tdClass}>
                        <StatusBadge label={humanize(s.status)} tone={getStatusTone(s.status)} dot />
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <div className="inline-flex items-center justify-end gap-1">
                          {actions.includes("edit") && (
                            <AdminButton variant="ghost" size="xs" title="Edit subscription" aria-label="Edit subscription" onClick={() => onAction(s, "edit")}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </AdminButton>
                          )}
                          {actions.includes("renew") && (
                            <AdminButton variant="subtle" size="xs" onClick={() => onAction(s, "renew")}>
                              <RefreshCw className="w-3 h-3" /> Renew
                            </AdminButton>
                          )}
                          {actions.includes("cancel") && (
                            <AdminButton variant="outline" size="xs" onClick={() => onAction(s, "cancel")}>
                              <XCircle className="w-3 h-3" /> Cancel
                            </AdminButton>
                          )}
                          {actions.includes("reactivate") && (
                            <AdminButton variant="outline" size="xs" onClick={() => onAction(s, "reactivate")}>
                              <RotateCcw className="w-3 h-3" /> Reactivate
                            </AdminButton>
                          )}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                            title="Delete subscription"
                            aria-label="Delete subscription"
                            onClick={() => onAction(s, "delete")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </AdminButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && <PaginationBar {...barProps} />}
      </SurfaceCard>
    </div>
  );
}

/* ---------------------------------------------------------------- assign / edit */

interface SubFormValues {
  org_id: string;
  plan_id: string;
  billing_cycle: string;
  status: string;
  seats: string;
  amount: string;
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  cancel_at_period_end: boolean;
  payment_method_label: string;
}

function subFormValues(s: CommercialSubscription | null): SubFormValues {
  return {
    org_id: s?.org_id ?? "",
    plan_id: s?.plan_id ?? "",
    billing_cycle: s?.billing_cycle ?? "MONTHLY",
    status: s?.status ?? "ACTIVE",
    seats: s ? String(s.seats) : "",
    amount: s?.amount === null || s?.amount === undefined ? "" : String(s.amount),
    current_period_start: instantToDateInput(s?.current_period_start),
    current_period_end: instantToDateInput(s?.current_period_end),
    auto_renew: s ? s.auto_renew : true,
    cancel_at_period_end: s ? s.cancel_at_period_end : false,
    payment_method_label: s?.payment_method_label ?? "",
  };
}

export function validateSubscriptionForm(v: SubFormValues, isAssign: boolean): FieldErrors {
  const e: FieldErrors = {};
  if (isAssign && !v.org_id) e.org_id = "Choose an organization.";
  if (!v.plan_id) e.plan_id = "Choose a plan.";
  const seats = parseOptionalNumber(v.seats);
  if (seats !== null && (!Number.isInteger(seats) || seats < 1)) e.seats = "Whole number, 1 or more.";
  if (!isAssign) {
    const amount = parseOptionalNumber(v.amount);
    if (amount !== null && (Number.isNaN(amount) || amount < 0)) e.amount = "Enter 0 or more.";
    if (v.current_period_start && v.current_period_end && v.current_period_end < v.current_period_start) {
      e.current_period_end = "The period cannot end before it starts.";
    }
  }
  return e;
}

export function SubscriptionFormModal({
  isOpen,
  subscription,
  lookups,
  busy,
  failure,
  onReload,
  onClose,
  onAssign,
  onUpdate,
}: {
  isOpen: boolean;
  /** null = assign a new subscription. */
  subscription: CommercialSubscription | null;
  lookups: Lookups;
  busy: boolean;
  failure: MutationFailure | null;
  onReload: () => void;
  onClose: () => void;
  onAssign: (body: AssignSubscriptionBody) => void;
  onUpdate: (body: UpdateSubscriptionBody) => void;
}) {
  const [v, setV] = useState(() => subFormValues(subscription));
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    if (isOpen) {
      setV(subFormValues(subscription));
      setErrors({});
    }
  }, [isOpen, subscription]);
  const set = <K extends keyof SubFormValues>(k: K, value: SubFormValues[K]) => setV((p) => ({ ...p, [k]: value }));
  const err = (f: string) => fieldError(failure, errors, f);
  const isAssign = subscription === null;
  const planOptions = [{ label: "Choose a plan", value: "" }, ...lookups.plans.map((p) => ({ label: `${p.name} (${p.code})`, value: p.id }))];

  return (
    <CommercialFormModal
      isOpen={isOpen}
      title={isAssign ? "Assign Subscription" : `Edit subscription ${subscription.id}`}
      description={isAssign ? "The amount is taken from the plan price for the chosen cycle." : lookups.orgName(subscription.org_id)}
      maxWidth="lg"
      busy={busy}
      failure={failure}
      onReload={onReload}
      onClose={onClose}
      submitLabel={isAssign ? "Assign" : "Save Subscription"}
      onSubmit={() => {
        const found = validateSubscriptionForm(v, isAssign);
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        if (isAssign) {
          onAssign({
            org_id: v.org_id,
            plan_id: v.plan_id,
            billing_cycle: v.billing_cycle,
            seats: parseOptionalNumber(v.seats),
            auto_renew: v.auto_renew,
            payment_method_label: optionalText(v.payment_method_label),
          });
        } else {
          onUpdate({
            plan_id: v.plan_id,
            billing_cycle: v.billing_cycle,
            status: v.status,
            seats: parseOptionalNumber(v.seats),
            amount: parseOptionalNumber(v.amount),
            current_period_start: dateInputToInstant(v.current_period_start),
            current_period_end: dateInputToInstant(v.current_period_end),
            auto_renew: v.auto_renew,
            cancel_at_period_end: v.cancel_at_period_end,
            payment_method_label: optionalText(v.payment_method_label),
          });
        }
      }}
    >
      {isAssign && (
        <AdminSelect
          label="Organization *"
          value={v.org_id}
          onChange={(e) => set("org_id", e.target.value)}
          options={[{ label: "Choose an organization", value: "" }, ...lookups.orgs.map((o) => ({ label: o.name, value: o.id }))]}
          error={err("org_id")}
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AdminSelect label="Plan *" value={v.plan_id} onChange={(e) => set("plan_id", e.target.value)} options={planOptions} error={err("plan_id")} />
        <AdminSelect
          label="Billing cycle"
          value={v.billing_cycle}
          onChange={(e) => set("billing_cycle", e.target.value)}
          options={BILLING_CYCLES.map((c) => ({ label: humanize(c), value: c }))}
          error={err("billing_cycle")}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AdminInput label="Seats" type="number" min={1} value={v.seats} onChange={(e) => set("seats", e.target.value)} helperText={isAssign ? "Empty uses the plan's seat limit." : undefined} error={err("seats")} />
        {!isAssign && (
          <AdminInput label="Contract amount" type="number" min={0} step="0.01" value={v.amount} onChange={(e) => set("amount", e.target.value)} error={err("amount")} />
        )}
        {!isAssign && (
          <AdminSelect
            label="Status"
            value={v.status}
            onChange={(e) => set("status", e.target.value)}
            options={SUBSCRIPTION_STATUS_OPTIONS.map((s) => ({ label: humanize(s), value: s }))}
            error={err("status")}
          />
        )}
      </div>
      {!isAssign && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AdminInput label="Period start (UTC)" type="date" value={v.current_period_start} onChange={(e) => set("current_period_start", e.target.value)} error={err("current_period_start")} />
          <AdminInput label="Period end (UTC)" type="date" value={v.current_period_end} onChange={(e) => set("current_period_end", e.target.value)} error={err("current_period_end")} />
        </div>
      )}
      <AdminInput label="Payment method label" value={v.payment_method_label} onChange={(e) => set("payment_method_label", e.target.value)} error={err("payment_method_label")} />
      <div className="flex flex-wrap gap-4">
        <Checkbox label="Auto-renew" checked={v.auto_renew} onChange={(c) => set("auto_renew", c)} />
        {!isAssign && <Checkbox label="Cancel at period end" checked={v.cancel_at_period_end} onChange={(c) => set("cancel_at_period_end", c)} />}
      </div>
    </CommercialFormModal>
  );
}
