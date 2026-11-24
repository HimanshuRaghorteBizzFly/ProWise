"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { commercialApi } from "@/lib/admin-api/commercial";
import type { CommercialInvoice } from "@/types/admin-commercial";
import { AdminInput } from "../_components/SuperAdminPrimitives";
import { useAdminResource, useDebounced } from "@/components/super-admin/admin-resource";
import { CommercialFormModal, optionalText, useMutation } from "@/components/super-admin/commercial/mutation";
import { buildLookups } from "@/components/super-admin/commercial/shared";
import {
  InvoiceDetailModal,
  InvoiceFormModal,
  InvoicesView,
  type InvoiceAction,
} from "@/components/super-admin/commercial/InvoicesView";

type Pending = { kind: "create" } | { kind: InvoiceAction; invoice: CommercialInvoice };

export default function SuperAdminInvoicesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [orgId, setOrgId] = useState("ALL");
  const query = { search: useDebounced(search), status, orgId };
  const list = useAdminResource(() => commercialApi.invoices.list(query), JSON.stringify(query));
  const summary = useAdminResource(() => commercialApi.invoices.summary(), "invoice-summary");
  const orgs = useAdminResource(() => commercialApi.organizations.list(), "invoice-orgs");
  const plans = useAdminResource(() => commercialApi.plans.list(), "invoice-plans");
  const lookups = useMemo(() => buildLookups(orgs.state, plans.state), [orgs.state, plans.state]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [paymentId, setPaymentId] = useState("");
  const m = useMutation();

  const open = (p: Pending) => {
    m.begin();
    setPaymentId("");
    setPending(p);
  };
  const close = () => setPending(null);
  const reloadAll = () => {
    void list.reload();
    void summary.reload();
  };
  const reloadAfterStale = () => {
    close();
    reloadAll();
  };
  const finish = (message: string) => {
    toast.success(message);
    close();
    reloadAll();
  };
  const target = pending && pending.kind !== "create" ? pending.invoice : null;
  const confirmKind =
    pending?.kind === "mark-paid" || pending?.kind === "void" || pending?.kind === "delete" ? pending.kind : null;

  return (
    <>
      <InvoicesView
        state={list.state}
        summary={summary.state}
        lookups={lookups}
        search={search}
        status={status}
        orgId={orgId}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onOrgChange={setOrgId}
        onRetry={() => {
          reloadAll();
          void orgs.reload();
          void plans.reload();
        }}
        onCreate={() => open({ kind: "create" })}
        onAction={(invoice, action) => open({ kind: action, invoice })}
      />

      <InvoiceDetailModal invoice={pending?.kind === "view" ? pending.invoice : null} lookups={lookups} onClose={close} />

      <InvoiceFormModal
        isOpen={pending?.kind === "create" || pending?.kind === "edit"}
        invoice={pending?.kind === "edit" ? pending.invoice : null}
        lookups={lookups}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        onCreate={async (body) => {
          const res = await m.run((key) => commercialApi.invoices.create(body, key));
          if (res.ok) finish(`Generated invoice ${res.value.invoice_number}.`);
        }}
        onUpdate={async (body) => {
          if (pending?.kind !== "edit") return;
          const { invoice } = pending;
          const res = await m.run((key) => commercialApi.invoices.update(invoice.id, invoice.version, body, key));
          if (res.ok) finish(`Saved invoice ${invoice.invoice_number}.`);
        }}
      />

      <CommercialFormModal
        isOpen={confirmKind !== null}
        title={
          target
            ? `${confirmKind === "mark-paid" ? "Mark" : confirmKind === "void" ? "Void" : "Delete"} ${target.invoice_number}${confirmKind === "mark-paid" ? " as paid" : ""}?`
            : ""
        }
        description={target ? lookups.orgName(target.org_id) : undefined}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        submitLabel={confirmKind === "mark-paid" ? "Mark Paid" : confirmKind === "void" ? "Void Invoice" : "Delete Invoice"}
        submitVariant={confirmKind === "mark-paid" ? "primary" : "danger"}
        onSubmit={async () => {
          if (!target || !confirmKind) return;
          const kind = confirmKind;
          const res = await m.run<unknown>((key) => {
            if (kind === "mark-paid") return commercialApi.invoices.markPaid(target.id, target.version, optionalText(paymentId), key);
            if (kind === "void") return commercialApi.invoices.voidInvoice(target.id, target.version, key);
            return commercialApi.invoices.remove(target.id, target.version, key);
          });
          if (res.ok) {
            finish(
              kind === "mark-paid"
                ? `Marked ${target.invoice_number} as paid.`
                : kind === "void"
                  ? `Voided ${target.invoice_number}.`
                  : `Deleted ${target.invoice_number}.`,
            );
          }
        }}
      >
        <p className="text-xs text-[var(--color-text-secondary)]">
          {confirmKind === "mark-paid"
            ? "Records the invoice as paid now. Optionally link the payment record that settled it."
            : confirmKind === "void"
              ? "A voided invoice stays stored but is no longer payable."
              : "The invoice and its line items are permanently removed from the server."}
        </p>
        {confirmKind === "mark-paid" && (
          <AdminInput label="Payment ID (optional)" value={paymentId} onChange={(e) => setPaymentId(e.target.value)} />
        )}
      </CommercialFormModal>
    </>
  );
}
