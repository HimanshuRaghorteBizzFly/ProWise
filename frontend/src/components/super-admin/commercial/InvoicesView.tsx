"use client";

import React, { useEffect, useState } from "react";
import { Ban, CheckCircle2, Edit3, Eye, Plus, Receipt, RefreshCw, Trash2, X } from "lucide-react";
import type {
  CommercialInvoice,
  CommercialInvoiceSummary,
  CreateInvoiceBody,
  InvoiceLineItemBody,
  UpdateInvoiceBody,
} from "@/types/admin-commercial";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import {
  BillingDormantNotice,
  ResourceStatus,
  formatInstant,
  formatLocalDate,
  formatMoney,
  humanize,
  type ResourceState,
} from "../admin-resource";
import {
  CommercialFormModal,
  fieldError,
  optionalText,
  parseOptionalNumber,
  type FieldErrors,
  type MutationFailure,
} from "./mutation";
import { OrgCell, selectClass, tdClass, thClass, theadClass, type Lookups } from "./shared";
import { usePagedRows } from "../use-paged-rows";

export const INVOICE_STATUS_OPTIONS = ["DRAFT", "OPEN", "PAID", "OVERDUE", "VOID"];

export type InvoiceAction = "view" | "edit" | "mark-paid" | "void" | "delete";

/** Actions the backend offers for an invoice in this state. */
export function invoiceActions(i: CommercialInvoice): InvoiceAction[] {
  const a: InvoiceAction[] = ["view"];
  const settled = i.status === "PAID" || i.status === "VOID";
  if (!settled) a.push("edit", "mark-paid", "void");
  a.push("delete");
  return a;
}

export interface InvoicesViewProps {
  state: ResourceState<CommercialInvoice[]>;
  summary: ResourceState<CommercialInvoiceSummary>;
  lookups: Lookups;
  search: string;
  status: string;
  orgId: string;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onOrgChange: (v: string) => void;
  onRetry: () => void;
  onCreate: () => void;
  onAction: (i: CommercialInvoice, action: InvoiceAction) => void;
}

