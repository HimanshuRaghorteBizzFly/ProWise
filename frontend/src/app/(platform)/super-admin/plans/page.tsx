"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { commercialApi } from "@/lib/admin-api/commercial";
import type { CommercialPlan } from "@/types/admin-commercial";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { CommercialFormModal, useMutation } from "@/components/super-admin/commercial/mutation";
import { PlanFormModal, PlansView, planUpdateBody, type BillingView } from "@/components/super-admin/commercial/PlansView";

type Pending =
  | { kind: "form"; plan: CommercialPlan | null }
  | { kind: "archive"; plan: CommercialPlan }
  | { kind: "delete"; plan: CommercialPlan };

export default function SuperAdminPlansPage() {
  const list = useAdminResource(() => commercialApi.plans.list(), "plans");
  const subscriptions = useAdminResource(() => commercialApi.subscriptions.list(), "plan-subscriptions");
  const [billingView, setBillingView] = useState<BillingView>("MONTHLY");
  const [showArchived, setShowArchived] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const m = useMutation();

  const open = (p: Pending) => {
    m.begin();
    setPending(p);
  };
  const close = () => setPending(null);
  const reloadAfterStale = () => {
    close();
    void list.reload();
  };

  const finish = (message: string) => {
    toast.success(message);
    close();
    void list.reload();
  };

  return (
    <>
      <PlansView
        state={list.state}
        subscriptions={subscriptions.state}
        billingView={billingView}
        showArchived={showArchived}
        onBillingViewChange={setBillingView}
        onToggleArchived={() => setShowArchived((v) => !v)}
        onRetry={() => {
          void list.reload();
          void subscriptions.reload();
        }}
        onCreate={() => open({ kind: "form", plan: null })}
        onEdit={(plan) => open({ kind: "form", plan })}
        onArchive={(plan) => open({ kind: "archive", plan })}
        onDelete={(plan) => open({ kind: "delete", plan })}
      />

      <PlanFormModal
        isOpen={pending?.kind === "form"}
        plan={pending?.kind === "form" ? pending.plan : null}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        onSubmit={async (body) => {
          const target = pending?.kind === "form" ? pending.plan : null;
          const res = target
            ? await m.run((key) => commercialApi.plans.update(target.id, target.version, planUpdateBody(body), key))
            : await m.run((key) => commercialApi.plans.create(body, key));
          if (res.ok) finish(target ? `Saved plan "${res.value.name}".` : `Created plan "${res.value.name}".`);
        }}
      />

      <CommercialFormModal
        isOpen={pending?.kind === "archive"}
        title={pending?.kind === "archive" ? `${pending.plan.status === "ARCHIVED" ? "Restore" : "Archive"} ${pending.plan.name}?` : ""}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        submitLabel={pending?.kind === "archive" && pending.plan.status === "ARCHIVED" ? "Restore Plan" : "Archive Plan"}
        onSubmit={async () => {
          if (pending?.kind !== "archive") return;
          const { plan } = pending;
          const res = await m.run((key) => commercialApi.plans.toggleArchive(plan.id, plan.version, key));
          if (res.ok) finish(res.value.status === "ARCHIVED" ? `Archived "${plan.name}".` : `Restored "${plan.name}".`);
        }}
      >
        <p className="text-xs text-[var(--color-text-secondary)]">
          {pending?.kind === "archive" && pending.plan.status === "ARCHIVED"
            ? "The plan becomes active again and can be assigned to organizations."
            : "Archived plans stay stored with their subscriptions but are hidden from the default view."}
        </p>
      </CommercialFormModal>

      <CommercialFormModal
        isOpen={pending?.kind === "delete"}
        title={pending?.kind === "delete" ? `Delete ${pending.plan.name}?` : ""}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        submitLabel="Delete Plan"
        submitVariant="danger"
        onSubmit={async () => {
          if (pending?.kind !== "delete") return;
          const { plan } = pending;
          const res = await m.run((key) => commercialApi.plans.remove(plan.id, plan.version, key));
          if (res.ok) finish(`Deleted plan "${plan.name}".`);
        }}
      >
        <p className="text-xs text-[var(--color-text-secondary)]">
          The plan record is permanently removed from the server. Archive it instead to keep its history.
        </p>
      </CommercialFormModal>
    </>
  );
}
