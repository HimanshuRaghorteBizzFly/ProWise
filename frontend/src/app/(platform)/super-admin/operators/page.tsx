"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { commercialApi } from "@/lib/admin-api/commercial";
import type { AdminOperator } from "@/types/admin";
import type { CommercialOperator } from "@/types/admin-commercial";
import { useAdminDetail, useAdminResource, useDebounced } from "@/components/super-admin/admin-resource";
import { CommercialFormModal, useMutation } from "@/components/super-admin/commercial/mutation";
import {
  OPERATOR_ACTION_LABELS,
  OperatorFormModal,
  OperatorsView,
  type OperatorAction,
} from "@/components/super-admin/OperatorsView";

const CONFIRM_TEXT: Record<OperatorAction, string> = {
  activate: "The operator can sign in again with their existing password.",
  suspend: "The operator is signed out everywhere and cannot sign in until reactivated.",
  "resend-invite": "A new welcome email with a new temporary password is sent; the earlier temporary password stops working.",
  "revoke-sessions": "Every open session of this operator is signed out.",
};

type Pending =
  | { kind: "create" }
  | { kind: "edit" | "delete"; op: CommercialOperator }
  | { kind: "action"; action: OperatorAction; op: CommercialOperator };

export default function SuperAdminOperatorsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const query = { search: useDebounced(search), status, department };
  const list = useAdminResource(() => commercialApi.operators.list(query), JSON.stringify(query));
  const departments = useAdminResource(() => commercialApi.operators.departments(), "operator-departments");
  const roles = useAdminResource(() => commercialApi.operators.roles(), "operator-roles");
  const permissions = useAdminDetail((id) => commercialApi.operators.permissions(id));
  const [selectedSnapshot, setSelectedSnapshot] = useState<AdminOperator | null>(null);
  const selectedId = selectedSnapshot?.id ?? null;
  const [pending, setPending] = useState<Pending | null>(null);
  const m = useMutation();

  const rows = list.state.status === "ready" ? list.state.data : [];
  const deptList = departments.state.status === "ready" ? departments.state.data : [];
  const roleList = roles.state.status === "ready" ? roles.state.data : [];
  /** Latest list row for the open operator; the snapshot keeps the drawer open while the list reloads. */
  const selected = selectedId ? rows.find((o) => o.id === selectedId) ?? selectedSnapshot : null;
  /** The list row carries the version; the view hands back the operator it rendered. */
  const record = (op: AdminOperator): CommercialOperator | undefined => rows.find((o) => o.id === op.id);

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
    if (selectedId) permissions.retry();
  };

  const confirmAction = pending?.kind === "action" ? pending : null;

  return (
    <>
      <OperatorsView
        state={list.state}
        search={search}
        status={status}
        department={department}
        departments={deptList}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onDepartmentChange={setDepartment}
        onRetry={() => {
          void list.reload();
          void departments.reload();
          void roles.reload();
        }}
        selected={selected}
        permissions={permissions.state}
        onOpen={(op) => {
          setSelectedSnapshot(op);
          permissions.open(op.id);
        }}
        onClose={() => {
          setSelectedSnapshot(null);
          permissions.close();
        }}
        onRetryPermissions={permissions.retry}
        onAction={(op, action) => {
          const rec = record(op);
          if (rec) open({ kind: "action", action, op: rec });
        }}
        onCreate={() => open({ kind: "create" })}
        onEdit={(op) => {
          const rec = record(op);
          if (rec) open({ kind: "edit", op: rec });
        }}
        onDelete={(op) => {
          const rec = record(op);
          if (rec) open({ kind: "delete", op: rec });
        }}
        busy={m.busy}
      />

      <OperatorFormModal
        isOpen={pending?.kind === "create" || pending?.kind === "edit"}
        operator={pending?.kind === "edit" ? pending.op : null}
        departments={deptList}
        roles={roleList}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        onCreate={async (body) => {
          const res = await m.run((key) => commercialApi.operators.create(body, key));
          if (res.ok) finish(`Invited ${res.value.email}.`);
        }}
        onUpdate={async (body) => {
          if (pending?.kind !== "edit") return;
          const { op } = pending;
          const res = await m.run((key) => commercialApi.operators.update(op.id, op.version, body, key));
          if (res.ok) finish(`Saved ${res.value.email}.`);
        }}
      />

      <CommercialFormModal
        isOpen={confirmAction !== null}
        title={confirmAction ? `${OPERATOR_ACTION_LABELS[confirmAction.action]}?` : ""}
        description={confirmAction ? `${confirmAction.op.name} (${confirmAction.op.email})` : undefined}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        submitLabel={confirmAction ? OPERATOR_ACTION_LABELS[confirmAction.action] : "Confirm"}
        submitVariant={confirmAction && (confirmAction.action === "suspend" || confirmAction.action === "revoke-sessions") ? "danger" : "primary"}
        onSubmit={async () => {
          if (!confirmAction) return;
          const { op, action } = confirmAction;
          const res = await m.run<unknown>((key) => {
            if (action === "activate") return commercialApi.operators.setStatus(op.id, op.version, "ACTIVE", key);
            if (action === "suspend") return commercialApi.operators.setStatus(op.id, op.version, "SUSPENDED", key);
            if (action === "resend-invite") return commercialApi.operators.resendInvite(op.id, key);
            return commercialApi.operators.revokeSessions(op.id, key);
          });
          if (res.ok) finish(`${OPERATOR_ACTION_LABELS[action]}: done for ${op.email}.`);
        }}
      >
        <p className="text-xs text-[var(--color-text-secondary)]">{confirmAction ? CONFIRM_TEXT[confirmAction.action] : ""}</p>
      </CommercialFormModal>

      <CommercialFormModal
        isOpen={pending?.kind === "delete"}
        title={pending?.kind === "delete" ? `Delete ${pending.op.name}?` : ""}
        busy={m.busy}
        failure={m.failure}
        onReload={reloadAfterStale}
        onClose={close}
        submitLabel="Delete Operator"
        submitVariant="danger"
        onSubmit={async () => {
          if (pending?.kind !== "delete") return;
          const { op } = pending;
          const res = await m.run((key) => commercialApi.operators.remove(op.id, op.version, key));
          if (res.ok) {
            if (selectedId === op.id) {
              setSelectedSnapshot(null);
              permissions.close();
            }
            toast.success(`Deleted ${op.email}.`);
            close();
            void list.reload();
          }
        }}
      >
        <p className="text-xs text-[var(--color-text-secondary)]">
          The operator account is permanently removed and every session ends. The last active Super Admin cannot be deleted.
        </p>
      </CommercialFormModal>
    </>
  );
}
