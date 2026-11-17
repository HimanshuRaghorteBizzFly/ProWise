"use client";

import React, { useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Download,
  FileSearch,
  FileText,
  Mail,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Invoice, PaymentMethodType } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import {
  downloadInvoicePdf,
  formatCurrencyExact,
  formatDateTime,
  formatShortDate,
  printInvoicePdf,
} from "../_services/super-admin-service";
import {
  AdminButton,
  AdminModal,
  AdminSelect,
  ConfirmActionModal,
  SimulationNotice,
  StatusBadge,
  getStatusTone,
} from "./SuperAdminPrimitives";

export type InvoiceModalView = "details" | "preview";

export function InvoiceModal({
  invoiceId,
  initialView = "details",
  onClose,
}: {
  invoiceId: string | null;
  initialView?: InvoiceModalView;
  onClose: () => void;
}) {
  const invoices = useSuperAdminStore((s) => s.invoices);
  const organizations = useSuperAdminStore((s) => s.organizations);
  const plans = useSuperAdminStore((s) => s.plans);
  const payments = useSuperAdminStore((s) => s.payments);
  const markInvoicePaid = useSuperAdminStore((s) => s.markInvoicePaid);
  const voidInvoice = useSuperAdminStore((s) => s.voidInvoice);
  const sendInvoiceReminder = useSuperAdminStore((s) => s.sendInvoiceReminder);
  const { can } = useAdminPermissions();

  const [payMethod, setPayMethod] = useState<PaymentMethodType>("CARD");
  const [confirmVoidOpen, setConfirmVoidOpen] = useState(false);
  const [viewMode, setViewMode] = useState<InvoiceModalView>(initialView);

  useEffect(() => {
    if (invoiceId) {
      setViewMode(initialView);
    }
  }, [invoiceId, initialView]);

  const invoice: Invoice | undefined = invoiceId
    ? invoices.find((i) => i.id === invoiceId)
    : undefined;

  if (!invoice) return null;

  const org = organizations.find((o) => o.id === invoice.orgId);
  const plan = org ? plans.find((p) => p.id === org.planId) : undefined;
  const linkedPayment = invoice.paymentId
    ? payments.find((p) => p.id === invoice.paymentId)
    : undefined;

  const canManageInvoices = can("invoices.manage");

  return (
    <>
      <AdminModal
        isOpen={Boolean(invoice)}
        onClose={onClose}
        title={`Invoice ${invoice.invoiceNumber}`}
        description={org ? `Billed to ${org.name} (${org.ownerEmail})` : undefined}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {/* Dark-Mode Friendly View Switcher + Quick Print Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2">
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("details")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                  viewMode === "details"
                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Invoice Details
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                  viewMode === "preview"
                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <FileSearch className="w-3.5 h-3.5" />
                Preview PDF
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <AdminButton
                variant="outline"
                size="xs"
                onClick={() => {
                  printInvoicePdf(invoice, org, plan?.name);
                  toast.info(`Opened Print / Save as PDF for ${invoice.invoiceNumber}`);
                }}
              >
                <Printer className="w-3.5 h-3.5" />
                Print in PDF
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                onClick={() => {
                  downloadInvoicePdf(invoice, org, plan?.name);
                  toast.success(`Downloaded ${invoice.invoiceNumber}.pdf`);
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </AdminButton>
            </div>
          </div>

          {viewMode === "preview" ? (
            /* Dark-Mode Native PDF Document Sheet Preview */
            <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-5 sm:p-6 space-y-5 shadow-sm">
              <span className="absolute inset-x-0 top-0 h-1 bg-blue-500" aria-hidden="true" />

              {/* Brand & Invoice Number Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-300 flex items-center justify-center font-extrabold text-xs">
                      PW
                    </span>
                    <span className="text-base font-extrabold tracking-tight text-[var(--color-text-primary)]">
                      ProWise SaaS Platform
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    Commercial Billing &amp; Governance Ledger • Official PDF Preview
                  </p>
                </div>
                <div className="sm:text-right space-y-1">
                  <div className="font-mono text-base font-bold text-blue-600 dark:text-blue-300">
                    {invoice.invoiceNumber}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    Issued {formatShortDate(invoice.issueDate)} • Due {formatShortDate(invoice.dueDate)}
                  </p>
                  <div className="sm:flex sm:justify-end pt-0.5">
                    <StatusBadge label={invoice.status} tone={getStatusTone(invoice.status)} dot />
                  </div>
                </div>
              </div>

              {/* Bill To & Billing Metadata Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Billed To
                  </p>
                  <p className="font-bold text-sm text-[var(--color-text-primary)]">
                    {org?.name || invoice.orgId}
                  </p>
                  {org && (
                    <>
                      <p className="text-[var(--color-text-secondary)]">
                        {org.ownerName} • {org.ownerEmail}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {org.domain} • {org.country}
                      </p>
                    </>
                  )}
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Billing Details
                  </p>
                  <p className="text-[var(--color-text-primary)]">
                    Subscription Tier: <strong>{plan?.name || "Custom"}</strong>
                  </p>
                  <p className="text-[var(--color-text-secondary)]">
                    Currency: <strong>USD</strong>
                  </p>
                  {linkedPayment ? (
                    <p className="text-[var(--color-text-secondary)]">
                      Payment Ref:{" "}
                      <span className="font-mono text-blue-600 dark:text-blue-400">
                        {linkedPayment.transactionRef}
                      </span>
                    </p>
                  ) : (
                    <p className="text-[var(--color-text-muted)]">Status: Awaiting settlement</p>
                  )}
                </div>
              </div>

              {/* Document Line Items Table */}
              <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    <tr>
                      <th className="px-3 py-2.5 w-10">#</th>
                      <th className="px-3 py-2.5">Description</th>
                      <th className="px-3 py-2.5 text-right">Qty</th>
                      <th className="px-3 py-2.5 text-right">Unit Price</th>
                      <th className="px-3 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {invoice.lineItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2.5 text-[var(--color-text-muted)] tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--color-text-primary)] font-medium">
                          {item.description}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[var(--color-text-secondary)] tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[var(--color-text-secondary)] tabular-nums">
                          {formatCurrencyExact(item.unitPrice)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-[var(--color-text-primary)] tabular-nums">
                          {formatCurrencyExact(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
                <div className="text-[11px] text-[var(--color-text-muted)]">
                  {invoice.paidAt ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Settled {formatDateTime(invoice.paidAt)}
                    </span>
                  ) : (
                    <span>Use &ldquo;Print in PDF&rdquo; to save or print a formatted PDF copy.</span>
                  )}
                </div>

                <div className="w-full sm:w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-[var(--color-text-secondary)]">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatCurrencyExact(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-text-secondary)]">
                    <span>Tax ({invoice.taxRate}%)</span>
                    <span className="tabular-nums">{formatCurrencyExact(invoice.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Total</span>
                    <span className="tabular-nums">{formatCurrencyExact(invoice.total)} USD</span>
                  </div>
                </div>
              </div>

              {invoice.notes && (
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-xs text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-text-primary)]">Notes: </span>
                  {invoice.notes}
                </div>
              )}
            </div>
          ) : (
            <>
              <SimulationNotice
                title="Client-Side Receipt & Simulated Billing"
                description="Preview PDF shows the formatted commercial document, Print in PDF opens your browser Save-as-PDF sheet, and Download PDF exports a binary .pdf receipt."
              />

              {/* Top Summary Card */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-mono text-sm font-bold text-[var(--color-text-primary)]">
                        {invoice.invoiceNumber}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        Issued {formatShortDate(invoice.issueDate)} • Due {formatShortDate(invoice.dueDate)}
                      </div>
                    </div>
                  </div>
                  <StatusBadge label={invoice.status} tone={getStatusTone(invoice.status)} dot />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      Billed Organization
                    </p>
                    <p className="font-semibold text-[var(--color-text-primary)] mt-1">
                      {org?.name || invoice.orgId}
                    </p>
                    {org && (
                      <>
                        <p className="text-[var(--color-text-secondary)]">{org.ownerName} • {org.ownerEmail}</p>
                        <p className="text-[var(--color-text-muted)]">{org.domain} ({org.country})</p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      Payment Tracking
                    </p>
                    <p className="text-[var(--color-text-primary)] mt-1">
                      Plan: <span className="font-semibold">{plan?.name || "Custom"}</span>
                    </p>
                    {linkedPayment ? (
                      <p className="text-[var(--color-text-secondary)]">
                        Transaction: <span className="font-mono">{linkedPayment.transactionRef}</span> ({linkedPayment.method} •••• {linkedPayment.methodLast4})
                      </p>
                    ) : (
                      <p className="text-[var(--color-text-muted)]">No settlement recorded yet</p>
                    )}
                    {invoice.paidAt && (
                      <p className="text-emerald-600 dark:text-emerald-400">
                        Settled {formatDateTime(invoice.paidAt)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                      <tr>
                        <th className="px-3 py-2.5">Description</th>
                        <th className="px-3 py-2.5 text-right">Qty</th>
                        <th className="px-3 py-2.5 text-right">Unit Price</th>
                        <th className="px-3 py-2.5 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {invoice.lineItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2.5 text-[var(--color-text-primary)] font-medium">
                            {item.description}
                          </td>
                          <td className="px-3 py-2.5 text-right text-[var(--color-text-secondary)]">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-2.5 text-right text-[var(--color-text-secondary)]">
                            {formatCurrencyExact(item.unitPrice)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-[var(--color-text-primary)]">
                            {formatCurrencyExact(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex flex-col items-end space-y-1 text-xs pt-1">
                  <div className="flex justify-between w-full max-w-[230px] text-[var(--color-text-secondary)]">
                    <span>Subtotal</span>
                    <span>{formatCurrencyExact(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between w-full max-w-[230px] text-[var(--color-text-secondary)]">
                    <span>Tax ({invoice.taxRate}%)</span>
                    <span>{formatCurrencyExact(invoice.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between w-full max-w-[230px] border-t border-[var(--color-border)] pt-1.5 text-sm font-bold text-[var(--color-text-primary)]">
                    <span>Total</span>
                    <span>{formatCurrencyExact(invoice.total)} USD</span>
                  </div>
                </div>

                {invoice.notes && (
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                    <span className="font-semibold text-[var(--color-text-primary)]">Notes: </span>
                    {invoice.notes}
                  </div>
                )}
              </div>

              {/* Payment Settlement Action when Open / Overdue */}
              {(invoice.status === "OPEN" || invoice.status === "OVERDUE") && (
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3.5">
                  <div className="w-full sm:w-52">
                    <AdminSelect
                      label="Record Payment Method (Simulated)"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as PaymentMethodType)}
                      options={[
                        { label: "Card (Stripe Simulated)", value: "CARD" },
                        { label: "ACH Bank Transfer", value: "ACH" },
                        { label: "Wire Settlement", value: "WIRE" },
                      ]}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminButton
                      variant="outline"
                      size="sm"
                      permissionLocked={!canManageInvoices}
                      onClick={() => {
                        const res = sendInvoiceReminder(invoice.id);
                        if (res.ok) {
                          toast.success(`Simulated reminder email dispatched to ${org?.ownerEmail}`);
                        } else {
                          toast.error(res.error || "Failed to send reminder");
                        }
                      }}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Send Reminder
                    </AdminButton>
                    <AdminButton
                      variant="primary"
                      size="sm"
                      permissionLocked={!canManageInvoices}
                      onClick={() => {
                        markInvoicePaid(invoice.id, payMethod);
                        toast.success(`Invoice ${invoice.invoiceNumber} marked as PAID`);
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark as Paid
                    </AdminButton>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
            <div>
              {(invoice.status === "OPEN" || invoice.status === "OVERDUE") && (
                <AdminButton
                  variant="ghost"
                  size="sm"
                  permissionLocked={!canManageInvoices}
                  className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  onClick={() => setConfirmVoidOpen(true)}
                >
                  <Ban className="w-3.5 h-3.5" />
                  Void Invoice
                </AdminButton>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => {
                  printInvoicePdf(invoice, org, plan?.name);
                  toast.info(`Opened Print / Save as PDF for ${invoice.invoiceNumber}`);
                }}
              >
                <Printer className="w-3.5 h-3.5" />
                Print in PDF
              </AdminButton>
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadInvoicePdf(invoice, org, plan?.name);
                  toast.success(`Downloaded ${invoice.invoiceNumber}.pdf (client-side receipt)`);
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </AdminButton>
              <AdminButton variant="secondary" size="sm" onClick={onClose}>
                Close
              </AdminButton>
            </div>
          </div>
        </div>
      </AdminModal>

      <ConfirmActionModal
        isOpen={confirmVoidOpen}
        onClose={() => setConfirmVoidOpen(false)}
        title={`Void ${invoice.invoiceNumber}?`}
        description="Voiding marks this invoice non-collectible in the ledger. This action is recorded in the audit log."
        confirmLabel="Void Invoice"
        variant="danger"
        onConfirm={() => {
          voidInvoice(invoice.id);
          toast.warning(`Invoice ${invoice.invoiceNumber} voided`);
        }}
      />
    </>
  );
}
