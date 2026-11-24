"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, DollarSign, Edit3, Eye, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import type {
  CommercialPayment,
  PaymentSummary,
  RecordPaymentBody,
  RefundPaymentBody,
  UpdatePaymentBody,
} from "@/types/admin-commercial";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  BulkSelectionBar,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getPaymentMethodBadgeClass,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { BillingDormantNotice, ResourceStatus, formatInstant, formatMoney, humanize, type ResourceState } from "../admin-resource";
import {
  CommercialFormModal,
  fieldError,
  optionalText,
  parseOptionalNumber,
  type FieldErrors,
  type MutationFailure,
} from "./mutation";
import { OrgCell, PlanBadge, selectClass, tdClass, thClass, theadClass, type Lookups } from "./shared";
import { usePagedRows } from "../use-paged-rows";

export const PAYMENT_STATUSES = ["SUCCEEDED", "PENDING", "FAILED", "PARTIALLY_REFUNDED", "REFUNDED"];
export const PAYMENT_METHODS = ["CARD", "ACH", "WIRE"];

export type PaymentAction = "view" | "edit" | "retry" | "refund" | "delete";

export function refundable(p: CommercialPayment): number {
  return Math.max(0, Number(p.amount ?? 0) - Number(p.refunded_amount ?? 0));
}

