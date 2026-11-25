"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { commercialApi } from "@/lib/admin-api/commercial";
import type { CommercialSubscription } from "@/types/admin-commercial";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { Checkbox, CommercialFormModal, useMutation } from "@/components/super-admin/commercial/mutation";
import { buildLookups } from "@/components/super-admin/commercial/shared";
import {
  SubscriptionFormModal,
  SubscriptionsView,
  type SubscriptionAction,
} from "@/components/super-admin/commercial/SubscriptionsView";

type Pending =
  | { kind: "assign" }
  | { kind: "edit"; sub: CommercialSubscription }
  | { kind: "renew" | "cancel" | "reactivate" | "delete"; sub: CommercialSubscription };

const CONFIRM: Record<"renew" | "cancel" | "reactivate" | "delete", { title: string; text: string; label: string; danger?: boolean }> = {
  renew: { title: "Renew subscription?", text: "Starts a new billing period now on the stored plan and cycle.", label: "Renew" },
  cancel: { title: "Cancel subscription?", text: "By default it ends at the end of the current period.", label: "Cancel Subscription", danger: true },
  reactivate: { title: "Reactivate subscription?", text: "The subscription becomes active again with auto-renew on.", label: "Reactivate" },
  delete: { title: "Delete subscription?", text: "The subscription record is permanently removed from the server.", label: "Delete", danger: true },
};

export default function SuperAdminSubscriptionsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [planId, setPlanId] = useState("ALL");
  const [cycle, setCycle] = useState("ALL");
  const query = { status, planId };
  const list = useAdminResource(() => commercialApi.subscriptions.list(query), JSON.stringify(query));
  const orgs = useAdminResource(() => commercialApi.organizations.list(), "sub-orgs");
  const plans = useAdminResource(() => commercialApi.plans.list(), "sub-plans");
  const lookups = useMemo(() => buildLookups(orgs.state, plans.state), [orgs.state, plans.state]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [immediate, setImmediate] = useState(false);
  const m = useMutation();

  const open = (p: Pending) => {
    m.begin();
    setImmediate(false);
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
  const confirmKind = pending && pending.kind !== "assign" && pending.kind !== "edit" ? pending.kind : null;
  const confirmSub = pending && pending.kind !== "assign" ? pending.sub : null;

  return (
    <>
      <SubscriptionsView
        state={list.state}
        lookups={lookups}
        search={search}
        status={status}
        planId={planId}
        cycle={cycle}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onPlanChange={setPlanId}
        onCycleChange={setCycle}
        onRetry={() => {
          void list.reload();
          void orgs.reload();
          void plans.reload();
        }}
        onAssign={() => open({ kind: "assign" })}
        onAction={(sub, action: SubscriptionAction) => open({ kind: action, sub } as Pending)}
      />

      <SubscriptionFormModal
        isOpen={pending?.kind === "assign" || pending?.kind === "edit"}
        subscription={pending?.kind === "edit" ? pending.sub : null}
        lookups={lookups}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        onAssign={async (body) => {
          const res = await m.run((key) => commercialApi.subscriptions.assign(body, key));
          if (res.ok) finish(`Assigned subscription to ${lookups.orgName(res.value.org_id)}.`);
        }}
        onUpdate={async (body) => {
          if (pending?.kind !== "edit") return;
          const { sub } = pending;
          const res = await m.run((key) => commercialApi.subscriptions.update(sub.id, sub.version, body, key));
          if (res.ok) finish(`Saved subscription ${sub.id}.`);
        }}
      />

      <CommercialFormModal
        isOpen={confirmKind !== null}
        title={confirmKind ? CONFIRM[confirmKind].title : ""}
        description={confirmSub ? `${lookups.orgName(confirmSub.org_id)} (${confirmSub.id})` : undefined}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        submitLabel={confirmKind ? CONFIRM[confirmKind].label : "Confirm"}
        submitVariant={confirmKind && CONFIRM[confirmKind].danger ? "danger" : "primary"}
        onSubmit={async () => {
          if (!confirmKind || !confirmSub) return;
          const { id, version } = confirmSub;
          const res = await m.run<unknown>((key) => {
            if (confirmKind === "renew") return commercialApi.subscriptions.renew(id, version, key);
            if (confirmKind === "cancel") return commercialApi.subscriptions.cancel(id, version, immediate, key);
            if (confirmKind === "reactivate") return commercialApi.subscriptions.reactivate(id, version, key);
            return commercialApi.subscriptions.remove(id, version, key);
          });
          if (res.ok) finish(`${CONFIRM[confirmKind].label}: done for ${lookups.orgName(confirmSub.org_id)}.`);
        }}
      >
        <p className="text-xs text-[var(--color-text-secondary)]">{confirmKind ? CONFIRM[confirmKind].text : ""}</p>
        {confirmKind === "cancel" && (
          <Checkbox label="Cancel immediately instead of at period end" checked={immediate} onChange={setImmediate} />
        )}
      </CommercialFormModal>
    </>
  );
}
