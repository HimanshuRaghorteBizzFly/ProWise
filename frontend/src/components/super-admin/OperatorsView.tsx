"use client";

import React, { useEffect, useState } from "react";
import { Edit3, Mail, PhoneCall, Plus, RefreshCw, ShieldCheck, Trash2, UserCheck, UserCog, UserX } from "lucide-react";
import type { AdminOperator, AdminOperatorPermissions } from "@/types/admin";
import type {
  CreateOperatorBody,
  OperatorAccessLevel,
  OperatorDepartment,
  OperatorRoleOption,
  UpdateOperatorBody,
} from "@/types/admin-commercial";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  SlideOverDrawer,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import {
  AdminTable,
  ResourceStatus,
  cellClass,
  formatInstant,
  humanize,
  mutedCellClass,
  type ResourceState,
} from "./admin-resource";
import {
  Checkbox,
  CommercialFormModal,
  EMAIL_PATTERN,
  fieldError,
  optionalText,
  type FieldErrors,
  type MutationFailure,
} from "./commercial/mutation";
import { selectClass, tdClass, thClass, theadClass } from "./commercial/shared";
import { usePagedRows } from "./use-paged-rows";

export const OPERATOR_STATUSES = ["ACTIVE", "INVITED", "INACTIVE", "SUSPENDED"];

export type OperatorAction = "activate" | "suspend" | "resend-invite" | "revoke-sessions";

/** Actions the backend offers for an operator in this status. */
export function operatorActions(op: AdminOperator): OperatorAction[] {
  const actions: OperatorAction[] = [];
  if (op.status === "INVITED") actions.push("resend-invite");
  if (op.status === "ACTIVE") actions.push("suspend");
  if (op.status === "SUSPENDED" || op.status === "INACTIVE") actions.push("activate");
  if (op.active_sessions_count > 0) actions.push("revoke-sessions");
  return actions;
}

export const OPERATOR_ACTION_LABELS: Record<OperatorAction, string> = {
  activate: "Activate",
  suspend: "Suspend",
  "resend-invite": "Resend temporary password",
  "revoke-sessions": "Sign out all sessions",
};

export interface OperatorsViewProps {
  state: ResourceState<AdminOperator[]>;
  search: string;
  status: string;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onRetry: () => void;
  selected: AdminOperator | null;
  permissions: ResourceState<AdminOperatorPermissions> | null;
  onOpen: (op: AdminOperator) => void;
  onClose: () => void;
  onRetryPermissions: () => void;
  onAction: (op: AdminOperator, action: OperatorAction) => void;
  busy: boolean;
  /** Departments from the server, for names and the department filter. */
  departments?: OperatorDepartment[];
  department?: string;
  onDepartmentChange?: (v: string) => void;
  onCreate?: () => void;
  onEdit?: (op: AdminOperator) => void;
  onDelete?: (op: AdminOperator) => void;
}

function departmentName(id: string | null, departments?: OperatorDepartment[]): string {
  if (!id) return "-";
  return departments?.find((d) => d.id === id)?.name ?? humanize(id);
}

