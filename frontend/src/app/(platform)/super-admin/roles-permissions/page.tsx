"use client";

import React, { useCallback, useState } from "react";
import { toast } from "sonner";
import { commercialApi } from "@/lib/admin-api/commercial";
import type { GovernanceRole } from "@/types/admin-roles";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { CommercialFormModal, useMutation } from "@/components/super-admin/commercial/mutation";
import { RolesGovernanceView } from "@/components/super-admin/roles/RolesGovernanceView";
import {
  AuditLogModal,
  CloneRoleModal,
  CompareModal,
  CreateRoleModal,
  RoleEditorModal,
  RolePreviewDrawer,
} from "@/components/super-admin/roles/RoleDialogs";
import { resyncItems, type RoleMenuAction } from "@/components/super-admin/roles/role-model";

type Pending =
  | { kind: "create" }
  | { kind: "edit"; role: GovernanceRole; section: "details" | "permissions" }
  | { kind: "clone"; role: GovernanceRole }
  | { kind: "toggle-active" | "delete" | "reset-baseline"; role: GovernanceRole }
  | { kind: "resync" };

const api = commercialApi.roles;

export default function SuperAdminRolesPermissionsPage() {
  const roles = useAdminResource(() => api.list(), "admin-roles");
  const catalog = useAdminResource(() => api.permissions(), "admin-permissions");
  const [pending, setPending] = useState<Pending | null>(null);
  const [preview, setPreview] = useState<GovernanceRole | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const m = useMutation();
  const all = roles.state.status === "ready" ? roles.state.data : [];
  const cat = catalog.state.status === "ready" ? catalog.state.data : null;

  const open = (p: Pending) => {
    m.begin();
    setPending(p);
  };
  const close = () => setPending(null);
  const reload = () => {
    close();
    void roles.reload();
  };
  const finish = (message: string) => {
    toast.success(message);
    close();
    setPreview(null);
    void roles.reload();
  };

  const onMenu = (role: GovernanceRole, action: RoleMenuAction) => {
    if (action === "edit-details") open({ kind: "edit", role, section: "details" });
    else open({ kind: action, role });
  };

  const holderSearch = useCallback((q: string) => api.holderSearch(q), []);
  const loadHolders = useCallback((id: string) => api.holders(id), []);
  const loadHistory = useCallback((id: string) => api.history(id), []);
  const loadAudit = useCallback(() => api.auditLog(), []);
  const compare = useCallback((ids: string[]) => api.compare(ids), []);

  const confirm =
    pending && (pending.kind === "toggle-active" || pending.kind === "delete" || pending.kind === "reset-baseline")
      ? pending
      : null;

  return (
    <>
      <RolesGovernanceView
        roles={roles.state}
        catalog={catalog.state}
        onRetry={() => {
          void roles.reload();
          void catalog.reload();
        }}
        onCreate={() => open({ kind: "create" })}
        onCompare={() => setCompareOpen(true)}
        onAuditLog={() => setAuditOpen(true)}
        onResync={() => open({ kind: "resync" })}
        onPreview={setPreview}
        onEdit={(role, section) => open({ kind: "edit", role, section })}
        onMenu={onMenu}
        holderSearch={holderSearch}
        loadHolders={loadHolders}
      />

      <CreateRoleModal
        isOpen={pending?.kind === "create"}
        catalog={cat}
        roles={all}
        busy={m.busy}
        failure={m.failure}
        onClose={close}
        onSubmit={async (body) => {
          const res = await m.run((key) => api.create(body, key));
          if (res.ok) finish(`Created role "${res.value.name}".`);
        }}
      />

      <RoleEditorModal
        role={pending?.kind === "edit" ? pending.role : null}
        section={pending?.kind === "edit" ? pending.section : "details"}
        catalog={cat}
        roles={all}
        busy={m.busy}
        failure={m.failure}
        onReload={reload}
        onClose={close}
        onSave={async (details, permissions) => {
          if (pending?.kind !== "edit") return;
          const role = pending.role;
          if (!details && !permissions) {
            close();
            return;
          }
          const res = await m.run(async (key) => {
            let version = role.version;
            let saved = role;
            if (details) {
              saved = await api.update(role.id, version, details, key);
              version = saved.version;
            }
            if (permissions) saved = await api.updatePermissions(role.id, version, permissions, key);
            return saved;
          });
          if (res.ok) finish(`Saved role "${res.value.name}".`);
        }}
      />

      <CloneRoleModal
        role={pending?.kind === "clone" ? pending.role : null}
        busy={m.busy}
        failure={m.failure}
        onClose={close}
        onSubmit={async (body) => {
          if (pending?.kind !== "clone") return;
          const source = pending.role;
          const res = await m.run((key) => api.clone(source.id, body, key));
          if (res.ok) finish(`Cloned "${source.name}" as "${res.value.name}".`);
        }}
      />

      <CommercialFormModal
        isOpen={confirm !== null}
        title={
          confirm
            ? confirm.kind === "delete"
              ? `Delete ${confirm.role.name}?`
              : confirm.kind === "reset-baseline"
                ? `Reset ${confirm.role.name} to baseline?`
                : `${confirm.role.is_active ? "Deactivate" : "Activate"} ${confirm.role.name}?`
            : ""
        }
        busy={m.busy}
        failure={m.failure}
        onReload={reload}
        onClose={close}
        submitLabel={
          confirm?.kind === "delete" ? "Delete Role" : confirm?.kind === "reset-baseline" ? "Reset" : confirm?.role.is_active ? "Deactivate" : "Activate"
        }
        submitVariant={confirm?.kind === "delete" || (confirm?.kind === "toggle-active" && confirm.role.is_active) ? "danger" : "primary"}
        onSubmit={async () => {
          if (!confirm) return;
          const { role, kind } = confirm;
          const res = await m.run<unknown>((key) =>
            kind === "delete"
              ? api.remove(role.id, role.version, key)
              : kind === "reset-baseline"
                ? api.resetBaseline(role.id, role.version, key)
                : api.toggleActive(role.id, role.version, key),
          );
          if (res.ok) {
            finish(
              kind === "delete"
                ? `Deleted role "${role.name}".`
                : kind === "reset-baseline"
                  ? `Reset "${role.name}" to its baseline.`
                  : `${role.is_active ? "Deactivated" : "Activated"} "${role.name}".`,
            );
          }
        }}
      >
        <p className="text-xs text-[var(--color-text-secondary)]">
          {confirm?.kind === "delete" &&
            "The custom role and its role template are removed. Roles still granted or used in invitations cannot be deleted; deactivate them instead."}
          {confirm?.kind === "reset-baseline" &&
            `Its capabilities go back to the version-controlled baseline. ${confirm.role.scope === "ORGANIZATION" ? `This applies immediately to the ${confirm.role.user_count} member(s) holding it in every organization.` : ""}`}
          {confirm?.kind === "toggle-active" &&
            (confirm.role.is_active
              ? "Inactive roles are hidden from organizations, cannot be granted, and existing grants of it give no permissions until it is activated again."
              : "The role becomes grantable again and existing grants give its capabilities again.")}
        </p>
      </CommercialFormModal>

      <CommercialFormModal
        isOpen={pending?.kind === "resync"}
        title="Re-sync System Roles?"
        busy={m.busy}
        failure={m.failure}
        onReload={reload}
        onClose={close}
        submitLabel="Re-sync"
        submitVariant="danger"
        onSubmit={async () => {
          const res = await m.run((key) => api.resyncSystem(resyncItems(all), key));
          if (res.ok) {
            finish(
              res.value.changed.length === 0
                ? "All system roles already matched the baseline."
                : `Restored ${res.value.changed.length} system role(s) to the baseline.`,
            );
          }
        }}
      >
        <p className="text-xs text-[var(--color-text-secondary)]">
          Every system role&apos;s capabilities go back to the version-controlled baseline. Organization roles change for every member holding them
          in every tenant; the Platform Operator returns to the set derived from operator departments. Names, colors and icons are kept.
          Custom roles are not touched. Each change is written to the audit log.
        </p>
      </CommercialFormModal>

      <RolePreviewDrawer role={preview} catalog={cat} loadHolders={loadHolders} loadHistory={loadHistory} onClose={() => setPreview(null)} />
      <CompareModal isOpen={compareOpen} roles={all} onClose={() => setCompareOpen(false)} compare={compare} />
      <AuditLogModal isOpen={auditOpen} onClose={() => setAuditOpen(false)} load={loadAudit} />
    </>
  );
}
