"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  Crown,
  FilePlus2,
  KeyRound,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  ShieldHalf,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionKey } from "@/types/permission";
import type { MemberDto, RoleDto } from "@/types/api";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  ButtonLink,
  EmptyStateView,
  ErrorBanner,
  PageFrame,
  PageSkeleton,
  Panel,
  StatPill,
  StatusBadge,
  SurfaceCard,
  formatDateTime,
} from "@/components/delivery/DeliveryUI";
import { AccessDeniedState, AccessLostState, SessionExpiredState } from "./AccessStates";
import { StaleVersionBanner } from "./StaleVersionBanner";
import { isStaleVersion, type ApiError } from "@/lib/api";
import { useOrgHref } from "./OrgUI";
import type { OrgFamily } from "./role-rules";
import { KEY_GROUPS, KEY_LABEL, MATRIX_DENIED_KEYS, roleDisplayName, roleTier } from "./permission-key-catalog";
import {
  apiErrorMessage,
  useMemberGrants,
  useMembers,
  useOrgId,
  useRole,
  useRoleHolders,
  useReloadRoleData,
  useRoleMutations,
  useRoles,
  type LoadState,
} from "./useRoleApi";

export const FAMILY_LABEL: Record<OrgFamily, string> = { owner: "Owner", admin: "Admin" };

/* ======================================================================
 * Shared pieces
 * ==================================================================== */

/** Renders the non-ready states of an API load in a consistent way. */
export function LoadGate<T>({
  state,
  family,
  children,
  permission = "role.manage",
  what = "Roles",
}: {
  state: LoadState<T>;
  family: OrgFamily;
  children: (data: T, sample: boolean) => React.ReactNode;
  permission?: string;
  what?: string;
}) {
  const href = useOrgHref(family);
  if (state.kind === "loading") return <PageSkeleton variant="list" />;
  if (state.kind === "forbidden") return <AccessDeniedState permission={permission} backHref={href()} />;
  if (state.kind === "access-lost") return <AccessLostState />;
  if (state.kind === "unauthenticated") return <SessionExpiredState />;
  if (state.kind === "error") return <ErrorBanner message={`${what} could not be loaded.`} onRetry={state.retry} />;
  return <>{children(state.data, state.sample)}</>;
}

function SampleNotice({ sample }: { sample: boolean }) {
  if (!sample) return null;
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200">
      <b>Sample data.</b> The API is not reachable in this development build, so changes cannot be saved.
    </div>
  );
}

/** Your own effective ORG keys decide what you can switch on (never a role-name map). */
function useActorKeys() {
  const { can } = usePermissions();
  return useMemo(() => ({ holds: (key: string) => can(key as PermissionKey) }), [can]);
}

function templateLock(role: RoleDto): string | undefined {
  if (role.owner_only) return "Owner only · read-only";
  if (role.template) return "Built-in template · matches the permission matrix";
  return undefined;
}