export function OperatorsView(props: OperatorsViewProps) {
  const {
    state,
    search,
    status,
    onSearchChange,
    onStatusChange,
    onRetry,
    selected,
    permissions,
    onOpen,
    onClose,
    departments,
    department = "ALL",
    onDepartmentChange,
    onCreate,
    onEdit,
    onDelete,
  } = props;
  const rows = state.status === "ready" ? state.data : [];
  const ready = state.status === "ready";
  const filtered = search.trim() !== "" || status !== "ALL" || department !== "ALL";
  const count = (pred: (op: AdminOperator) => boolean) => (ready ? rows.filter(pred).length : "-");
  const { pageRows, barProps } = usePagedRows(rows);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform Operators"
        description="Operator accounts, their department access and sessions. New operators get an email with a temporary password and stay Invited until they sign in and choose their own password."
        badge={ready ? `${rows.length} shown` : undefined}
        actions={
          <>
            <AdminButton variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </AdminButton>
            {onCreate && (
              <AdminButton variant="primary" size="sm" onClick={onCreate}>
                <Plus className="w-3.5 h-3.5" />
                Invite Operator
              </AdminButton>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Active" value={count((o) => o.status === "ACTIVE")} sublabel="In the loaded list" icon={UserCheck} tone="emerald" />
        <KpiCard label="Invited" value={count((o) => o.status === "INVITED")} sublabel="Not signed in yet" icon={Mail} tone="amber" />
        <KpiCard label="Suspended / inactive" value={count((o) => o.status === "SUSPENDED" || o.status === "INACTIVE")} icon={UserX} tone="rose" />
        <KpiCard label="On call" value={count((o) => o.on_call)} icon={PhoneCall} tone="blue" />
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder="Name or email"
            hasActiveFilters={filtered}
            onResetFilters={() => {
              onSearchChange("");
              onStatusChange("ALL");
              onDepartmentChange?.("ALL");
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Filter operator status" className={selectClass} value={status} onChange={(e) => onStatusChange(e.target.value)}>
                  <option value="ALL">All statuses</option>
                  {OPERATOR_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </select>
                {onDepartmentChange && (
                  <select aria-label="Filter department" className={selectClass} value={department} onChange={(e) => onDepartmentChange(e.target.value)}>
                    <option value="ALL">All departments</option>
                    {(departments ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            }
          />
        </div>

        <ResourceStatus
          state={state}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={UserCog}
          emptyTitle={filtered ? "No operators match" : "No platform operators yet"}
          emptyDescription={filtered ? "Change the search or filters." : "Invited operators will appear here."}
        />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Platform operators">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Operator</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Department</th>
                  <th className={thClass}>Access level</th>
                  <th className={thClass}>Shift</th>
                  <th className={thClass}>Sessions</th>
                  <th className={thClass}>Last active</th>
                  {(onEdit || onDelete) && <th className={`${thClass} text-right`}>Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {pageRows.map((op) => (
                  <tr key={op.id} className="hover:bg-[var(--color-hover)]">
                    <td className={tdClass}>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                          {getOrgInitials(op.name)}
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onOpen(op)}
                            className="text-left font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                          >
                            {op.name}
                          </button>
                          <div className="text-[11px] text-[var(--color-text-muted)]">{op.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className={tdClass}>
                      <StatusBadge label={humanize(op.status)} tone={getStatusTone(op.status)} dot />
                      {op.on_call && <div className="mt-1 text-[10px] font-semibold text-blue-600 dark:text-blue-300">On call</div>}
                    </td>
                    <td className={`${tdClass} text-[var(--color-text-secondary)]`}>{departmentName(op.department, departments)}</td>
                    <td className={`${tdClass} text-[var(--color-text-secondary)] whitespace-nowrap`}>{humanize(op.access_level)}</td>
                    <td className={`${tdClass} text-[var(--color-text-secondary)]`}>{op.shift_name || "-"}</td>
                    <td className={`${tdClass} text-[var(--color-text-secondary)]`}>{op.active_sessions_count}</td>
                    <td className={`${tdClass} text-[var(--color-text-secondary)] whitespace-nowrap`}>{formatInstant(op.last_active_at)}</td>
                    {(onEdit || onDelete) && (
                      <td className={`${tdClass} text-right`}>
                        <div className="inline-flex items-center justify-end gap-1">
                          <AdminButton variant="ghost" size="xs" title="Permissions and actions" aria-label={`Open ${op.name}`} onClick={() => onOpen(op)}>
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </AdminButton>
                          {onEdit && (
                            <AdminButton variant="ghost" size="xs" title="Edit operator" aria-label={`Edit ${op.name}`} onClick={() => onEdit(op)}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </AdminButton>
                          )}
                          {onDelete && (
                            <AdminButton
                              variant="ghost"
                              size="xs"
                              className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                              title="Delete operator"
                              aria-label={`Delete ${op.name}`}
                              onClick={() => onDelete(op)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </AdminButton>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && <PaginationBar {...barProps} />}
      </SurfaceCard>

      <SlideOverDrawer isOpen={selected !== null} onClose={onClose} title={selected?.name ?? "Operator"} subtitle={selected?.email}>
        {selected && <OperatorDetail {...props} op={selected} permissions={permissions} />}
      </SlideOverDrawer>
    </div>
  );
}

function OperatorDetail({
  op,
  permissions,
  onRetryPermissions,
  onAction,
  busy,
  departments,
  onEdit,
}: OperatorsViewProps & { op: AdminOperator }) {
  const actions = operatorActions(op);
  const fields: [string, React.ReactNode][] = [
    ["Status", <StatusBadge key="s" label={humanize(op.status)} tone={getStatusTone(op.status)} dot />],
    ["Department", departmentName(op.department, departments)],
    ["Access level", humanize(op.access_level)],
    ["Role", op.role_id || "-"],
    ["Shift", op.shift_name || "-"],
    ["On call", op.on_call ? "Yes" : "No"],
    ["MFA", op.mfa_enabled ? "Required" : "Off"],
    ["Active sessions", String(op.active_sessions_count)],
    ["Last active", formatInstant(op.last_active_at)],
    ["Created", formatInstant(op.created_at)],
  ];
  return (
    <div className="space-y-5 text-xs">
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2">
        {fields.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-[var(--color-text-muted)]">{label}</dt>
            <dd className="text-[var(--color-text-primary)]">{value}</dd>
          </React.Fragment>
        ))}
      </dl>

      {(actions.length > 0 || onEdit) && (
        <div className="flex flex-wrap gap-2">
          {onEdit && (
            <AdminButton size="sm" variant="outline" disabled={busy} onClick={() => onEdit(op)}>
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </AdminButton>
          )}
          {actions.map((a) => (
            <AdminButton
              key={a}
              size="sm"
              variant={a === "suspend" || a === "revoke-sessions" ? "danger" : "outline"}
              disabled={busy}
              onClick={() => onAction(op, a)}
            >
              {OPERATOR_ACTION_LABELS[a]}
            </AdminButton>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Effective permissions</h4>
        {permissions && (
          <ResourceStatus
            state={permissions}
            isEmpty={(d) => (d.permissions ?? []).length === 0}
            onRetry={onRetryPermissions}
            emptyIcon={UserCog}
            emptyTitle="No permissions"
            emptyDescription="This operator has no department or individual permissions."
          />
        )}
        {permissions?.status === "ready" && (permissions.data.permissions ?? []).length > 0 && (
          <>
            <p className="text-[var(--color-text-secondary)]">
              {permissions.data.total_allowed_count} allowed, {permissions.data.total_denied_count} denied,{" "}
              {permissions.data.total_grants_count} individual grants.
            </p>
            <AdminTable label="Effective permissions" headers={["Module", "Action", "Source", "Allowed"]}>
              {permissions.data.permissions.map((p) => (
                <tr key={`${p.module_key}:${p.action}`}>
                  <td className={`${cellClass} font-mono text-[11px]`}>{p.module_key}</td>
                  <td className={mutedCellClass}>{p.action}</td>
                  <td className={mutedCellClass}>{humanize(p.state)}</td>
                  <td className={cellClass}>
                    <StatusBadge label={p.effective_allowed ? "Allowed" : "Denied"} tone={p.effective_allowed ? "success" : "danger"} />
                  </td>
                </tr>
              ))}
            </AdminTable>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- invite / edit */

/** Assigning this role through operator management is refused by the server (ROLE_NOT_ASSIGNABLE). */
export const NON_ASSIGNABLE_OPERATOR_ROLE = "role-super-admin";
export const ACCESS_LEVELS: OperatorAccessLevel[] = ["DEPARTMENT_OPERATOR", "MAIN_PLATFORM_OPERATOR"];

interface OperatorFormValues {
  name: string;
  email: string;
  role_id: string;
  access_level: OperatorAccessLevel;
  department: string;
  mfa_enabled: boolean;
  on_call: boolean;
  shift_name: string;
}

function operatorFormValues(op: AdminOperator | null): OperatorFormValues {
  return {
    name: op?.name ?? "",
    email: op?.email ?? "",
    role_id: op?.role_id ?? "role-platform-operator",
    access_level: (op?.access_level as OperatorAccessLevel) ?? "DEPARTMENT_OPERATOR",
    department: op?.department ?? "",
    mfa_enabled: op ? op.mfa_enabled : true,
    on_call: op ? op.on_call : false,
    shift_name: op?.shift_name ?? "",
  };
}

/** Mirrors OperatorService: valid email; a department operator needs one of the existing departments. */
export function validateOperatorForm(v: OperatorFormValues): FieldErrors {
  const e: FieldErrors = {};
  if (!v.name.trim()) e.name = "Name is required.";
  if (!v.email.trim()) e.email = "Email is required.";
  else if (!EMAIL_PATTERN.test(v.email.trim())) e.email = "Enter a valid email address.";
  if (v.access_level === "DEPARTMENT_OPERATOR" && !v.department) e.department = "A department operator needs a department.";
  if (v.role_id === NON_ASSIGNABLE_OPERATOR_ROLE) e.role_id = "This role cannot be assigned here.";
  return e;
}

export function OperatorFormModal({
  isOpen,
  operator,
  departments,
  roles,
  busy,
  failure,
  onReload,
  onClose,
  onCreate,
  onUpdate,
}: {
  isOpen: boolean;
  operator: AdminOperator | null;
  departments: OperatorDepartment[];
  roles: OperatorRoleOption[];
  busy: boolean;
  failure: MutationFailure | null;
  onReload: () => void;
  onClose: () => void;
  onCreate: (body: CreateOperatorBody) => void;
  onUpdate: (body: UpdateOperatorBody) => void;
}) {
  const [v, setV] = useState(() => operatorFormValues(operator));
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    if (isOpen) {
      setV(operatorFormValues(operator));
      setErrors({});
    }
  }, [isOpen, operator]);
  const set = <K extends keyof OperatorFormValues>(k: K, value: OperatorFormValues[K]) => setV((p) => ({ ...p, [k]: value }));
  const err = (f: string) => fieldError(failure, errors, f);
  const isCreate = operator === null;
  const roleOptions = roles.filter((r) => r.id !== NON_ASSIGNABLE_OPERATOR_ROLE || r.id === operator?.role_id);

  return (
    <CommercialFormModal
      isOpen={isOpen}
      title={isCreate ? "Invite Operator" : `Edit ${operator.name}`}
      description={
        isCreate
          ? "The operator is created as Invited and receives an email with their sign-in email, a single-use temporary password (valid 72 hours) and the sign-in link. They choose their own password at first sign-in."
          : "Changing the department or access level signs the operator out of every session."
      }
      maxWidth="lg"
      busy={busy}
      failure={failure}
      onReload={onReload}
      onClose={onClose}
      submitLabel={isCreate ? "Send Invitation" : "Save Operator"}
      onSubmit={() => {
        const found = validateOperatorForm(v);
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        const body = {
          name: v.name.trim(),
          email: v.email.trim(),
          role_id: v.role_id || null,
          access_level: v.access_level,
          department: v.department || null,
          mfa_enabled: v.mfa_enabled,
          on_call: v.on_call,
          shift_name: optionalText(v.shift_name),
        };
        if (isCreate) onCreate(body);
        else onUpdate(body);
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AdminInput label="Name *" value={v.name} onChange={(e) => set("name", e.target.value)} error={err("name")} />
        <AdminInput label="Email *" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} error={err("email")} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AdminSelect
          label="Access level"
          value={v.access_level}
          onChange={(e) => set("access_level", e.target.value as OperatorAccessLevel)}
          options={ACCESS_LEVELS.map((a) => ({ label: humanize(a), value: a }))}
          error={err("access_level")}
        />
        <AdminSelect
          label={v.access_level === "DEPARTMENT_OPERATOR" ? "Department *" : "Department"}
          value={v.department}
          onChange={(e) => set("department", e.target.value)}
          options={[{ label: "No department", value: "" }, ...departments.map((d) => ({ label: d.name, value: d.id }))]}
          error={err("department")}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AdminSelect
          label="Role"
          value={v.role_id}
          onChange={(e) => set("role_id", e.target.value)}
          options={roleOptions.map((r) => ({ label: r.name, value: r.id }))}
          error={err("role_id")}
        />
        <AdminInput label="Shift" value={v.shift_name} onChange={(e) => set("shift_name", e.target.value)} placeholder="e.g. EMEA Primary (08:00 - 17:00)" error={err("shift_name")} />
      </div>
      <div className="flex flex-wrap gap-4">
        <Checkbox label="Require MFA" checked={v.mfa_enabled} onChange={(c) => set("mfa_enabled", c)} />
        <Checkbox label="On call" checked={v.on_call} onChange={(c) => set("on_call", c)} />
      </div>
    </CommercialFormModal>
  );
}
