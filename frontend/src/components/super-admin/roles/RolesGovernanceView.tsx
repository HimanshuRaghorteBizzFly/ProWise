"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Columns3,
  Edit3,
  Eye,
  GitCompare,
  History,
  KeyRound,
  Layers,
  LayoutGrid,
  Lock,
  MoreVertical,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Copy,
  X,
} from "lucide-react";
import type { CapabilityCatalog, GovernanceRole, HolderMatch, RoleHolder } from "@/types/admin-roles";
import {
  AdminButton,
  AdminSelect,
  ErrorBanner,
  KpiCard,
  PageHeader,
  PaginationBar,
  SurfaceCard,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { ResourceStatus, errorMessage, useDebounced, type ResourceState } from "../admin-resource";
import { usePagedRows } from "../use-paged-rows";
import {
  TAB_LABELS,
  capabilityPercent,
  enforcementLabel,
  filterRoles,
  groupByTier,
  permissionsLockReason,
  rankPillLabel,
  roleKpis,
  roleMenu,
  tabCounts,
  tierInfo,
  type RoleMenuAction,
  type RoleTab,
  type SortKey,
  type StatusFilter,
  type TypeFilter,
} from "./role-model";
import { Chip, RoleIcon, roleTone } from "./role-visuals";

export type ViewMode = "hierarchy" | "grid";

export interface RolesGovernanceViewProps {
  roles: ResourceState<GovernanceRole[]>;
  catalog: ResourceState<CapabilityCatalog>;
  onRetry: () => void;
  onCreate: () => void;
  onCompare: () => void;
  onAuditLog: () => void;
  onResync: () => void;
  onPreview: (role: GovernanceRole) => void;
  /** Opens the editor; `section` picks the tab it opens on. */
  onEdit: (role: GovernanceRole, section: "details" | "permissions") => void;
  onMenu: (role: GovernanceRole, action: RoleMenuAction) => void;
  holderSearch?: (q: string) => Promise<HolderMatch[]>;
  loadHolders?: (id: string) => Promise<RoleHolder[]>;
  initialView?: ViewMode;
  initialSelectedId?: string | null;
}

export function RolesGovernanceView(props: RolesGovernanceViewProps) {
  const { roles, catalog, onRetry, onCreate, onCompare, onAuditLog, onResync, holderSearch } = props;
  const all = useMemo(() => (roles.status === "ready" ? roles.data : []), [roles]);
  const cat = catalog.status === "ready" ? catalog.data : null;
  const kpis = roleKpis(all, cat);
  const counts = tabCounts(all);

  const [tab, setTab] = useState<RoleTab>("all");
  const [view, setView] = useState<ViewMode>(props.initialView ?? "hierarchy");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("hierarchy");
  const [selectedId, setSelectedId] = useState<string | null>(props.initialSelectedId ?? null);
  const [holderMatches, setHolderMatches] = useState<Set<string>>(new Set());
  const detailRef = useRef<HTMLDivElement>(null);

  const debounced = useDebounced(search, 300);
  useEffect(() => {
    let alive = true;
    const q = debounced.trim();
    if (!holderSearch || q.length < 2) {
      setHolderMatches(new Set());
      return;
    }
    holderSearch(q)
      .then((matches) => alive && setHolderMatches(new Set(matches.map((m) => m.role_id))))
      .catch(() => alive && setHolderMatches(new Set()));
    return () => {
      alive = false;
    };
  }, [debounced, holderSearch]);

  const visible = filterRoles(all, { tab, search, type, status, sort, holderMatches });
  const systemRoles = all.filter((r) => r.is_system && r.rank !== null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const selected = all.find((r) => r.id === selectedId) ?? null;

  const select = (role: GovernanceRole) => {
    setSelectedId((current) => (current === role.id ? null : role.id));
    setTimeout(() => detailRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 0);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Roles & Permissions Governance"
        badge={roles.status === "ready" ? `${kpis.active} Roles Active` : undefined}
        description="Hierarchy of platform and organization roles with the capabilities the system enforces. A role name grants nothing by itself: organization roles act only through grants, Super Admin through the platform authority."
        actions={
          <>
            <AdminButton variant="outline" size="sm" onClick={onResync} disabled={roles.status !== "ready"}>
              <RefreshCw className="w-3.5 h-3.5" />
              Re-sync System Roles
            </AdminButton>
            <AdminButton variant="outline" size="sm" onClick={onAuditLog}>
              <History className="w-3.5 h-3.5" />
              Audit Log
            </AdminButton>
            <AdminButton variant="outline" size="sm" onClick={onCompare} disabled={all.length < 2}>
              <GitCompare className="w-3.5 h-3.5" />
              Compare
            </AdminButton>
            <AdminButton size="sm" onClick={onCreate} disabled={roles.status !== "ready" || !cat}>
              <Plus className="w-3.5 h-3.5" />
              Create Custom Role
            </AdminButton>
          </>
        }
      />

      {roles.status === "ready" && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard label="Total Roles" value={kpis.total} sublabel={`${kpis.active} active`} icon={Layers} tone="blue" />
          <KpiCard label="System Roles" value={kpis.system} sublabel="Protected baseline" icon={ShieldCheck} tone="emerald" />
          <KpiCard label="Platform Roles" value={kpis.platform} sublabel="Global governance" icon={Shield} tone="amber" />
          <KpiCard label="Organization Roles" value={kpis.organization} sublabel="Tenant & project scope" icon={Building2} tone="violet" />
          <KpiCard label="Custom Roles" value={kpis.custom} sublabel="Created by Super Admins" icon={Sparkles} tone="rose" />
          <KpiCard
            label="Capabilities"
            value={cat ? kpis.capabilities : "-"}
            sublabel={cat ? `Across ${kpis.modules} core modules` : "Catalog not loaded"}
            icon={KeyRound}
            tone="slate"
          />
        </div>
      )}

      {systemRoles.length > 0 && (
        <nav aria-label="Role hierarchy ranks" className="flex flex-wrap gap-2">
          {systemRoles.map((r) => {
            const active = r.id === selectedId;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={active}
                onClick={() => select(r)}
                className={
                  active
                    ? "rounded-full border border-blue-600 bg-blue-600 px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:border-blue-500/50"
                }
              >
                {rankPillLabel(r)}
              </button>
            );
          })}
        </nav>
      )}

      {selected && (
        <div ref={detailRef}>
          <RoleDetailPanel
            role={selected}
            catalog={cat}
            loadHolders={props.loadHolders}
            onClose={() => setSelectedId(null)}
            onEdit={props.onEdit}
            onPreview={props.onPreview}
          />
        </div>
      )}

      <SurfaceCard className="overflow-hidden">
        <div role="tablist" aria-label="Role groups" className="flex flex-wrap gap-1 border-b border-[var(--color-border)] px-3 pt-3">
          {(Object.keys(TAB_LABELS) as RoleTab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? "rounded-t-lg border-b-2 border-blue-600 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400"
                  : "rounded-t-lg border-b-2 border-transparent px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }
            >
              {TAB_LABELS[t]} <span className="ml-1 rounded-full bg-[var(--color-elevated)] px-1.5 text-[10px]">{counts[t]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2.5 p-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles, slug or users..."
            aria-label="Search roles, slug or users"
            className="h-9 w-full lg:w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[var(--color-border)] p-0.5" role="group" aria-label="View mode">
              <button
                type="button"
                aria-pressed={view === "hierarchy"}
                onClick={() => setView("hierarchy")}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${view === "hierarchy" ? "bg-blue-600 text-white" : "text-[var(--color-text-secondary)]"}`}
              >
                <Columns3 className="w-3.5 h-3.5" /> Hierarchy Tiers
              </button>
              <button
                type="button"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${view === "grid" ? "bg-blue-600 text-white" : "text-[var(--color-text-secondary)]"}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Grid
              </button>
            </div>
            <AdminSelect aria-label="Role type" value={type} onChange={(e) => setType(e.target.value as TypeFilter)}>
              <option value="all">All Types</option>
              <option value="system">System</option>
              <option value="custom">Custom</option>
            </AdminSelect>
            <AdminSelect aria-label="Role status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </AdminSelect>
            <AdminSelect aria-label="Sort roles" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="hierarchy">Hierarchy Order (#1-#9)</option>
              <option value="name">Name (A-Z)</option>
              <option value="users">Most users</option>
              <option value="capabilities">Most capabilities</option>
            </AdminSelect>
          </div>
        </div>

        {catalog.status === "error" && roles.status === "ready" && (
          <div className="px-3 pb-3">
            <ErrorBanner message={`Capability catalog: ${catalog.message}`} onRetry={onRetry} />
          </div>
        )}

        <ResourceStatus
          state={roles}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyTitle="No roles defined"
          emptyDescription="The system roles come from the database migration. Run the backend migrations, then reload."
        />

        {roles.status === "ready" && all.length > 0 && visible.length === 0 && (
          <p className="px-4 pb-6 text-center text-xs text-[var(--color-text-secondary)]">No role matches these filters.</p>
        )}

        {roles.status === "ready" && visible.length > 0 &&
          (view === "hierarchy" ? (
            <HierarchyView {...props} rows={visible} />
          ) : (
            <GridView {...props} rows={visible} />
          ))}
      </SurfaceCard>
    </div>
  );
}

/* ---------------------------------------------------------------- hierarchy */

function HierarchyView(props: { rows: GovernanceRole[] } & RolesGovernanceViewProps) {
  const groups = groupByTier(props.rows);
  return (
    <div className="space-y-4 p-3 pt-0">
      {groups.map((g) => (
        <section key={g.info.tier} aria-label={`Tier ${g.info.tier} ${g.info.title}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)]/40 p-3">
          <header className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Tier {g.info.tier === 6 ? "-" : g.info.tier}: {g.info.title}
                </h3>
                {g.rankRange && <Chip>{g.rankRange}</Chip>}
                <Chip>{g.info.scopeLabel}</Chip>
                <Chip>{g.info.tag}</Chip>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{g.info.description}</p>
            </div>
            <span className="text-[11px] font-medium text-[var(--color-text-muted)] whitespace-nowrap">
              {g.roles.length} role{g.roles.length === 1 ? "" : "s"}
            </span>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {g.roles.map((r) => (
              <HierarchyRoleCard key={r.id} role={r} {...props} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function HierarchyRoleCard({
  role,
  onPreview,
  onEdit,
  onMenu,
}: { role: GovernanceRole } & Pick<RolesGovernanceViewProps, "onPreview" | "onEdit" | "onMenu">) {
  const tone = roleTone(role.color);
  const pct = capabilityPercent(role);
  return (
    <article
      aria-label={role.name}
      className={`relative rounded-xl border border-[var(--color-border)] border-t-4 ${tone.top} bg-[var(--color-surface)] p-4 flex flex-col gap-3 ${role.is_active ? "" : "opacity-70"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${tone.chip}`}>
          <RoleIcon name={role.icon} className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[var(--color-text-muted)]">{role.rank_label}</span>
            <h4 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{role.name}</h4>
            {role.is_protected && <Lock className="w-3.5 h-3.5 text-amber-500" aria-label="Protected" />}
          </div>
          {role.subtitle && <p className="truncate text-[11px] text-[var(--color-text-secondary)]">{role.subtitle}</p>}
        </div>
        <RoleMenuButton role={role} onMenu={onMenu} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip>{role.scope === "PLATFORM" ? "Platform Scope" : "Organization Scope"}</Chip>
        <Chip>{tierInfo(role.tier).tag}</Chip>
        <Chip className={role.is_system ? "text-emerald-700 dark:text-emerald-300" : "text-violet-700 dark:text-violet-300"}>
          {role.is_system ? "System Role" : "Custom Role"}
        </Chip>
        {!role.is_active && <Chip className="text-rose-700 dark:text-rose-300">Inactive</Chip>}
        {role.baseline_drift && <Chip className="text-amber-700 dark:text-amber-300">Changed from baseline</Chip>}
      </div>
      {role.description && <p className="text-xs leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">{role.description}</p>}
      <div>
        <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
          <span>
            <strong className="text-[var(--color-text-primary)]">{role.capability_count}</strong> capabilities
          </span>
          <span>{pct}% of catalog</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-[var(--color-elevated)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${role.name} capability coverage`}>
          <div className={`h-1.5 rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)]">
          <Users className="w-3.5 h-3.5" />
          <strong className="text-[var(--color-text-primary)]">{role.user_count}</strong> user{role.user_count === 1 ? "" : "s"}
          {role.scope === "ORGANIZATION" && role.organization_count > 0 && (
            <span>· {role.organization_count} org{role.organization_count === 1 ? "" : "s"}</span>
          )}
        </span>
        <div className="flex gap-1.5">
          <AdminButton variant="outline" size="xs" onClick={() => onPreview(role)}>
            <Eye className="w-3.5 h-3.5" /> Preview
          </AdminButton>
          <AdminButton
            size="xs"
            onClick={() => onEdit(role, "permissions")}
            title={permissionsLockReason(role) ?? undefined}
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Permissions
          </AdminButton>
        </div>
      </div>
    </article>
  );
}

function RoleMenuButton({ role, onMenu }: { role: GovernanceRole; onMenu: RolesGovernanceViewProps["onMenu"] }) {
  const [open, setOpen] = useState(false);
  const items = roleMenu(role);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`More actions for ${role.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)]"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.action}
              type="button"
              role="menuitem"
              disabled={Boolean(item.disabledReason)}
              title={item.disabledReason}
              onClick={() => {
                setOpen(false);
                onMenu(role, item.action);
              }}
              className={`block w-full rounded-md px-2.5 py-1.5 text-left text-xs ${item.disabledReason ? "cursor-not-allowed text-[var(--color-text-muted)]" : item.action === "delete" ? "text-rose-600 hover:bg-rose-500/10" : "text-[var(--color-text-primary)] hover:bg-[var(--color-elevated)]"}`}
            >
              {item.label}
              {item.disabledReason && <span className="block text-[10px] leading-snug">{item.disabledReason}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- grid */

function GridView(props: { rows: GovernanceRole[] } & RolesGovernanceViewProps) {
  const { pageRows, barProps } = usePagedRows(props.rows, 10);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3 pt-0">
        {pageRows.map((r) => (
          <GridRoleCard key={r.id} role={r} {...props} />
        ))}
      </div>
      <PaginationBar {...barProps} />
    </>
  );
}

export function GridRoleCard({
  role,
  onPreview,
  onEdit,
  onMenu,
}: { role: GovernanceRole } & Pick<RolesGovernanceViewProps, "onPreview" | "onEdit" | "onMenu">) {
  const tone = roleTone(role.color);
  const canClone = role.kind !== "SUPER_ADMIN";
  return (
    <article aria-label={role.name} className={`rounded-xl border border-[var(--color-border)] border-t-4 ${tone.top} bg-[var(--color-surface)] p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${tone.chip}`}>
            <RoleIcon name={role.icon} className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{role.name}</h4>
            <p className="truncate font-mono text-[11px] text-[var(--color-text-muted)]">{role.slug}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <Chip>{role.is_system ? "System" : "Custom"}</Chip>
          <Chip className={role.is_active ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
            {role.is_active ? "Active" : "Inactive"}
          </Chip>
        </div>
      </div>
      {role.description && <p className="text-xs leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">{role.description}</p>}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Tile label="Scope" value={role.scope === "PLATFORM" ? "Platform" : "Organization"} />
        <Tile label="Permissions" value={String(role.capability_count)} />
        <Tile
          label="Users"
          value={
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {role.user_count}
            </span>
          }
        />
      </div>
      <p className="text-[11px] text-[var(--color-text-secondary)]">
        <span className="font-semibold text-[var(--color-text-primary)]">{role.tier_name}</span>
        {role.subtitle ? ` / ${role.subtitle}` : ""}
      </p>
      <div className="mt-auto flex flex-wrap gap-1.5 border-t border-[var(--color-border)] pt-3">
        <AdminButton variant="outline" size="xs" onClick={() => onPreview(role)}>
          <Eye className="w-3.5 h-3.5" /> View
        </AdminButton>
        <AdminButton variant="outline" size="xs" onClick={() => onEdit(role, "details")}>
          <Edit3 className="w-3.5 h-3.5" /> Edit
        </AdminButton>
        <AdminButton
          variant="outline"
          size="xs"
          disabled={!canClone}
          title={canClone ? undefined : "Super Admin authority cannot be copied."}
          onClick={() => onMenu(role, "clone")}
        >
          <Copy className="w-3.5 h-3.5" /> Clone
        </AdminButton>
        {!role.is_system && (
          <AdminButton variant="danger" size="xs" onClick={() => onMenu(role, "delete")}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </AdminButton>
        )}
      </div>
    </article>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)]/50 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{value}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- selected role detail (rank strip) */

export function RoleDetailPanel({
  role,
  catalog,
  loadHolders,
  onClose,
  onEdit,
  onPreview,
}: {
  role: GovernanceRole;
  catalog: CapabilityCatalog | null;
  loadHolders?: (id: string) => Promise<RoleHolder[]>;
  onClose: () => void;
  onEdit: RolesGovernanceViewProps["onEdit"];
  onPreview: RolesGovernanceViewProps["onPreview"];
}) {
  const tone = roleTone(role.color);
  const held = new Set(role.permissions);
  const modules = (catalog?.modules ?? [])
    .map((m) => ({ ...m, capabilities: m.capabilities.filter((c) => held.has(c.key)) }))
    .filter((m) => m.capabilities.length > 0);
  return (
    <SurfaceCard className={`border-t-4 ${tone.top} p-4 space-y-4`} aria-label={`${role.name} details`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`h-11 w-11 shrink-0 rounded-lg flex items-center justify-center ${tone.chip}`}>
            <RoleIcon name={role.icon} className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {role.rank_label} {role.name}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {role.tier_name}
              {role.subtitle ? ` / ${role.subtitle}` : ""} · {enforcementLabel(role)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton variant="outline" size="xs" onClick={() => onPreview(role)}>
            <Eye className="w-3.5 h-3.5" /> Preview
          </AdminButton>
          <AdminButton size="xs" onClick={() => onEdit(role, "permissions")}>
            <Edit3 className="w-3.5 h-3.5" /> Edit Permissions
          </AdminButton>
          <AdminButton variant="ghost" size="xs" onClick={onClose} aria-label="Close role details">
            <X className="w-3.5 h-3.5" />
          </AdminButton>
        </div>
      </div>
      <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)]/50 p-2.5 text-xs text-[var(--color-text-secondary)]">
        {role.enforcement_note}
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-2">
          <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">
            Capabilities by module ({role.capability_count})
          </h4>
          {!catalog && <p className="text-xs text-[var(--color-text-muted)]">Loading the capability catalog...</p>}
          {catalog && modules.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">This role holds no capability.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {modules.map((m) => (
              <div key={m.id} className="rounded-lg border border-[var(--color-border)] p-2.5">
                <p className="text-[11px] font-semibold text-[var(--color-text-primary)]">
                  {m.name} <span className="font-normal text-[var(--color-text-muted)]">({m.capabilities.length})</span>
                </p>
                <ul className="mt-1 space-y-0.5">
                  {m.capabilities.map((c) => (
                    <li key={c.key} className="text-[11px] text-[var(--color-text-secondary)]" title={c.description}>
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <HolderList role={role} loadHolders={loadHolders} />
      </div>
    </SurfaceCard>
  );
}

/** Real holders of a role (loaded from the server), paginated. */
export function HolderList({ role, loadHolders }: { role: GovernanceRole; loadHolders?: (id: string) => Promise<RoleHolder[]> }) {
  const [state, setState] = useState<ResourceState<RoleHolder[]>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    if (!loadHolders) {
      setState({ status: "ready", data: [] });
      return;
    }
    setState({ status: "loading" });
    loadHolders(role.id)
      .then((data) => alive && setState({ status: "ready", data }))
      .catch((e) => alive && setState({ status: "error", message: errorMessage(e) }));
    return () => {
      alive = false;
    };
  }, [role.id, role.user_count, loadHolders, attempt]);
  const rows = state.status === "ready" ? state.data : [];
  const { pageRows, barProps } = usePagedRows(rows, 5);
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">
        Users ({role.user_count})
      </h4>
      {role.enforcement === "DEFINITION_ONLY" && (
        <p className="text-[11px] text-[var(--color-text-muted)]">Definition only: nobody can hold this role yet.</p>
      )}
      {state.status === "loading" && <p className="text-[11px] text-[var(--color-text-muted)]" role="status">Loading users...</p>}
      {state.status === "error" && <ErrorBanner message={state.message} onRetry={() => setAttempt((n) => n + 1)} />}
      {state.status === "ready" && rows.length === 0 && role.enforcement !== "DEFINITION_ONLY" && (
        <p className="text-[11px] text-[var(--color-text-muted)]">Nobody holds this role yet.</p>
      )}
      {rows.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)]">
          <ul className="divide-y divide-[var(--color-border)]">
            {pageRows.map((h) => (
              <li key={`${h.id}-${h.email}`} className="px-2.5 py-1.5">
                <p className="truncate text-[11px] font-medium text-[var(--color-text-primary)]">{h.name || h.email}</p>
                <p className="truncate text-[10px] text-[var(--color-text-muted)]">
                  {h.email}
                  {h.organization_name ? ` · ${h.organization_name}` : ""}
                  {h.detail ? ` · ${h.detail}` : ""}
                </p>
              </li>
            ))}
          </ul>
          <PaginationBar {...barProps} />
        </div>
      )}
    </div>
  );
}