function KeyToggle({
  info,
  checked,
  changed,
  lockReason,
  onToggle,
}: {
  info: { key: string; label: string; description: string };
  checked: boolean;
  changed: boolean;
  lockReason?: string;
  onToggle: () => void;
}) {
  const tipId = useId();
  const locked = Boolean(lockReason);
  return (
    <div
      className={cn(
        "group/toggle relative flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 transition-all duration-200",
        locked
          ? "border-dashed border-[var(--color-border)] bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--color-elevated)_6px,var(--color-elevated)_12px)]"
          : changed
            ? "border-blue-500/60 bg-blue-500/10 shadow-sm"
            : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-500/30",
      )}
    >
      <div className="min-w-0">
        <p className={cn("flex flex-wrap items-center gap-1.5 text-xs font-semibold", locked && "text-[var(--color-text-secondary)]")}>
          {locked && <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" aria-hidden />}
          {info.label}
          <code className="text-[10px] font-normal text-[var(--color-text-muted)]">{info.key}</code>
          {changed && !locked && (
            <span className="rounded-full bg-blue-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">
              {checked ? "On" : "Off"} · changed
            </span>
          )}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{info.description}</p>
        {locked && <p className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">{lockReason}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={info.label}
        aria-disabled={locked || undefined}
        aria-describedby={locked ? tipId : undefined}
        onClick={() => {
          if (!locked) onToggle();
        }}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          checked ? (locked ? "bg-slate-400 dark:bg-slate-600" : "bg-[#1A73E8]") : "bg-slate-300 dark:bg-slate-700",
          locked ? "cursor-not-allowed opacity-70" : "cursor-pointer",
        )}
      >
        <span className={cn("absolute top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")}>
          {locked && <Lock className="w-2.5 h-2.5 text-slate-500" aria-hidden />}
        </span>
      </button>
      {locked && (
        <span
          id={tipId}
          role="tooltip"
          className="pointer-events-none absolute right-2 -top-2 z-20 -translate-y-full max-w-[240px] rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-2.5 py-1.5 text-[11px] shadow-xl opacity-0 transition-opacity group-hover/toggle:opacity-100 group-focus-within/toggle:opacity-100"
        >
          {lockReason}
        </span>
      )}
    </div>
  );
}

/** Grouped permission toggles, identical for creating and editing a role. */
export function RoleKeyToggles({
  value,
  baseline,
  onChange,
  lockReason,
}: {
  value: string[];
  baseline: string[];
  onChange: (next: string[]) => void;
  lockReason: (key: string) => string | undefined;
}) {
  const on = new Set(value);
  const base = new Set(baseline);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {KEY_GROUPS.map((group) => {
        const countOn = group.keys.filter((info) => on.has(info.key)).length;
        return (
          <SurfaceCard key={group.title} className="p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{group.title}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{group.description}</p>
              </div>
              <StatusBadge label={`${countOn} of ${group.keys.length} on`} tone={countOn ? "info" : "neutral"} />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {group.keys.map((info) => (
                <KeyToggle
                  key={info.key}
                  info={info}
                  checked={on.has(info.key)}
                  changed={on.has(info.key) !== base.has(info.key)}
                  lockReason={lockReason(info.key)}
                  onToggle={() => onChange(on.has(info.key) ? value.filter((key) => key !== info.key) : [...value, info.key])}
                />
              ))}
            </div>
          </SurfaceCard>
        );
      })}
    </div>
  );
}