/** Actions the backend offers for a payment in this state. */
export function paymentActions(p: CommercialPayment): PaymentAction[] {
  const actions: PaymentAction[] = ["view", "edit"];
  if (p.status === "FAILED") actions.push("retry");
  if ((p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") && refundable(p) > 0) actions.push("refund");
  actions.push("delete");
  return actions;
}

export interface PaymentsViewProps {
  state: ResourceState<CommercialPayment[]>;
  summary: ResourceState<PaymentSummary>;
  lookups: Lookups;
  search: string;
  status: string;
  method: string;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onMethodChange: (v: string) => void;
  onRetry: () => void;
  onRecord: () => void;
  onAction: (p: CommercialPayment, action: PaymentAction) => void;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onBulkDelete?: () => void;
}

export function PaymentsView(props: PaymentsViewProps) {
  const { state, summary, lookups, search, status, method, onSearchChange, onStatusChange, onMethodChange, onRetry, onRecord, onAction } = props;
  const { selectedIds = [], onSelectedIdsChange, onBulkDelete } = props;
  const selectable = Boolean(onSelectedIdsChange);
  const selected = new Set(selectedIds);
  const all = state.status === "ready" ? state.data : [];
  const rows = all.filter((p) => method === "ALL" || p.method === method);
  const { pageRows, barProps } = usePagedRows(rows);
  // "Select all" picks the payments on the visible page; selections made on other pages are kept.
  const pageIds = pageRows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const s = summary.status === "ready" ? summary.data : null;
  const filtered = search.trim() !== "" || status !== "ALL" || method !== "ALL";
  const successRate =
    s && s.total_transactions > 0 ? `${((s.successful_count / s.total_transactions) * 100).toFixed(1)}%` : s ? "-" : "-";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing & Payments"
        description="Payment records stored on the server: record offline payments, correct entries, retry failed ones and issue refunds."
        badge={state.status === "ready" ? `${rows.length} shown` : undefined}
        actions={
          <>
            <AdminButton variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={onRecord}>
              <Plus className="w-3.5 h-3.5" /> Record Payment
            </AdminButton>
          </>
        }
      />
      <BillingDormantNotice editable />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          label="Net recorded"
          value={s ? formatMoney(Number(s.total_volume ?? 0) - Number(s.refunded_volume ?? 0)) : "-"}
          sublabel={s ? `Gross ${formatMoney(s.total_volume)}` : undefined}
          icon={DollarSign}
          tone="emerald"
        />
        <KpiCard label="Refunded" value={s ? formatMoney(s.refunded_volume) : "-"} icon={RotateCcw} tone="amber" />
        <KpiCard label="Success rate" value={successRate} sublabel={s ? `${s.total_transactions} records` : undefined} icon={CheckCircle2} tone="blue" />
        <KpiCard label="Failed" value={s ? s.failed_count : "-"} icon={AlertTriangle} tone={s && s.failed_count > 0 ? "rose" : "slate"} />
      </div>
      {summary.status === "error" && <p className="text-xs text-rose-700 dark:text-rose-300">Summary unavailable: {summary.message}</p>}

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder="Search reference or description"
            hasActiveFilters={filtered}
            onResetFilters={() => {
              onSearchChange("");
              onStatusChange("ALL");
              onMethodChange("ALL");
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Filter payment status" className={selectClass} value={status} onChange={(e) => onStatusChange(e.target.value)}>
                  <option value="ALL">All statuses</option>
                  {PAYMENT_STATUSES.map((v) => (
                    <option key={v} value={v}>
                      {humanize(v)}
                    </option>
                  ))}
                </select>
                <select aria-label="Filter payment method" className={selectClass} value={method} onChange={(e) => onMethodChange(e.target.value)}>
                  <option value="ALL">All methods</option>
                  {PAYMENT_METHODS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
        </div>

        {selectable && onBulkDelete && (
          <BulkSelectionBar
            selectedCount={selectedIds.length}
            onClear={() => onSelectedIdsChange?.([])}
            actions={
              <AdminButton variant="danger" size="xs" onClick={onBulkDelete}>
                <Trash2 className="w-3.5 h-3.5" /> Delete selected
              </AdminButton>
            }
          />
        )}

        <ResourceStatus
          state={state.status === "ready" ? { status: "ready", data: rows } : state}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={CreditCard}
          emptyTitle={filtered ? "No payments match" : "No payments stored"}
          emptyDescription={filtered ? "Change the search or filters." : "Recorded payments appear here."}
        />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Payments">
              <thead className={theadClass}>
                <tr>
                  {selectable && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all payments"
                        checked={allPageSelected}
                        onChange={() =>
                          onSelectedIdsChange?.(
                            allPageSelected
                              ? selectedIds.filter((id) => !pageIds.includes(id))
                              : Array.from(new Set([...selectedIds, ...pageIds])),
                          )
                        }
                        className="h-4 w-4 accent-blue-600"
                      />
                    </th>
                  )}
                  <th className={thClass}>Transaction</th>
                  <th className={thClass}>Organization</th>
                  <th className={thClass}>Amount</th>
                  <th className={thClass}>Method</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Recorded</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {pageRows.map((p) => {
                  const actions = paymentActions(p);
                  const org = lookups.orgs.find((o) => o.id === p.org_id);
                  return (
                    <tr key={p.id} className={`hover:bg-[var(--color-hover)] ${selected.has(p.id) ? "bg-blue-500/5" : ""}`}>
                      {selectable && (
                        <td className="px-4 py-3 w-10 align-top">
                          <input
                            type="checkbox"
                            aria-label={`Select ${p.transaction_ref}`}
                            checked={selected.has(p.id)}
                            onChange={() =>
                              onSelectedIdsChange?.(selected.has(p.id) ? selectedIds.filter((x) => x !== p.id) : [...selectedIds, p.id])
                            }
                            className="h-4 w-4 accent-blue-600"
                          />
                        </td>
                      )}
                      <td className={tdClass}>
                        <button
                          type="button"
                          onClick={() => onAction(p, "view")}
                          className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
                        >
                          {p.transaction_ref}
                        </button>
                        {p.description && <div className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[220px] mt-1">{p.description}</div>}
                      </td>
                      <td className={tdClass}>
                        <OrgCell
                          name={lookups.orgName(p.org_id)}
                          sub={org?.plan_id ? <PlanBadge planId={org.plan_id} plan={lookups.plan(org.plan_id)} /> : undefined}
                        />
                      </td>
                      <td className={tdClass}>
                        <div className={`font-bold tabular-nums ${p.status === "FAILED" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {formatMoney(p.amount, p.currency)}
                        </div>
                        {Number(p.refunded_amount ?? 0) > 0 && (
                          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-300">
                            -{formatMoney(p.refunded_amount, p.currency)} refunded
                          </span>
                        )}
                      </td>
                      <td className={tdClass}>
                        {p.method ? (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                              p.method === "CARD" || p.method === "ACH" || p.method === "WIRE" ? getPaymentMethodBadgeClass(p.method) : ""
                            }`}
                          >
                            {p.method}
                            {p.method_last4 ? ` •••• ${p.method_last4}` : ""}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className={tdClass}>
                        <StatusBadge label={humanize(p.status)} tone={getStatusTone(p.status)} dot />
                      </td>
                      <td className={`${tdClass} text-[var(--color-text-muted)] whitespace-nowrap`}>{formatInstant(p.created_at)}</td>
                      <td className={`${tdClass} text-right`}>
                        <div className="inline-flex items-center justify-end gap-1">
                          <AdminButton variant="ghost" size="xs" title="View payment" aria-label="View payment" onClick={() => onAction(p, "view")}>
                            <Eye className="w-3.5 h-3.5" />
                          </AdminButton>
                          <AdminButton variant="ghost" size="xs" title="Edit payment" aria-label="Edit payment" onClick={() => onAction(p, "edit")}>
                            <Edit3 className="w-3.5 h-3.5" />
                          </AdminButton>
                          {actions.includes("retry") && (
                            <AdminButton variant="subtle" size="xs" onClick={() => onAction(p, "retry")}>
                              <RefreshCw className="w-3 h-3" /> Retry
                            </AdminButton>
                          )}
                          {actions.includes("refund") && (
                            <AdminButton variant="outline" size="xs" onClick={() => onAction(p, "refund")}>
                              <RotateCcw className="w-3 h-3" /> Refund
                            </AdminButton>
                          )}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                            title="Delete payment"
                            aria-label="Delete payment"
                            onClick={() => onAction(p, "delete")}
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

/* ---------------------------------------------------------------- detail */

export function PaymentDetailModal({
  payment,
  lookups,
  onClose,
  onEdit,
}: {
  payment: CommercialPayment | null;
  lookups: Lookups;
  onClose: () => void;
  onEdit: (p: CommercialPayment) => void;
}) {
  const p = payment;
  const field = (label: string, value: React.ReactNode) => (
    <div>
      <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] tracking-wider">{label}</span>
      <p className="font-semibold text-[var(--color-text-primary)] mt-0.5 break-words">{value}</p>
    </div>
  );
  return (
    <AdminModal isOpen={p !== null} onClose={onClose} title={p?.transaction_ref ?? "Payment"} description={p?.gateway_label ?? undefined} maxWidth="lg">
      {p && (
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] tracking-wider">Amount</span>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatMoney(p.amount, p.currency)}</div>
              </div>
              <StatusBadge label={humanize(p.status)} tone={getStatusTone(p.status)} dot />
            </div>
            {p.description && <p className="text-[var(--color-text-secondary)] font-medium">{p.description}</p>}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--color-border)]">
              {field("Organization", lookups.orgName(p.org_id))}
              {field("Method", p.method ? `${p.method}${p.method_last4 ? ` •••• ${p.method_last4}` : ""}` : "-")}
              {field("Refunded", formatMoney(p.refunded_amount ?? 0, p.currency))}
              {field("Recorded", formatInstant(p.created_at))}
              {field("Subscription", p.subscription_id ?? "-")}
              {field("Invoice", p.invoice_id ?? "-")}
            </div>
            {p.failure_reason && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-rose-700 dark:text-rose-300">
                <strong>Failure reason: </strong>
                {p.failure_reason}
              </div>
            )}
            {p.refund_reason && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-800 dark:text-amber-200">
                <strong>Refund note: </strong>
                {p.refund_reason}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <AdminButton variant="ghost" size="sm" onClick={onClose}>
              Close
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={() => onEdit(p)}>
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </AdminButton>
          </div>
        </div>
      )}
    </AdminModal>
  );
}

/* ---------------------------------------------------------------- record / edit */

interface PaymentFormValues {
  org_id: string;
  amount: string;
  status: string;
  method: string;
  method_last4: string;
  gateway_label: string;
  description: string;
  failure_reason: string;
}

function paymentFormValues(p: CommercialPayment | null): PaymentFormValues {
  return {
    org_id: p?.org_id ?? "",
    amount: p ? String(p.amount) : "",
    status: p?.status ?? "SUCCEEDED",
    method: p?.method ?? "CARD",
    method_last4: p?.method_last4 ?? "",
    gateway_label: p?.gateway_label ?? "",
    description: p?.description ?? "",
    failure_reason: p?.failure_reason ?? "",
  };
}

/** Mirrors RecordPaymentRequest: org_id, amount >= 0.01 and a description are required. */
export function validatePaymentForm(v: PaymentFormValues, isCreate: boolean): FieldErrors {
  const e: FieldErrors = {};
  if (!v.org_id) e.org_id = "Choose an organization.";
  const amount = parseOptionalNumber(v.amount);
  if (isCreate && amount === null) e.amount = "Amount is required.";
  else if (amount !== null && (Number.isNaN(amount) || amount < 0.01)) e.amount = "Enter at least 0.01.";
  if (isCreate && !v.description.trim()) e.description = "Description is required.";
  if (v.method_last4 && !/^\d{4}$/.test(v.method_last4)) e.method_last4 = "Exactly 4 digits.";
  return e;
}

export function PaymentFormModal({
  isOpen,
  payment,
  lookups,
  busy,
  failure,
  onReload,
  onClose,
  onRecord,
  onUpdate,
}: {
  isOpen: boolean;
  payment: CommercialPayment | null;
  lookups: Lookups;
  busy: boolean;
  failure: MutationFailure | null;
  onReload: () => void;
  onClose: () => void;
  onRecord: (body: RecordPaymentBody) => void;
  onUpdate: (body: UpdatePaymentBody) => void;
}) {
  const [v, setV] = useState(() => paymentFormValues(payment));
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    if (isOpen) {
      setV(paymentFormValues(payment));
      setErrors({});
    }
  }, [isOpen, payment]);
  const set = <K extends keyof PaymentFormValues>(k: K, value: PaymentFormValues[K]) => setV((p) => ({ ...p, [k]: value }));
  const err = (f: string) => fieldError(failure, errors, f);
  const isCreate = payment === null;

  return (
    <CommercialFormModal
      isOpen={isOpen}
      title={isCreate ? "Record Payment" : `Edit ${payment.transaction_ref}`}
      description={isCreate ? "Records an offline or manual payment. No gateway is charged." : undefined}
      busy={busy}
      failure={failure}
      onReload={onReload}
      onClose={onClose}
      submitLabel={isCreate ? "Record Payment" : "Save Payment"}
      onSubmit={() => {
        const found = validatePaymentForm(v, isCreate);
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        if (isCreate) {
          onRecord({
            org_id: v.org_id,
            amount: Number(v.amount),
            method: v.method,
            method_last4: optionalText(v.method_last4),
            gateway_label: optionalText(v.gateway_label),
            description: v.description.trim(),
          });
        } else {
          onUpdate({
            org_id: v.org_id,
            amount: parseOptionalNumber(v.amount),
            status: v.status,
            method: v.method,
            method_last4: optionalText(v.method_last4),
            gateway_label: optionalText(v.gateway_label),
            description: optionalText(v.description),
            failure_reason: v.status === "FAILED" ? optionalText(v.failure_reason) : null,
          });
        }
      }}
    >
      <AdminSelect
        label="Organization *"
        value={v.org_id}
        onChange={(e) => set("org_id", e.target.value)}
        options={[
          { label: "Choose an organization", value: "" },
          ...lookups.orgs.map((o) => ({ label: o.name, value: o.id })),
          ...(v.org_id && !lookups.orgs.some((o) => o.id === v.org_id) ? [{ label: v.org_id, value: v.org_id }] : []),
        ]}
        error={err("org_id")}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AdminInput label={isCreate ? "Amount *" : "Amount"} type="number" min="0.01" step="0.01" value={v.amount} onChange={(e) => set("amount", e.target.value)} error={err("amount")} />
        <AdminSelect label="Method" value={v.method} onChange={(e) => set("method", e.target.value)} options={PAYMENT_METHODS.map((m) => ({ label: m, value: m }))} error={err("method")} />
        <AdminInput label="Last 4 digits" maxLength={4} inputMode="numeric" value={v.method_last4} onChange={(e) => set("method_last4", e.target.value)} error={err("method_last4")} />
      </div>
      {!isCreate && (
        <AdminSelect label="Status" value={v.status} onChange={(e) => set("status", e.target.value)} options={PAYMENT_STATUSES.map((s) => ({ label: humanize(s), value: s }))} error={err("status")} />
      )}
      <AdminInput label="Gateway label" value={v.gateway_label} onChange={(e) => set("gateway_label", e.target.value)} error={err("gateway_label")} />
      <AdminInput label={isCreate ? "Description *" : "Description"} value={v.description} onChange={(e) => set("description", e.target.value)} error={err("description")} />
      {!isCreate && v.status === "FAILED" && (
        <AdminInput label="Failure reason" value={v.failure_reason} onChange={(e) => set("failure_reason", e.target.value)} error={err("failure_reason")} />
      )}
    </CommercialFormModal>
  );
}

/* ---------------------------------------------------------------- refund */

/** Mirrors RefundPaymentRequest (amount >= 0.01, reason required) plus the server's "not more than remaining" rule. */
export function validateRefund(amountText: string, reason: string, max: number): FieldErrors {
  const e: FieldErrors = {};
  const amount = parseOptionalNumber(amountText);
  if (amount === null || Number.isNaN(amount) || amount < 0.01) e.amount = "Enter at least 0.01.";
  else if (amount > max + 1e-9) e.amount = `At most ${max.toFixed(2)} can be refunded.`;
  if (!reason.trim()) e.reason = "A reason is required for the audit log.";
  return e;
}

export function RefundModal({
  payment,
  busy,
  failure,
  onReload,
  onClose,
  onSubmit,
}: {
  payment: CommercialPayment | null;
  busy: boolean;
  failure: MutationFailure | null;
  onReload: () => void;
  onClose: () => void;
  onSubmit: (body: RefundPaymentBody) => void;
}) {
  const max = payment ? refundable(payment) : 0;
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    if (payment) {
      setAmount(refundable(payment).toFixed(2));
      setReason("");
      setErrors({});
    }
  }, [payment]);
  return (
    <CommercialFormModal
      isOpen={payment !== null}
      title={payment ? `Refund ${payment.transaction_ref}` : "Refund"}
      description="Records a full or partial refund on the stored payment."
      maxWidth="sm"
      busy={busy}
      failure={failure}
      onReload={onReload}
      onClose={onClose}
      submitLabel="Record Refund"
      submitVariant="danger"
      onSubmit={() => {
        const found = validateRefund(amount, reason, max);
        setErrors(found);
        if (Object.keys(found).length === 0) onSubmit({ amount: Number(amount), reason: reason.trim() });
      }}
    >
      {payment && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Original amount</span>
            <strong>{formatMoney(payment.amount, payment.currency)}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Refundable</span>
            <strong className="text-emerald-500">{formatMoney(max, payment.currency)}</strong>
          </div>
        </div>
      )}
      <AdminInput label="Refund amount *" type="number" min="0.01" step="0.01" max={max} value={amount} onChange={(e) => setAmount(e.target.value)} error={fieldError(failure, errors, "amount")} />
      <AdminTextarea label="Reason *" value={reason} onChange={(e) => setReason(e.target.value)} error={fieldError(failure, errors, "reason")} />
    </CommercialFormModal>
  );
}