export function InvoicesView(props: InvoicesViewProps) {
  const { state, summary, lookups, search, status, orgId, onSearchChange, onStatusChange, onOrgChange, onRetry, onCreate, onAction } = props;
  const rows = state.status === "ready" ? state.data : [];
  const s = summary.status === "ready" ? summary.data : null;
  const filtered = search.trim() !== "" || status !== "ALL" || orgId !== "ALL";
  const { pageRows, barProps } = usePagedRows(rows);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        description="Invoices stored on the server: generate, correct, mark paid and void."
        badge={state.status === "ready" ? `${rows.length} shown` : undefined}
        actions={
          <>
            <AdminButton variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={onCreate}>
              <Plus className="w-3.5 h-3.5" /> Generate Invoice
            </AdminButton>
          </>
        }
      />
      <BillingDormantNotice editable />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Invoices" value={s ? s.total_invoices : "-"} icon={Receipt} tone="blue" />
        <KpiCard label="Billed" value={s ? formatMoney(s.total_billed) : "-"} sublabel={s ? `Paid ${formatMoney(s.total_paid)}` : undefined} icon={Receipt} tone="violet" />
        <KpiCard label="Outstanding" value={s ? formatMoney(s.total_outstanding) : "-"} icon={Receipt} tone="amber" />
        <KpiCard label="Overdue" value={s ? s.overdue_count : "-"} icon={Receipt} tone={s && s.overdue_count > 0 ? "rose" : "slate"} />
      </div>
      {summary.status === "error" && <p className="text-xs text-rose-700 dark:text-rose-300">Summary unavailable: {summary.message}</p>}

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder="Search invoice number"
            hasActiveFilters={filtered}
            onResetFilters={() => {
              onSearchChange("");
              onStatusChange("ALL");
              onOrgChange("ALL");
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Filter invoice status" className={selectClass} value={status} onChange={(e) => onStatusChange(e.target.value)}>
                  <option value="ALL">All statuses</option>
                  {INVOICE_STATUS_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {humanize(v)}
                    </option>
                  ))}
                </select>
                <select aria-label="Filter organization" className={selectClass} value={orgId} onChange={(e) => onOrgChange(e.target.value)}>
                  <option value="ALL">All organizations</option>
                  {lookups.orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
        </div>
        <ResourceStatus
          state={state}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={Receipt}
          emptyTitle={filtered ? "No invoices match" : "No invoices stored"}
          emptyDescription={filtered ? "Change the search or filters." : "Generated invoices appear here."}
        />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Invoices">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Invoice</th>
                  <th className={thClass}>Organization</th>
                  <th className={thClass}>Issued</th>
                  <th className={thClass}>Due</th>
                  <th className={thClass}>Total</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {pageRows.map((i) => {
                  const actions = invoiceActions(i);
                  return (
                    <tr key={i.id} className="hover:bg-[var(--color-hover)]">
                      <td className={tdClass}>
                        <button
                          type="button"
                          onClick={() => onAction(i, "view")}
                          className="inline-flex items-center rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-500/20"
                        >
                          {i.invoice_number}
                        </button>
                        <div className="text-[11px] text-[var(--color-text-muted)] mt-1">
                          {(i.line_items ?? []).length} line item{(i.line_items ?? []).length === 1 ? "" : "s"}
                        </div>
                      </td>
                      <td className={tdClass}>
                        <OrgCell name={lookups.orgName(i.org_id)} sub={i.subscription_id ?? undefined} />
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-[var(--color-text-secondary)]`}>{formatLocalDate(i.issue_date)}</td>
                      <td className={`${tdClass} whitespace-nowrap text-[var(--color-text-secondary)]`}>{formatLocalDate(i.due_date)}</td>
                      <td className={`${tdClass} font-bold tabular-nums`}>{formatMoney(i.total)}</td>
                      <td className={tdClass}>
                        <StatusBadge label={humanize(i.status)} tone={getStatusTone(i.status)} dot />
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <div className="inline-flex items-center justify-end gap-1">
                          <AdminButton variant="ghost" size="xs" title="View invoice" aria-label="View invoice" onClick={() => onAction(i, "view")}>
                            <Eye className="w-3.5 h-3.5" />
                          </AdminButton>
                          {actions.includes("edit") && (
                            <AdminButton variant="ghost" size="xs" title="Edit invoice" aria-label="Edit invoice" onClick={() => onAction(i, "edit")}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </AdminButton>
                          )}
                          {actions.includes("mark-paid") && (
                            <AdminButton variant="subtle" size="xs" onClick={() => onAction(i, "mark-paid")}>
                              <CheckCircle2 className="w-3 h-3" /> Mark paid
                            </AdminButton>
                          )}
                          {actions.includes("void") && (
                            <AdminButton variant="ghost" size="xs" title="Void invoice" aria-label="Void invoice" onClick={() => onAction(i, "void")}>
                              <Ban className="w-3.5 h-3.5" />
                            </AdminButton>
                          )}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                            title="Delete invoice"
                            aria-label="Delete invoice"
                            onClick={() => onAction(i, "delete")}
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

export function InvoiceDetailModal({
  invoice,
  lookups,
  onClose,
}: {
  invoice: CommercialInvoice | null;
  lookups: Lookups;
  onClose: () => void;
}) {
  const i = invoice;
  return (
    <AdminModal isOpen={i !== null} onClose={onClose} title={i?.invoice_number ?? "Invoice"} description={i ? lookups.orgName(i.org_id) : undefined} maxWidth="2xl">
      {i && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusBadge label={humanize(i.status)} tone={getStatusTone(i.status)} dot />
            <span className="text-[var(--color-text-secondary)]">
              Issued {formatLocalDate(i.issue_date)} · Due {formatLocalDate(i.due_date)}
              {i.paid_at ? ` · Paid ${formatInstant(i.paid_at)}` : ""}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left text-xs" aria-label="Line items">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Description</th>
                  <th className={`${thClass} text-right`}>Qty</th>
                  <th className={`${thClass} text-right`}>Unit price</th>
                  <th className={`${thClass} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {(i.line_items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`${tdClass} text-[var(--color-text-muted)]`}>
                      No line items stored.
                    </td>
                  </tr>
                ) : (
                  (i.line_items ?? []).map((li, idx) => (
                    <tr key={li.id ?? idx}>
                      <td className={tdClass}>{li.description}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{li.quantity}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{formatMoney(li.unit_price)}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{formatMoney(li.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto w-full sm:w-64 space-y-1">
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-secondary)]">Subtotal</dt>
              <dd className="tabular-nums">{formatMoney(i.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-secondary)]">Tax{i.tax_rate !== null ? ` (${i.tax_rate}%)` : ""}</dt>
              <dd className="tabular-nums">{formatMoney(i.tax_amount)}</dd>
            </div>
            <div className="flex justify-between font-bold border-t border-[var(--color-border)] pt-1">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(i.total)}</dd>
            </div>
          </dl>
          {i.notes && <p className="rounded-lg border border-[var(--color-border)] p-2.5 text-[var(--color-text-secondary)]">{i.notes}</p>}
          <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
            <AdminButton variant="ghost" size="sm" onClick={onClose}>
              Close
            </AdminButton>
          </div>
        </div>
      )}
    </AdminModal>
  );
}

/* ---------------------------------------------------------------- generate / edit */

interface LineRow {
  id: string | null;
  description: string;
  quantity: string;
  unit_price: string;
}

interface InvoiceFormValues {
  org_id: string;
  subscription_id: string;
  issue_date: string;
  due_date: string;
  status: string;
  tax_rate: string;
  notes: string;
  lines: LineRow[];
}

function invoiceFormValues(i: CommercialInvoice | null): InvoiceFormValues {
  return {
    org_id: i?.org_id ?? "",
    subscription_id: i?.subscription_id ?? "",
    issue_date: i?.issue_date ?? "",
    due_date: i?.due_date ?? "",
    status: i?.status ?? "OPEN",
    tax_rate: i?.tax_rate === null || i?.tax_rate === undefined ? "" : String(i.tax_rate),
    notes: i?.notes ?? "",
    lines: (i?.line_items ?? []).length
      ? (i?.line_items ?? []).map((li) => ({ id: li.id, description: li.description, quantity: String(li.quantity), unit_price: String(li.unit_price) }))
      : [{ id: null, description: "", quantity: "1", unit_price: "" }],
  };
}

/** Mirrors CreateInvoiceRequest / LineItemDTO: org required, at least one line, description, quantity, unit price >= 0. */
export function validateInvoiceForm(v: InvoiceFormValues, isCreate: boolean): FieldErrors {
  const e: FieldErrors = {};
  if (isCreate && !v.org_id) e.org_id = "Choose an organization.";
  if (v.issue_date && v.due_date && v.due_date < v.issue_date) e.due_date = "The due date cannot be before the issue date.";
  const tax = parseOptionalNumber(v.tax_rate);
  if (tax !== null && (Number.isNaN(tax) || tax < 0 || tax > 100)) e.tax_rate = "Enter a rate between 0 and 100.";
  if (v.lines.length === 0) e.line_items = "Add at least one line item.";
  v.lines.forEach((l, idx) => {
    if (!l.description.trim()) e[`line_items[${idx}].description`] = "Description is required.";
    const q = parseOptionalNumber(l.quantity);
    if (q === null || !Number.isInteger(q) || q < 1) e[`line_items[${idx}].quantity`] = "Whole number, 1 or more.";
    const p = parseOptionalNumber(l.unit_price);
    if (p === null || Number.isNaN(p) || p < 0) e[`line_items[${idx}].unit_price`] = "Enter 0 or more.";
  });
  return e;
}

function linesBody(lines: LineRow[]): InvoiceLineItemBody[] {
  return lines.map((l) => ({
    ...(l.id ? { id: l.id } : {}),
    description: l.description.trim(),
    quantity: Number(l.quantity),
    unit_price: Number(l.unit_price),
  }));
}

export function InvoiceFormModal({
  isOpen,
  invoice,
  lookups,
  busy,
  failure,
  onReload,
  onClose,
  onCreate,
  onUpdate,
}: {
  isOpen: boolean;
  invoice: CommercialInvoice | null;
  lookups: Lookups;
  busy: boolean;
  failure: MutationFailure | null;
  onReload: () => void;
  onClose: () => void;
  onCreate: (body: CreateInvoiceBody) => void;
  onUpdate: (body: UpdateInvoiceBody) => void;
}) {
  const [v, setV] = useState(() => invoiceFormValues(invoice));
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    if (isOpen) {
      setV(invoiceFormValues(invoice));
      setErrors({});
    }
  }, [isOpen, invoice]);
  const set = <K extends keyof InvoiceFormValues>(k: K, value: InvoiceFormValues[K]) => setV((p) => ({ ...p, [k]: value }));
  const setLine = (idx: number, patch: Partial<LineRow>) =>
    setV((p) => ({ ...p, lines: p.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));
  const err = (f: string) => fieldError(failure, errors, f);
  const isCreate = invoice === null;
  const subtotal = v.lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);

  return (
    <CommercialFormModal
      isOpen={isOpen}
      title={isCreate ? "Generate Invoice" : `Edit ${invoice.invoice_number}`}
      description="Totals and tax are calculated by the server from the line items."
      maxWidth="2xl"
      busy={busy}
      failure={failure}
      onReload={onReload}
      onClose={onClose}
      submitLabel={isCreate ? "Generate Invoice" : "Save Invoice"}
      onSubmit={() => {
        const found = validateInvoiceForm(v, isCreate);
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        const common = {
          issue_date: v.issue_date || null,
          due_date: v.due_date || null,
          tax_rate: parseOptionalNumber(v.tax_rate),
          notes: optionalText(v.notes),
          line_items: linesBody(v.lines),
        };
        if (isCreate) onCreate({ org_id: v.org_id, subscription_id: optionalText(v.subscription_id), ...common });
        else onUpdate({ ...common, status: v.status });
      }}
    >
      {isCreate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AdminSelect
            label="Organization *"
            value={v.org_id}
            onChange={(e) => set("org_id", e.target.value)}
            options={[{ label: "Choose an organization", value: "" }, ...lookups.orgs.map((o) => ({ label: o.name, value: o.id }))]}
            error={err("org_id")}
          />
          <AdminInput label="Subscription ID" value={v.subscription_id} onChange={(e) => set("subscription_id", e.target.value)} error={err("subscription_id")} />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AdminInput label="Issue date" type="date" value={v.issue_date} onChange={(e) => set("issue_date", e.target.value)} error={err("issue_date")} />
        <AdminInput label="Due date" type="date" value={v.due_date} onChange={(e) => set("due_date", e.target.value)} error={err("due_date")} />
        <AdminInput label="Tax rate %" type="number" min={0} max={100} step="0.01" value={v.tax_rate} onChange={(e) => set("tax_rate", e.target.value)} error={err("tax_rate")} />
      </div>
      {!isCreate && (
        <AdminSelect label="Status" value={v.status} onChange={(e) => set("status", e.target.value)} options={INVOICE_STATUS_OPTIONS.map((s) => ({ label: humanize(s), value: s }))} error={err("status")} />
      )}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-[var(--color-text-secondary)]">Line items *</legend>
        {err("line_items") && <p className="text-[11px] text-red-500">{err("line_items")}</p>}
        {v.lines.map((l, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-12 sm:col-span-6">
              <AdminInput aria-label={`Line ${idx + 1} description`} placeholder="Description" value={l.description} onChange={(e) => setLine(idx, { description: e.target.value })} error={err(`line_items[${idx}].description`)} />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <AdminInput aria-label={`Line ${idx + 1} quantity`} type="number" min={1} value={l.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} error={err(`line_items[${idx}].quantity`)} />
            </div>
            <div className="col-span-6 sm:col-span-3">
              <AdminInput aria-label={`Line ${idx + 1} unit price`} type="number" min={0} step="0.01" placeholder="Unit price" value={l.unit_price} onChange={(e) => setLine(idx, { unit_price: e.target.value })} error={err(`line_items[${idx}].unit_price`)} />
            </div>
            <div className="col-span-2 sm:col-span-1 pt-1.5">
              <button
                type="button"
                aria-label={`Remove line ${idx + 1}`}
                disabled={v.lines.length === 1}
                onClick={() => set("lines", v.lines.filter((_, i) => i !== idx))}
                className="text-[var(--color-text-muted)] hover:text-rose-500 disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <AdminButton type="button" variant="outline" size="xs" onClick={() => set("lines", [...v.lines, { id: null, description: "", quantity: "1", unit_price: "" }])}>
            <Plus className="w-3.5 h-3.5" /> Add line
          </AdminButton>
          <span className="text-xs text-[var(--color-text-secondary)]">Subtotal before tax: {formatMoney(subtotal)}</span>
        </div>
      </fieldset>
      <AdminTextarea label="Notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} error={err("notes")} />
    </CommercialFormModal>
  );
}
