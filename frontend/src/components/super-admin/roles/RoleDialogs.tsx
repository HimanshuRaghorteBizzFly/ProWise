"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Lock, Minus, Plus } from "lucide-react";
import type {
  CapabilityCatalog,
  CapabilityModule,
  CloneRoleBody,
  CompareResult,
  CreateRoleBody,
  GovernanceRole,
  RoleHistoryEntry,
  RoleHolder,
  RoleScope,
  UpdateRoleBody,
} from "@/types/admin-roles";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  ErrorBanner,
  PaginationBar,
  SlideOverDrawer,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { errorMessage, formatInstant, type ResourceState } from "../admin-resource";
import { CommercialFormModal, MutationErrorNotice, fieldError, type MutationFailure } from "../commercial/mutation";
import { usePagedRows } from "../use-paged-rows";
import {
  ROLE_COLORS,
  ROLE_ICONS,
  TIERS,
  enforcementLabel,
  filterModules,
  keysOwnersCannotGrant,
  modulesForScope,
  permissionDiff,
  permissionsLockReason,
  roleDetailsSchema,
  slugify,
  tiersForScope,
  toggleKey,
  toggleModule,
  validateRoleDetails,
  type RoleDetailsValues,
} from "./role-model";
import { HolderList } from "./RolesGovernanceView";
import { RoleIcon, roleTone } from "./role-visuals";

/* ---------------------------------------------------------------- permission matrix */