function ChangesBar({
  baseline,
  value,
  onDiscard,
  onSave,
  saving,
  error,
  saveLabel = "Save changes",
  disabled,
  alwaysShow,
}: {
  baseline: string[];
  value: string[];
  onDiscard: () => void;
  onSave: () => void;
  saving: boolean;
  error?: string;
  saveLabel?: string;
  disabled?: boolean;
  alwaysShow?: boolean;
}) {
  const added = value.filter((key) => !baseline.includes(key));
  const removed = baseline.filter((key) => !value.includes(key));
  const count = added.length + removed.length;
  if (count === 0 && !error && !alwaysShow) return null;
  return (
    <div className="sticky bottom-3 z-20">
      <div className="rounded-2xl border border-blue-500/40 bg-[var(--color-surface)]/95 backdrop-blur-md shadow-2xl px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold flex items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#1A73E8] px-1.5 text-[11px] font-bold text-white">{count}</span>
            {count === 1 ? "1 change" : `${count} changes`}
          </p>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {added.map((key) => (
              <span key={key} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                <Plus className="w-3 h-3" />
                {KEY_LABEL[key] ?? key}
              </span>
            ))}
            {removed.map((key) => (
              <span key={key} className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-rose-700 dark:text-rose-300">
                <Minus className="w-3 h-3" />
                {KEY_LABEL[key] ?? key}
              </span>
            ))}
          </div>
          {error && <p role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <AdminButton variant="outline" onClick={onDiscard} disabled={saving}>
            <RotateCcw className="w-3.5 h-3.5" /> Discard
          </AdminButton>
          <AdminButton onClick={onSave} isLoading={saving} disabled={disabled || (count === 0 && !alwaysShow)}>
            <Save className="w-3.5 h-3.5" /> {saveLabel}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

function lockFor(role: RoleDto | null, holds: (key: string) => boolean, canManage: boolean) {
  return (key: string): string | undefined => {
    if (role) {
      const lock = templateLock(role);
      if (lock) return lock;
    }
    if (!canManage) return "Needs role.manage";
    if (MATRIX_DENIED_KEYS.includes(key)) return "Denied to every role by the permission matrix";
    if (!holds(key)) return "You don't hold this permission";
    return undefined;
  };
}

/* ======================================================================
 * Roles list (ladder)
 * ==================================================================== */

const TIER_META: Record<0 | 1 | 2, { title: string; icon: React.ElementType; tone: string }> = {
  0: { title: "Organization Owner", icon: Crown, tone: "bg-amber-500/15 text-amber-600" },
  1: { title: "Organization Admin", icon: ShieldHalf, tone: "bg-blue-500/15 text-blue-600" },
  2: { title: "Delivery & custom roles", icon: Users, tone: "bg-violet-500/15 text-violet-600" },
};

export function RolesListView({ family }: { family: OrgFamily }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const state = useRoles(orgId);
  const { can } = usePermissions();
  const canManage = can("role.manage");

  return (
    <PageFrame
      crumbs={[{ label: FAMILY_LABEL[family], href: href() }, { label: "Roles & permissions" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Roles & permissions"
      description="Roles are templates: they grant nothing until a grant gives them to a member, at organization or project scope. Built-in templates match the permission matrix and are read-only; create a custom role to change permissions."
      actions={
        canManage ? (
          <>
            <ButtonLink href={href("roles-permissions/assign")} variant="outline"><UserPlus className="w-3.5 h-3.5" /> Assign role</ButtonLink>
            <ButtonLink href={href("roles-permissions/new")}><FilePlus2 className="w-3.5 h-3.5" /> Create role</ButtonLink>
          </>
        ) : undefined
      }
    >
      <LoadGate state={state} family={family}>
        {(roles, sample) => (
          <>
            <SampleNotice sample={sample} />
            {roles.length === 0 ? (
              <SurfaceCard><EmptyStateView icon={ShieldCheck} title="No roles" description="Roles appear once the workspace is set up." /></SurfaceCard>
            ) : (
              <div className="space-y-2">
                {([0, 1, 2] as const).map((tier, index) => {
                  const tierRoles = roles.filter((role) => roleTier(role) === tier);
                  const meta = TIER_META[tier];
                  return (
                    <React.Fragment key={tier}>
                      {index > 0 && <div className="flex justify-center" aria-hidden><ArrowDown className="w-4 h-4 text-[var(--color-text-muted)]" /></div>}
                      <section aria-label={meta.title} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 sm:p-4 space-y-3">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                          <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", meta.tone)}><meta.icon className="w-3.5 h-3.5" /></span>
                          Tier {tier + 1} · {meta.title}
                        </p>
                        {tierRoles.length === 0 ? (
                          <p className="py-2 text-center text-xs text-[var(--color-text-muted)]">No roles in this tier.</p>
                        ) : (
                          <div className={cn("grid gap-3", tier === 2 ? "grid-cols-1 md:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1")}>
                            {tierRoles.map((role) => {
                              const lock = templateLock(role);
                              return (
                                <Link key={role.id} href={href(`roles-permissions/${role.id}`)} className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                                  <SurfaceCard className="h-full p-4 space-y-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/40">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <p className="text-sm font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">{roleDisplayName(role.name)}</p>
                                      {lock ? (
                                        <span title={lock} className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                                          <Lock className="w-3 h-3" /> {role.owner_only ? "Owner only" : "Template"}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                          <ShieldCheck className="w-3 h-3" /> Custom
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-[var(--color-text-muted)]">
                                      {role.permission_keys.length} permission{role.permission_keys.length === 1 ? "" : "s"} · {role.grant_count} grant{role.grant_count === 1 ? "" : "s"}
                                    </p>
                                  </SurfaceCard>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </>
        )}
      </LoadGate>
    </PageFrame>
  );
}

/* ======================================================================
 * Create custom role
 * ==================================================================== */

export function RoleCreateView({ family }: { family: OrgFamily }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const router = useRouter();
  const state = useRoles(orgId);
  const { createRole } = useRoleMutations(orgId);
  const { holds } = useActorKeys();
  const { can } = usePermissions();
  const [name, setName] = useState("");
  const [basedOn, setBasedOn] = useState("");
  const [keys, setKeys] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const canManage = can("role.manage");
  const lockReason = lockFor(null, holds, canManage);

  return (
    <PageFrame
      crumbs={[{ label: FAMILY_LABEL[family], href: href() }, { label: "Roles & permissions", href: href("roles-permissions") }, { label: "Create role" }]}
      back={{ href: href("roles-permissions"), label: "Back to roles & permissions" }}
      title="Create custom role"
      description="A custom role sits below Organization Admin. You can switch on only permissions you hold yourself."
    >
      <LoadGate state={state} family={family}>
        {(roles, sample) => {
          const pickBase = (id: string) => {
            setBasedOn(id);
            const base = roles.find((role) => role.id === id);
            if (!base) return setNote("");
            const allowed = base.permission_keys.filter((key) => !lockReason(key));
            setKeys(allowed);
            const dropped = base.permission_keys.length - allowed.length;
            setNote(dropped ? `${dropped} of ${roleDisplayName(base.name)}'s permissions were left off because you don't hold them.` : `Started from ${roleDisplayName(base.name)}.`);
          };
          const save = () => {
            if (name.trim().length < 3) return setError("Give the role a name (3 to 100 characters).");
            if (sample) return setError("Sample data: connect the API to save.");
            setError("");
            createRole.mutate(
              { name: name.trim(), permission_keys: keys, expected_version: 0 },
              {
                onSuccess: (role) => {
                  toast.success(`${role.name} created`);
                  router.push(href(`roles-permissions/${role.id}`));
                },
                onError: (failure) => setError(apiErrorMessage(failure)),
              },
            );
          };
          return (
            <>
              <SampleNotice sample={sample} />
              <Panel title="Role details" icon={FilePlus2}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AdminInput label="Role name" placeholder="e.g. Release Coordinator" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} />
                  <AdminSelect
                    label="Based on (optional)"
                    value={basedOn}
                    onChange={(e) => pickBase(e.target.value)}
                    options={[{ label: "Start empty", value: "" }, ...roles.filter((role) => !role.owner_only).map((role) => ({ label: roleDisplayName(role.name), value: role.id }))]}
                  />
                </div>
                {note && <p className="mt-3 text-[11px] text-[var(--color-text-secondary)]">{note}</p>}
              </Panel>
              <RoleKeyToggles value={keys} baseline={[]} onChange={setKeys} lockReason={lockReason} />
              <ChangesBar
                baseline={[]}
                value={keys}
                onDiscard={() => { setKeys([]); setBasedOn(""); setNote(""); }}
                onSave={save}
                saving={createRole.isPending}
                error={error}
                saveLabel="Create role"
                disabled={!canManage}
                alwaysShow
              />
            </>
          );
        }}
      </LoadGate>
    </PageFrame>
  );
}

/* ======================================================================
 * Role detail and edit
 * ==================================================================== */

export function RoleDetailView({ family, roleId }: { family: OrgFamily; roleId: string }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const router = useRouter();
  const state = useRole(orgId, roleId);
  const holders = useRoleHolders(orgId, roleId);
  const { updateRole, deleteRole, revokeGrant } = useRoleMutations(orgId);
  const { holds } = useActorKeys();
  const { can } = usePermissions();
  const canManage = can("role.manage");
  const [draft, setDraft] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState<ApiError | null>(null);
  const [reloading, setReloading] = useState(false);
  const reloadRoleData = useReloadRoleData(orgId);
  const onMutationError = (failure: unknown) => {
    // Task 1.4: a lost race is not a failure message, it is an inline "someone changed this" banner.
    if (isStaleVersion(failure)) {
      setError("");
      setStale(failure as ApiError);
    } else {
      setError(apiErrorMessage(failure));
    }
  };
  const reload = () => {
    setReloading(true);
    void reloadRoleData().finally(() => {
      setReloading(false);
      setStale(null);
    });
  };

  const role = state.kind === "ready" ? state.data : null;
  useEffect(() => {
    setDraft(role ? role.permission_keys : null);
  }, [role]);

  return (
    <PageFrame
      crumbs={[{ label: FAMILY_LABEL[family], href: href() }, { label: "Roles & permissions", href: href("roles-permissions") }, { label: role ? roleDisplayName(role.name) : "Role" }]}
      back={{ href: href("roles-permissions"), label: "Back to roles & permissions" }}
      title={role ? roleDisplayName(role.name) : "Role"}
      description={role ? (role.template ? "Built-in template from the permission matrix." : "Custom role in this workspace.") : undefined}
    >
      <LoadGate state={state} family={family}>
        {(loaded, sample) => {
          const lockReason = lockFor(loaded, holds, canManage);
          const value = draft ?? loaded.permission_keys;
          const save = () => {
            if (sample) return setError("Sample data: connect the API to save.");
            setError("");
            updateRole.mutate(
              { roleId: loaded.id, body: { name: loaded.name, permission_keys: value, expected_version: loaded.version } },
              { onSuccess: () => toast.success(`${loaded.name} updated`), onError: onMutationError },
            );
          };
          const remove = () => {
            if (sample) return setError("Sample data: connect the API to save.");
            deleteRole.mutate(
              { roleId: loaded.id, version: loaded.version },
              {
                onSuccess: () => {
                  toast.success(`${loaded.name} deleted`);
                  router.push(href("roles-permissions"));
                },
                onError: onMutationError,
              },
            );
          };
          const lock = templateLock(loaded);
          return (
            <>
              <SampleNotice sample={sample} />
              {stale && <StaleVersionBanner requestId={stale.requestId} onReload={reload} reloading={reloading} />}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatPill label="Type" value={loaded.template ? "Template" : "Custom"} />
                <StatPill label="Permissions" value={`${loaded.permission_keys.length} / 22`} />
                <StatPill label="Grants" value={loaded.grant_count} />
                <StatPill label="Version" value={loaded.version} />
              </div>
              {lock && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-800 dark:text-amber-200">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span><b>{lock}.</b> Built-in roles grant exactly what the permission matrix says. Create a custom role to give a different set.</span>
                </div>
              )}
              <div className="grid grid-cols-1 2xl:grid-cols-4 gap-4 items-start">
                <div className="2xl:col-span-3 space-y-4">
                  <RoleKeyToggles value={value} baseline={loaded.permission_keys} onChange={(next) => { setDraft(next); setError(""); }} lockReason={lockReason} />
                  <ChangesBar
                    baseline={loaded.permission_keys}
                    value={value}
                    onDiscard={() => { setDraft(loaded.permission_keys); setError(""); }}
                    onSave={save}
                    saving={updateRole.isPending}
                    error={error}
                    disabled={Boolean(lock) || !canManage}
                  />
                </div>
                <div className="space-y-4">
                  <Panel title="Members holding this role" icon={Users} iconTone="violet" action={canManage && !loaded.owner_only ? { label: "Assign", href: href(`roles-permissions/assign?role=${loaded.id}`) } : undefined}>
                    <LoadGate state={holders} family={family}>
                      {(rows) =>
                        rows.length === 0 ? (
                          <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">Nobody holds this role.</p>
                        ) : (
                          <ul className="space-y-2">
                            {rows.map((row) => (
                              <li key={row.grant_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-2 text-xs">
                                <span className="min-w-0">
                                  <span className="block font-semibold truncate">{row.email}</span>
                                  <span className="block text-[10px] text-[var(--color-text-muted)]">
                                    {row.scope === "ORG" ? "Whole organization" : `Project ${row.scope_id?.slice(0, 8)}…`}
                                    {row.expires_at ? ` · until ${formatDateTime(row.expires_at)}` : ""}
                                  </span>
                                </span>
                                {canManage && !loaded.owner_only && (
                                  <AdminButton
                                    size="xs"
                                    variant="ghost"
                                    disabled={sample || revokeGrant.isPending}
                                    onClick={() =>
                                      revokeGrant.mutate(
                                        { grantId: row.grant_id, version: row.version },
                                        { onSuccess: () => toast.success("Role revoked"), onError: onMutationError },
                                      )
                                    }
                                  >
                                    Revoke
                                  </AdminButton>
                                )}
                              </li>
                            ))}
                          </ul>
                        )
                      }
                    </LoadGate>
                  </Panel>
                  {!loaded.template && canManage && (
                    <Panel title="Delete role" icon={Trash2} iconTone="rose">
                      <p className="text-xs text-[var(--color-text-secondary)] mb-3">Revoke it from every member first. You can only delete roles whose permissions you hold.</p>
                      <AdminButton variant="danger" onClick={remove} isLoading={deleteRole.isPending} disabled={loaded.grant_count > 0}>
                        <Trash2 className="w-3.5 h-3.5" /> Delete role
                      </AdminButton>
                    </Panel>
                  )}
                </div>
              </div>
            </>
          );
        }}
      </LoadGate>
    </PageFrame>
  );
}

/* ======================================================================
 * Assign role
 * ==================================================================== */

export function AssignRoleView({ family }: { family: OrgFamily }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const members = useMembers(orgId);
  const roles = useRoles(orgId);
  const { grantRole, revokeGrant } = useRoleMutations(orgId);
  const { holds } = useActorKeys();
  const [membershipId, setMembershipId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [scope, setScope] = useState<"ORG" | "PROJECT">("ORG");
  const [projectId, setProjectId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [stale, setStale] = useState<ApiError | null>(null);
  const [reloading, setReloading] = useState(false);
  const reloadRoleData = useReloadRoleData(orgId);
  const grants = useMemberGrants(orgId, membershipId);
  const reload = () => {
    setReloading(true);
    void reloadRoleData().finally(() => {
      setReloading(false);
      setStale(null);
    });
  };

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("role");
    if (preset) setRoleId(preset);
  }, []);

  return (
    <PageFrame
      crumbs={[{ label: FAMILY_LABEL[family], href: href() }, { label: "Roles & permissions", href: href("roles-permissions") }, { label: "Assign role" }]}
      back={{ href: href("roles-permissions"), label: "Back to roles & permissions" }}
      title="Assign a role"
      description="Give a member a role for the whole organization or one project. You can only assign roles whose permissions you hold; the owner role never moves through a grant."
    >
      <LoadGate state={members} family={family}>
        {(memberList: MemberDto[], sampleMembers) => (
          <LoadGate state={roles} family={family}>
            {(roleList, sampleRoles) => {
              const sample = sampleMembers || sampleRoles;
              const assignable = (role: RoleDto) => {
                if (role.owner_only) return "Owner only · use ownership transfer";
                const missing = role.permission_keys.filter((key) => !holds(key));
                return missing.length ? `Grants ${missing.length} permission${missing.length > 1 ? "s" : ""} you don't hold` : undefined;
              };
              const selectedRole = roleList.find((role) => role.id === roleId);
              const submit = (e: React.FormEvent) => {
                e.preventDefault();
                if (!membershipId || !selectedRole) return setError("Choose a member and a role.");
                const reason = assignable(selectedRole);
                if (reason) return setError(reason);
                if (scope === "PROJECT" && !/^[0-9a-f-]{36}$/i.test(projectId.trim())) return setError("Enter the project's id.");
                if (sample) return setError("Sample data: connect the API to save.");
                setError("");
                grantRole.mutate(
                  {
                    membership_id: membershipId,
                    template_role_id: selectedRole.template ? selectedRole.id : null,
                    org_role_id: selectedRole.template ? null : selectedRole.id,
                    scope,
                    scope_id: scope === "PROJECT" ? projectId.trim() : null,
                    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
                  },
                  { onSuccess: () => toast.success(`${roleDisplayName(selectedRole.name)} assigned`), onError: (failure) => setError(apiErrorMessage(failure)) },
                );
              };
              const activeMembers = memberList.filter((member) => member.status === "ACTIVE");
              return (
                <>
                  <SampleNotice sample={sample} />
                  {stale && <StaleVersionBanner requestId={stale.requestId} onReload={reload} reloading={reloading} />}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                    <Panel className="xl:col-span-2" title="New grant" icon={KeyRound}>
                      {activeMembers.length === 0 ? (
                        <EmptyStateView icon={Users} title="No active members" description="Invite people first (task 1.2)." />
                      ) : (
                        <form onSubmit={submit} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <AdminSelect label="Member" value={membershipId} onChange={(e) => { setMembershipId(e.target.value); setError(""); }}
                              options={[{ label: "Choose a member…", value: "" }, ...activeMembers.map((member) => ({ label: member.email, value: member.id }))]} />
                            <AdminSelect label="Role" value={roleId} onChange={(e) => { setRoleId(e.target.value); setError(""); }}
                              options={[{ label: "Choose a role…", value: "" }, ...roleList.map((role) => {
                                const reason = assignable(role);
                                return { label: reason ? `${roleDisplayName(role.name)} — locked (${reason})` : roleDisplayName(role.name), value: role.id };
                              })]} />
                            <AdminSelect label="Scope" value={scope} onChange={(e) => setScope(e.target.value as "ORG" | "PROJECT")}
                              options={[{ label: "Whole organization", value: "ORG" }, { label: "One project", value: "PROJECT" }]} />
                            {scope === "PROJECT" ? (
                              <AdminInput label="Project id" placeholder="Project UUID" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
                            ) : (
                              <AdminInput label="Expires (optional, your time zone)" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                            )}
                          </div>
                          {selectedRole && assignable(selectedRole) && (
                            <p className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300"><Lock className="w-3 h-3" />{assignable(selectedRole)}</p>
                          )}
                          {error && <p role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{error}</p>}
                          <AdminButton type="submit" isLoading={grantRole.isPending}><UserPlus className="w-3.5 h-3.5" /> Assign role</AdminButton>
                        </form>
                      )}
                    </Panel>
                    <Panel title="Current grants" description={membershipId ? "Roles this member holds" : "Choose a member"} icon={ShieldCheck} iconTone="violet">
                      {!membershipId ? (
                        <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No member selected.</p>
                      ) : (
                        <LoadGate state={grants} family={family}>
                          {(rows) =>
                            rows.length === 0 ? (
                              <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No roles yet.</p>
                            ) : (
                              <ul className="space-y-2">
                                {rows.map((grant) => (
                                  <li key={grant.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-2 text-xs">
                                    <span className="min-w-0">
                                      <span className="block font-semibold">{roleDisplayName(grant.role_name)}</span>
                                      <span className="block text-[10px] text-[var(--color-text-muted)]">{grant.scope === "ORG" ? "Whole organization" : "One project"}</span>
                                    </span>
                                    {grant.role_name !== "ORGANIZATION_OWNER" && (
                                      <AdminButton size="xs" variant="ghost" disabled={sample || revokeGrant.isPending}
                                        onClick={() => revokeGrant.mutate({ grantId: grant.id, version: grant.version }, {
                                          onSuccess: () => toast.success("Role revoked"),
                                          onError: (failure) =>
                                            isStaleVersion(failure)
                                              ? setStale(failure as ApiError)
                                              : toast.error(apiErrorMessage(failure)),
                                        })}>
                                        Revoke
                                      </AdminButton>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )
                          }
                        </LoadGate>
                      )}
                    </Panel>
                  </div>
                </>
              );
            }}
          </LoadGate>
        )}
      </LoadGate>
    </PageFrame>
  );
}
