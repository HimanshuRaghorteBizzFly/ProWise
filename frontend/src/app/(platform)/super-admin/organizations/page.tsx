"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { commercialApi } from "@/lib/admin-api/commercial";
import { downloadCsv, generateCsv } from "@/lib/csv";
import type { CommercialOrganization } from "@/types/admin-commercial";
import { AdminTextarea } from "../_components/SuperAdminPrimitives";
import { useAdminDetail, useAdminResource, useDebounced } from "@/components/super-admin/admin-resource";
import { CommercialFormModal, fieldError, useMutation } from "@/components/super-admin/commercial/mutation";
import {
  OrganizationFormModal,
  OrganizationsView,
  type OrganizationAction,
} from "@/components/super-admin/OrganizationsView";

type Pending =
  | { kind: "create" }
  | { kind: Exclude<OrganizationAction, "view">; org: CommercialOrganization }
  | { kind: "bulk-suspend"; orgs: CommercialOrganization[] };

export default function SuperAdminOrganizationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [planId, setPlanId] = useState("ALL");
  const query = { search: useDebounced(search), status, planId };
  const list = useAdminResource(() => commercialApi.organizations.list(query), JSON.stringify(query));
  const summary = useAdminResource(() => commercialApi.organizations.summary(), "org-summary");
  const plans = useAdminResource(() => commercialApi.plans.list(), "org-plans");
  const detail = useAdminDetail((id) => commercialApi.organizations.get(id));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const m = useMutation();

  const rows = list.state.status === "ready" ? list.state.data : [];
  const planList = plans.state.status === "ready" ? plans.state.data : [];

  const open = (p: Pending) => {
    m.begin();
    setReason("");
    setReasonError(undefined);
    setPending(p);
  };
  const close = () => setPending(null);
  const reloadAll = (refreshDetail = true) => {
    void list.reload();
    void summary.reload();
    if (refreshDetail && detail.openId) detail.retry();
  };
  const reloadAfterStale = () => {
    close();
    reloadAll();
  };
  const finish = (message: string, refreshDetail = true) => {
    toast.success(message);
    close();
    reloadAll(refreshDetail);
  };
  /** The freshest copy we hold: the open detail when it is this record, else the list row. */
  const findOrg = (id: string): CommercialOrganization | undefined => {
    if (detail.state?.status === "ready" && detail.state.data.id === id) return detail.state.data;
    return rows.find((o) => o.id === id);
  };

  const exportCsv = () => {
    downloadCsv(
      "prowise-organizations.csv",
      generateCsv(
        ["Name", "Slug", "Status", "Owner", "Owner email", "Plan", "Seats used", "Seat limit", "Projects", "Created"],
        rows.map((o) => [
          o.name,
          o.slug,
          o.status,
          o.owner_name,
          o.owner_email,
          planList.find((p) => p.id === o.plan_id)?.name ?? o.plan_id,
          o.seats_used,
          o.seats_limit,
          o.projects_count,
          o.created_at,
        ]),
      ),
    );
  };

  const formOrg = pending?.kind === "edit" ? pending.org : null;
  const reasonKind = pending?.kind === "suspend" || pending?.kind === "bulk-suspend";

  return (
    <>
      <OrganizationsView
        state={list.state}
        summary={summary.state}
        search={search}
        status={status}
        planId={planId}
        plans={planList}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onPlanChange={setPlanId}
        onRetry={() => {
          reloadAll();
          void plans.reload();
        }}
        onOpen={detail.open}
        detail={detail.state}
        onCloseDetail={detail.close}
        onRetryDetail={detail.retry}
        onCreate={() => open({ kind: "create" })}
        onExport={exportCsv}
        onAction={(id, action) => {
          const org = findOrg(id);
          if (org) open({ kind: action, org });
        }}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onBulkSuspend={() => {
          const orgs = rows.filter((o) => selectedIds.includes(o.id));
          if (orgs.length > 0) open({ kind: "bulk-suspend", orgs });
        }}
      />

      <OrganizationFormModal
        isOpen={pending?.kind === "create" || pending?.kind === "edit"}
        org={formOrg}
        plans={planList}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        onCreate={async (body) => {
          const res = await m.run((key) => commercialApi.organizations.create(body, key));
          if (res.ok) finish(`Created organization "${res.value.name}".`);
        }}
        onUpdate={async (body) => {
          if (!formOrg) return;
          const res = await m.run((key) => commercialApi.organizations.update(formOrg.id, formOrg.version, body, key));
          if (res.ok) finish(`Saved "${res.value.name}".`);
        }}
      />

      <CommercialFormModal
        isOpen={reasonKind}
        title={
          pending?.kind === "suspend"
            ? `Suspend ${pending.org.name}?`
            : pending?.kind === "bulk-suspend"
              ? `Suspend ${pending.orgs.length} organization${pending.orgs.length === 1 ? "" : "s"}?`
              : ""
        }
        description="Members cannot use a suspended organization until it is reactivated."
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        submitLabel="Suspend"
        submitVariant="danger"
        onSubmit={async () => {
          if (!reason.trim()) {
            setReasonError("A reason is required.");
            return;
          }
          setReasonError(undefined);
          if (pending?.kind === "suspend") {
            const { org } = pending;
            const res = await m.run((key) => commercialApi.organizations.suspend(org.id, org.version, reason.trim(), key));
            if (res.ok) finish(`Suspended "${org.name}".`);
          } else if (pending?.kind === "bulk-suspend") {
            const { orgs } = pending;
            const res = await m.run((key) =>
              commercialApi.organizations.bulkSuspend(
                orgs.map((o) => ({ id: o.id, version: o.version })),
                reason.trim(),
                key,
              ),
            );
            if (res.ok) {
              setSelectedIds([]);
              finish(`Suspended ${orgs.length} organization${orgs.length === 1 ? "" : "s"}.`);
            }
          }
        }}
      >
        {pending?.kind === "bulk-suspend" && (
          <p className="text-xs text-[var(--color-text-secondary)]">
            {pending.orgs.map((o) => o.name).join(", ")}. If any of them changed since the list was loaded, none is suspended.
          </p>
        )}
        <AdminTextarea
          label="Reason *"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={reasonError ?? fieldError(m.failure, {}, "reason")}
        />
      </CommercialFormModal>

      <CommercialFormModal
        isOpen={pending?.kind === "reactivate" || pending?.kind === "delete"}
        title={
          pending?.kind === "reactivate"
            ? `Reactivate ${pending.org.name}?`
            : pending?.kind === "delete"
              ? `Delete ${pending.org.name}?`
              : ""
        }
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        submitLabel={pending?.kind === "delete" ? "Delete Organization" : "Reactivate"}
        submitVariant={pending?.kind === "delete" ? "danger" : "primary"}
        onSubmit={async () => {
          if (pending?.kind !== "reactivate" && pending?.kind !== "delete") return;
          const { org, kind } = pending;
          const res = await m.run<unknown>((key) =>
            kind === "reactivate"
              ? commercialApi.organizations.reactivate(org.id, org.version, key)
              : commercialApi.organizations.remove(org.id, org.version, key),
          );
          if (res.ok) {
            if (kind === "delete" && detail.openId === org.id) detail.close();
            setSelectedIds((ids) => ids.filter((id) => id !== org.id));
            finish(kind === "delete" ? `Deleted "${org.name}".` : `Reactivated "${org.name}".`, kind !== "delete");
          }
        }}
      >
        <p className="text-xs text-[var(--color-text-secondary)]">
          {pending?.kind === "delete"
            ? "The organization is permanently removed. This cannot be undone."
            : "Members can use the organization again."}
        </p>
      </CommercialFormModal>
    </>
  );
}
