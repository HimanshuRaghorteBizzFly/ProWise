"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { commercialApi } from "@/lib/admin-api/commercial";
import type { CommercialPayment } from "@/types/admin-commercial";
import { useAdminResource, useDebounced } from "@/components/super-admin/admin-resource";
import { CommercialFormModal, useMutation } from "@/components/super-admin/commercial/mutation";
import { buildLookups } from "@/components/super-admin/commercial/shared";
import {
  PaymentDetailModal,
  PaymentFormModal,
  PaymentsView,
  RefundModal,
  type PaymentAction,
} from "@/components/super-admin/commercial/PaymentsView";

type Pending =
  | { kind: "record" }
  | { kind: "bulk-delete"; payments: CommercialPayment[] }
  | { kind: "view" | "edit" | "retry" | "refund" | "delete"; payment: CommercialPayment };

export default function SuperAdminPaymentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [method, setMethod] = useState("ALL");
  const query = { search: useDebounced(search), status };
  const list = useAdminResource(() => commercialApi.payments.list(query), JSON.stringify(query));
  const summary = useAdminResource(() => commercialApi.payments.summary(), "payment-summary");
  const orgs = useAdminResource(() => commercialApi.organizations.list(), "payment-orgs");
  const plans = useAdminResource(() => commercialApi.plans.list(), "payment-plans");
  const lookups = useMemo(() => buildLookups(orgs.state, plans.state), [orgs.state, plans.state]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const m = useMutation();

  const open = (p: Pending) => {
    m.begin();
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
  const target = pending && pending.kind !== "record" && pending.kind !== "bulk-delete" ? pending.payment : null;

  return (
    <>
      <PaymentsView
        state={list.state}
        summary={summary.state}
        lookups={lookups}
        search={search}
        status={status}
        method={method}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onMethodChange={setMethod}
        onRetry={() => {
          reloadAll();
          void orgs.reload();
          void plans.reload();
        }}
        onRecord={() => open({ kind: "record" })}
        onAction={(payment, action: PaymentAction) => open({ kind: action, payment })}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onBulkDelete={() => {
          const rows = list.state.status === "ready" ? list.state.data : [];
          const payments = rows.filter((p) => selectedIds.includes(p.id));
          if (payments.length > 0) open({ kind: "bulk-delete", payments });
        }}
      />

      <CommercialFormModal
        isOpen={pending?.kind === "bulk-delete"}
        title={pending?.kind === "bulk-delete" ? `Delete ${pending.payments.length} payment${pending.payments.length === 1 ? "" : "s"}?` : ""}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        submitLabel="Delete Selected"
        submitVariant="danger"
        onSubmit={async () => {
          if (pending?.kind !== "bulk-delete") return;
          const { payments } = pending;
          const res = await m.run((key) =>
            commercialApi.payments.bulkDelete(
              payments.map((p) => ({ id: p.id, version: p.version })),
              key,
            ),
          );
          if (res.ok) {
            setSelectedIds([]);
            finish(`Deleted ${payments.length} payment${payments.length === 1 ? "" : "s"}.`);
          }
        }}
      >
        <p className="text-xs text-[var(--color-text-secondary)]">
          {pending?.kind === "bulk-delete" ? pending.payments.map((p) => p.transaction_ref).join(", ") : ""}. The records are
          permanently removed; if any of them changed since the list was loaded, none is deleted.
        </p>
      </CommercialFormModal>

      <PaymentDetailModal
        payment={pending?.kind === "view" ? pending.payment : null}
        lookups={lookups}
        onClose={close}
        onEdit={(payment) => open({ kind: "edit", payment })}
      />

      <PaymentFormModal
        isOpen={pending?.kind === "record" || pending?.kind === "edit"}
        payment={pending?.kind === "edit" ? pending.payment : null}
        lookups={lookups}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        onRecord={async (body) => {
          const res = await m.run((key) => commercialApi.payments.record(body, key));
          if (res.ok) finish(`Recorded payment ${res.value.transaction_ref}.`);
        }}
        onUpdate={async (body) => {
          if (pending?.kind !== "edit") return;
          const { payment } = pending;
          const res = await m.run((key) => commercialApi.payments.update(payment.id, payment.version, body, key));
          if (res.ok) finish(`Saved ${payment.transaction_ref}.`);
        }}
      />

      <RefundModal
        payment={pending?.kind === "refund" ? pending.payment : null}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        onSubmit={async (body) => {
          if (pending?.kind !== "refund") return;
          const { payment } = pending;
          const res = await m.run((key) => commercialApi.payments.refund(payment.id, payment.version, body, key));
          if (res.ok) finish(`Recorded refund on ${payment.transaction_ref}.`);
        }}
      />

      <CommercialFormModal
        isOpen={pending?.kind === "retry" || pending?.kind === "delete"}
        title={target ? `${pending?.kind === "retry" ? "Retry" : "Delete"} ${target.transaction_ref}?` : ""}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        submitLabel={pending?.kind === "retry" ? "Retry Payment" : "Delete Payment"}
        submitVariant={pending?.kind === "delete" ? "danger" : "primary"}
        onSubmit={async () => {
          if (!target || (pending?.kind !== "retry" && pending?.kind !== "delete")) return;
          const kind = pending.kind;
          const res = await m.run<unknown>((key) =>
            kind === "retry"
              ? commercialApi.payments.retry(target.id, target.version, key)
              : commercialApi.payments.remove(target.id, target.version, key),
          );
          if (res.ok) finish(kind === "retry" ? `Retried ${target.transaction_ref}.` : `Deleted ${target.transaction_ref}.`);
        }}
      >
        <p className="text-xs text-[var(--color-text-secondary)]">
          {pending?.kind === "retry"
            ? "Marks the failed payment record as settled on the server. No gateway is charged while billing is dormant."
            : "The payment record is permanently removed from the server."}
        </p>
      </CommercialFormModal>
    </>
  );
}