export function PermissionMatrix({
  modules,
  selected,
  original,
  onChange,
  lockedReason,
}: {
  modules: CapabilityModule[];
  selected: string[];
  original: string[];
  onChange: (next: string[]) => void;
  lockedReason?: string | null;
}) {
  const [search, setSearch] = useState("");
  const visible = filterModules(modules, search);
  const chosen = new Set(selected);
  const diff = permissionDiff(original, selected);
  const locked = Boolean(lockedReason);
  return (
    <div className="space-y-3">
      {lockedReason && (
        <p role="note" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {lockedReason}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search capabilities..."
          aria-label="Search capabilities"
          className="h-8 w-full sm:w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 text-xs text-[var(--color-text-primary)]"
        />
        <div className="flex items-center gap-2 text-[11px]" aria-live="polite">
          <span className="font-semibold text-[var(--color-text-primary)]">{selected.length} selected</span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
            <Plus className="w-3 h-3" />
            {diff.added.length} added
          </span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-700 dark:text-rose-300">
            <Minus className="w-3 h-3" />
            {diff.removed.length} removed
          </span>
        </div>
      </div>
      <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
        {visible.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No capability matches.</p>}
        {visible.map((m) => {
          const keys = m.capabilities.map((c) => c.key);
          const count = keys.filter((k) => chosen.has(k)).length;
          const all = count === keys.length;
          return (
            <fieldset key={m.id} className="rounded-lg border border-[var(--color-border)] p-2.5">
              <legend className="sr-only">{m.name}</legend>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={all}
                    disabled={locked}
                    ref={(el) => {
                      if (el) el.indeterminate = count > 0 && !all;
                    }}
                    onChange={() => onChange(toggleModule(selected, m))}
                    aria-label={`Select all in ${m.name}`}
                    className="h-4 w-4 accent-blue-600"
                  />
                  {m.name}
                </label>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {count}/{keys.length}
                </span>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                {m.capabilities.map((c) => {
                  const on = chosen.has(c.key);
                  const changed = on !== original.includes(c.key);
                  return (
                    <label
                      key={c.key}
                      title={c.description}
                      className={`flex items-start gap-2 rounded-md px-1.5 py-1 text-[11px] ${changed ? (on ? "bg-emerald-500/10" : "bg-rose-500/10") : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={locked}
                        onChange={() => onChange(toggleKey(selected, c.key))}
                        className="mt-0.5 h-3.5 w-3.5 accent-blue-600"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-[var(--color-text-primary)]">
                          {c.label}
                          {c.risk === "HIGH" && <span className="ml-1 text-[9px] font-bold text-rose-600">HIGH</span>}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-[var(--color-text-muted)]">{c.key}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function OwnerGrantWarning({ roles, keys, scope }: { roles: GovernanceRole[]; keys: string[]; scope: RoleScope }) {
  const missing = keysOwnersCannotGrant(roles, keys, scope);
  if (missing.length === 0) return null;
  return (
    <p role="note" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-800 dark:text-amber-200">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      Organization Owners do not hold {missing.join(", ")}. Members can only grant a role whose capabilities they hold,
      so owners and admins will not be able to grant this role until the Owner role has them too.
    </p>
  );
}

/* ---------------------------------------------------------------- details fields (react-hook-form + zod) */

function useRoleDetailsForm(defaults: RoleDetailsValues) {
  return useForm<RoleDetailsValues>({ resolver: zodResolver(roleDetailsSchema), defaultValues: defaults, mode: "onSubmit" });
}

type DetailsForm = ReturnType<typeof useRoleDetailsForm>;

function DetailsFields({
  form,
  failure,
  mode,
  role,
  roles,
}: {
  form: DetailsForm;
  failure: MutationFailure | null;
  mode: "create" | "edit";
  role?: GovernanceRole | null;
  roles: GovernanceRole[];
}) {
  const { register, watch, setValue, formState } = form;
  const errors = Object.fromEntries(
    Object.entries(formState.errors).map(([k, v]) => [k, String((v as { message?: string })?.message ?? "Invalid value")]),
  );
  const scope = watch("scope");
  const color = watch("color");
  const icon = watch("icon");
  const isSystem = Boolean(role?.is_system);
  const err = (f: string) => fieldError(failure, errors, f);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <AdminInput
        label="Display name"
        {...register("name", {
          onChange: (e) => {
            if (mode === "create" && !form.getFieldState("slug").isDirty) setValue("slug", slugify(e.target.value));
          },
        })}
        error={err("name")}
      />
      <AdminInput
        label="Slug"
        {...register("slug")}
        disabled={mode === "edit"}
        error={err("slug")}
        placeholder="derived from the name"
      />
      <AdminInput label="Subtitle (authority title)" {...register("subtitle")} error={err("subtitle")} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <AdminTextarea label="Description" rows={3} {...register("description")} error={err("description")} />
      </div>
      <AdminSelect label="Scope" {...register("scope")} disabled={mode === "edit"} error={err("scope")}>
        <option value="ORGANIZATION">Organization (tenant & project)</option>
        <option value="PLATFORM">Platform (definition only)</option>
      </AdminSelect>
      <AdminSelect
        label="Tier"
        {...register("tier", { valueAsNumber: true })}
        disabled={isSystem}
        error={err("tier")}
      >
        {TIERS.filter((t) => isSystem || tiersForScope(scope).includes(t.tier)).map((t) => (
          <option key={t.tier} value={t.tier}>
            {t.tier === 6 ? "Custom Roles" : `Tier ${t.tier}: ${t.title}`}
          </option>
        ))}
      </AdminSelect>
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">Color</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Color">
          {ROLE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setValue("color", c, { shouldDirty: true })}
              className={`h-6 w-6 rounded-full ${roleTone(c).swatch} ${color === c ? "ring-2 ring-offset-2 ring-blue-600" : ""}`}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">Icon</p>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Icon">
          {ROLE_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={icon === i}
              aria-label={i}
              onClick={() => setValue("icon", i, { shouldDirty: true })}
              className={`flex h-7 w-7 items-center justify-center rounded-md border ${icon === i ? "border-blue-600 bg-blue-500/10 text-blue-600" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}
            >
              <RoleIcon name={i} className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </div>
      {mode === "create" && (
        <div className="sm:col-span-2">
          <AdminSelect label="Base it on an existing role (copies its capabilities)" {...register("base_role_id")}>
            <option value="">Start empty</option>
            {roles
              .filter((r) => r.kind !== "SUPER_ADMIN" && r.scope === scope)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.rank_label} {r.name}
                </option>
              ))}
          </AdminSelect>
          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Super Admin authority can never be copied into another role.</p>
        </div>
      )}
    </div>
  );
}

function detailsDefaults(role?: GovernanceRole | null): RoleDetailsValues {
  return {
    name: role?.name ?? "",
    slug: role?.slug ?? "",
    subtitle: role?.subtitle ?? "",
    description: role?.description ?? "",
    scope: role?.scope ?? "ORGANIZATION",
    tier: role?.tier ?? 6,
    color: role?.color ?? "blue",
    icon: role?.icon ?? "Shield",
    base_role_id: "",
  };
}

/** Changed detail fields only (null when nothing changed). */
export function detailsChanges(role: GovernanceRole, v: RoleDetailsValues): UpdateRoleBody | null {
  const body: UpdateRoleBody = {};
  if (v.name.trim() !== role.name) body.name = v.name.trim();
  if (v.subtitle.trim() !== (role.subtitle ?? "")) body.subtitle = v.subtitle.trim();
  if (v.description.trim() !== (role.description ?? "")) body.description = v.description.trim();
  if (v.color !== role.color) body.color = v.color;
  if (v.icon !== role.icon) body.icon = v.icon;
  if (!role.is_system && Number(v.tier) !== role.tier) body.tier = Number(v.tier);
  return Object.keys(body).length === 0 ? null : body;
}

/* ---------------------------------------------------------------- editor (details + permissions) */

export function RoleEditorModal({
  role,
  section,
  catalog,
  roles,
  busy,
  failure,
  onReload,
  onClose,
  onSave,
}: {
  role: GovernanceRole | null;
  section: "details" | "permissions";
  catalog: CapabilityCatalog | null;
  roles: GovernanceRole[];
  busy: boolean;
  failure: MutationFailure | null;
  onReload: () => void;
  onClose: () => void;
  onSave: (details: UpdateRoleBody | null, permissions: string[] | null) => void;
}) {
  const [tab, setTab] = useState(section);
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const form = useRoleDetailsForm(detailsDefaults(role));
  useEffect(() => {
    setTab(section);
    setSelected(role?.permissions ?? []);
    form.reset(detailsDefaults(role));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role?.id, role?.version, section]);
  if (!role) return null;
  const lock = permissionsLockReason(role);
  const modules = catalog ? modulesForScope(catalog, role.scope, role.kind === "SUPER_ADMIN") : [];
  const diff = permissionDiff(role.permissions, selected);
  const submit = form.handleSubmit((values) => {
    const extra = validateRoleDetails(values);
    if (extra.tier && !role.is_system) {
      form.setError("tier", { message: extra.tier });
      return;
    }
    const permsChanged = !lock && (diff.added.length > 0 || diff.removed.length > 0);
    onSave(detailsChanges(role, values), permsChanged ? selected : null);
  });
  return (
    <AdminModal isOpen onClose={() => !busy && onClose()} title={`Edit ${role.name}`} description={role.enforcement_note} maxWidth="4xl">
      <form noValidate onSubmit={submit} className="space-y-4">
        <MutationErrorNotice failure={failure} onReload={onReload} />
        <div role="tablist" className="flex gap-1 border-b border-[var(--color-border)]">
          {(["details", "permissions"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`border-b-2 px-3 py-2 text-xs font-semibold ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-[var(--color-text-secondary)]"}`}
            >
              {t === "details" ? "Details" : `Permissions (${selected.length})`}
            </button>
          ))}
        </div>
        <div hidden={tab !== "details"}>
          {role.is_system && (
            <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">
              System role: the slug ({role.slug}), tier and rank {role.rank_label} stay fixed. {role.kind === "SUPER_ADMIN" ? "It cannot be deactivated or deleted." : ""}
            </p>
          )}
          <DetailsFields form={form} failure={failure} mode="edit" role={role} roles={roles} />
        </div>
        <div hidden={tab !== "permissions"} className="space-y-3">
          {!catalog && <p className="text-xs text-[var(--color-text-muted)]">Loading the capability catalog...</p>}
          {catalog && (
            <PermissionMatrix modules={modules} selected={selected} original={role.permissions} onChange={setSelected} lockedReason={lock} />
          )}
          <OwnerGrantWarning roles={roles} keys={selected} scope={role.scope} />
          {fieldError(failure, {}, "permissions") && <p className="text-xs text-rose-600">{fieldError(failure, {}, "permissions")}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
          <AdminButton type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" size="sm" isLoading={busy} disabled={busy || failure?.kind === "stale"}>
            Save changes
          </AdminButton>
        </div>
      </form>
    </AdminModal>
  );
}

/* ---------------------------------------------------------------- create */

export function CreateRoleModal({
  isOpen,
  catalog,
  roles,
  busy,
  failure,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  catalog: CapabilityCatalog | null;
  roles: GovernanceRole[];
  busy: boolean;
  failure: MutationFailure | null;
  onClose: () => void;
  onSubmit: (body: CreateRoleBody) => void;
}) {
  const form = useRoleDetailsForm(detailsDefaults(null));
  const [selected, setSelected] = useState<string[]>([]);
  const [permError, setPermError] = useState<string | null>(null);
  const scope = form.watch("scope");
  const base = form.watch("base_role_id");
  useEffect(() => {
    if (isOpen) {
      form.reset(detailsDefaults(null));
      setSelected([]);
      setPermError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  useEffect(() => {
    const source = roles.find((r) => r.id === base);
    if (source) setSelected([...source.permissions]);
  }, [base, roles]);
  useEffect(() => {
    // A different scope holds different capabilities.
    setSelected([]);
    form.setValue("base_role_id", "");
    const tier = Number(form.getValues("tier"));
    if (!tiersForScope(scope).includes(tier)) form.setValue("tier", 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  const modules = catalog ? modulesForScope(catalog, scope) : [];
  const submit = form.handleSubmit((values) => {
    const extra = validateRoleDetails(values);
    if (extra.tier) {
      form.setError("tier", { message: extra.tier });
      return;
    }
    if (selected.length === 0) {
      setPermError("Choose at least one capability.");
      return;
    }
    setPermError(null);
    onSubmit({
      name: values.name.trim(),
      slug: values.slug.trim() || null,
      subtitle: values.subtitle.trim() || null,
      description: values.description.trim() || null,
      scope: values.scope,
      tier: Number(values.tier),
      color: values.color,
      icon: values.icon,
      permissions: selected,
    });
  });
  return (
    <AdminModal isOpen={isOpen} onClose={() => !busy && onClose()} title="Create Custom Role" maxWidth="4xl"
      description="Organization roles become a role template every organization can grant (admins can only grant roles whose capabilities they hold). Platform roles are definitions only: operator access stays with operator departments.">
      <form noValidate onSubmit={submit} className="space-y-4">
        <MutationErrorNotice failure={failure} />
        <DetailsFields form={form} failure={failure} mode="create" roles={roles} />
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">Capabilities</h4>
          {catalog ? (
            <PermissionMatrix modules={modules} selected={selected} original={[]} onChange={setSelected} />
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">Loading the capability catalog...</p>
          )}
          <OwnerGrantWarning roles={roles} keys={selected} scope={scope} />
          {(permError || fieldError(failure, {}, "permissions")) && (
            <p className="text-xs text-rose-600">{permError || fieldError(failure, {}, "permissions")}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
          <AdminButton type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" size="sm" isLoading={busy} disabled={busy}>
            Create Role
          </AdminButton>
        </div>
      </form>
    </AdminModal>
  );
}

/* ---------------------------------------------------------------- clone */

export function CloneRoleModal({
  role,
  busy,
  failure,
  onClose,
  onSubmit,
}: {
  role: GovernanceRole | null;
  busy: boolean;
  failure: MutationFailure | null;
  onClose: () => void;
  onSubmit: (body: CloneRoleBody) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (role) {
      setName(`${role.name} Copy`);
      setError(null);
    }
  }, [role]);
  return (
    <CommercialFormModal
      isOpen={role !== null}
      title={role ? `Clone ${role.name}` : ""}
      description="Creates a new custom role with the same capabilities, scope and tier. The source is not changed."
      busy={busy}
      failure={failure}
      onClose={onClose}
      submitLabel="Clone Role"
      onSubmit={() => {
        if (name.trim().length < 3) {
          setError("Name must be 3 to 100 characters.");
          return;
        }
        onSubmit({ new_name: name.trim(), new_slug: slugify(name) });
      }}
    >
      <AdminInput label="New role name" value={name} onChange={(e) => setName(e.target.value)} error={error ?? fieldError(failure, {}, "name") ?? fieldError(failure, {}, "slug")} />
      <p className="text-[11px] text-[var(--color-text-muted)]">Slug: {slugify(name) || "-"}</p>
    </CommercialFormModal>
  );
}

/* ---------------------------------------------------------------- preview drawer */

export function RolePreviewDrawer({
  role,
  catalog,
  loadHolders,
  loadHistory,
  onClose,
}: {
  role: GovernanceRole | null;
  catalog: CapabilityCatalog | null;
  loadHolders: (id: string) => Promise<RoleHolder[]>;
  loadHistory: (id: string) => Promise<RoleHistoryEntry[]>;
  onClose: () => void;
}) {
  const held = new Set(role?.permissions ?? []);
  const modules = (catalog?.modules ?? [])
    .map((m) => ({ ...m, capabilities: m.capabilities.filter((c) => held.has(c.key)) }))
    .filter((m) => m.capabilities.length > 0);
  return (
    <SlideOverDrawer isOpen={role !== null} onClose={onClose} title={role ? `${role.rank_label} ${role.name}` : ""} subtitle={role ? enforcementLabel(role) : undefined}>
      {role && (
        <div className="space-y-5">
          <p className="text-xs text-[var(--color-text-secondary)]">{role.description}</p>
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)]/50 p-2.5 text-[11px] text-[var(--color-text-secondary)]">
            {role.enforcement_note}
          </p>
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">What this role can see and do ({role.capability_count})</h4>
            {modules.map((m) => (
              <div key={m.id} className="rounded-lg border border-[var(--color-border)] p-2.5">
                <p className="text-[11px] font-semibold text-[var(--color-text-primary)]">{m.name}</p>
                <ul className="mt-1 space-y-1">
                  {m.capabilities.map((c) => (
                    <li key={c.key} className="text-[11px] text-[var(--color-text-secondary)]">
                      <span className="font-medium text-[var(--color-text-primary)]">{c.label}</span> - {c.description}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
          <HolderList role={role} loadHolders={loadHolders} />
          <HistoryList title="Change history" load={() => loadHistory(role.id)} reloadKey={`${role.id}:${role.version}`} />
        </div>
      )}
    </SlideOverDrawer>
  );
}

export function HistoryList({ title, load, reloadKey }: { title: string; load: () => Promise<RoleHistoryEntry[]>; reloadKey: string }) {
  const [state, setState] = useState<ResourceState<RoleHistoryEntry[]>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    load()
      .then((data) => alive && setState({ status: "ready", data }))
      .catch((e) => alive && setState({ status: "error", message: errorMessage(e) }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, attempt]);
  const rows = state.status === "ready" ? state.data : [];
  const { pageRows, barProps } = usePagedRows(rows, 10);
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">{title}</h4>
      {state.status === "loading" && <p role="status" className="text-[11px] text-[var(--color-text-muted)]">Loading history...</p>}
      {state.status === "error" && <ErrorBanner message={state.message} onRetry={() => setAttempt((n) => n + 1)} />}
      {state.status === "ready" && rows.length === 0 && <p className="text-[11px] text-[var(--color-text-muted)]">No role or permission change recorded yet.</p>}
      {rows.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)]">
          <ul className="divide-y divide-[var(--color-border)]">
            {pageRows.map((h) => (
              <li key={h.id} className="px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">{h.action.replace(/_/g, " ")}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{formatInstant(h.timestamp)}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)] break-words">{h.summary}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">by {h.actor_email}{h.target_label ? ` · ${h.target_label}` : ""}</p>
              </li>
            ))}
          </ul>
          <PaginationBar {...barProps} />
        </div>
      )}
    </section>
  );
}

export function AuditLogModal({ isOpen, onClose, load }: { isOpen: boolean; onClose: () => void; load: () => Promise<RoleHistoryEntry[]> }) {
  return (
    <AdminModal isOpen={isOpen} onClose={onClose} title="Roles & Permissions Audit Log" description="Every role and permission change, newest first (admin audit rows)." maxWidth="2xl">
      {isOpen && <HistoryList title="Changes" load={load} reloadKey="audit" />}
    </AdminModal>
  );
}

/* ---------------------------------------------------------------- compare */

export function CompareModal({
  isOpen,
  roles,
  onClose,
  compare,
}: {
  isOpen: boolean;
  roles: GovernanceRole[];
  onClose: () => void;
  compare: (ids: string[]) => Promise<CompareResult>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [result, setResult] = useState<ResourceState<CompareResult> | null>(null);
  const [onlyDiff, setOnlyDiff] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setPicked([]);
      setResult(null);
    }
  }, [isOpen]);
  const picker = usePagedRows(roles, 10);
  const rows = useMemo(
    () => (result?.status === "ready" ? result.data.rows.filter((r) => !onlyDiff || r.differs) : []),
    [result, onlyDiff],
  );
  const matrix = usePagedRows(rows, 20);
  const run = async () => {
    setResult({ status: "loading" });
    try {
      setResult({ status: "ready", data: await compare(picked) });
    } catch (e) {
      setResult({ status: "error", message: errorMessage(e) });
    }
  };
  return (
    <AdminModal isOpen={isOpen} onClose={onClose} title="Compare Roles" description="Pick two or three roles to see their capabilities side by side." maxWidth="5xl">
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--color-border)]">
          <ul className="divide-y divide-[var(--color-border)]">
            {picker.pageRows.map((r) => {
              const on = picked.includes(r.id);
              return (
                <li key={r.id} className="px-3 py-1.5">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && picked.length >= 3}
                      onChange={() => setPicked((p) => (on ? p.filter((x) => x !== r.id) : [...p, r.id]))}
                      className="h-3.5 w-3.5 accent-blue-600"
                    />
                    <span className="font-semibold text-[var(--color-text-primary)]">{r.rank_label} {r.name}</span>
                    <span className="text-[var(--color-text-muted)]">{r.capability_count} capabilities</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <PaginationBar {...picker.barProps} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="h-3.5 w-3.5 accent-blue-600" />
            Show differences only
          </label>
          <AdminButton size="sm" onClick={run} disabled={picked.length < 2}>
            Compare {picked.length > 0 ? `(${picked.length})` : ""}
          </AdminButton>
        </div>
        {result?.status === "loading" && <p role="status" className="text-xs text-[var(--color-text-muted)]">Comparing...</p>}
        {result?.status === "error" && <ErrorBanner message={result.message} onRetry={run} />}
        {result?.status === "ready" && (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-left text-xs" aria-label="Capability comparison">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-elevated)] text-[11px] text-[var(--color-text-secondary)]">
                  <th className="px-3 py-2">Capability</th>
                  {result.data.roles.map((r) => (
                    <th key={r.id} className="px-3 py-2 text-center">{r.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {matrix.pageRows.map((row) => (
                  <tr key={row.key} className={row.differs ? "bg-amber-500/10" : ""}>
                    <td className="px-3 py-1.5">
                      <span className="font-medium text-[var(--color-text-primary)]">{row.label}</span>
                      <span className="block text-[10px] text-[var(--color-text-muted)]">{row.module_name}</span>
                    </td>
                    {row.held.map((h, i) => (
                      <td key={i} className={`px-3 py-1.5 text-center font-bold ${h ? "text-emerald-600" : "text-rose-500"}`}>
                        {h ? "Yes" : "No"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="p-3 text-center text-xs text-[var(--color-text-muted)]">No differences.</p>}
            <PaginationBar {...matrix.barProps} />
          </div>
        )}
      </div>
    </AdminModal>
  );
}
