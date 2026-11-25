"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Ban, Building2, CheckCircle2, Download, Edit3, Eye, Plus, RefreshCw, RotateCcw, Trash2, UserCheck } from "lucide-react";
import type { AdminOrganization, AdminOrganizationSummary } from "@/types/admin";
import type { CommercialPlan, CreateOrganizationBody, UpdateOrganizationBody } from "@/types/admin-commercial";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  BulkSelectionBar,
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
import { ResourceStatus, formatInstant, humanize, type ResourceState } from "./admin-resource";
import { INDUSTRIES, countryNames, selectOptions, timeZones } from "@/lib/reference-options";
import {
  CommercialFormModal,
  EMAIL_PATTERN,
  fieldError,
  optionalText,
  parseOptionalNumber,
  type FieldErrors,
  type MutationFailure,
} from "./commercial/mutation";
import { planTheme } from "./commercial/PlansView";
import { selectClass, tdClass, thClass, theadClass } from "./commercial/shared";
import { usePagedRows } from "./use-paged-rows";

export const ORGANIZATION_STATUSES = ["ACTIVE", "TRIAL", "SUSPENDED"];

export type OrganizationAction = "view" | "edit" | "suspend" | "reactivate" | "delete";

/** Actions the backend offers for an organization in this state. */
export function organizationActions(org: AdminOrganization): OrganizationAction[] {
  const actions: OrganizationAction[] = ["view", "edit"];
  if (org.status === "SUSPENDED") actions.push("reactivate");
  else actions.push("suspend");
  actions.push("delete");
  return actions;
}

export interface OrganizationsViewProps {
  state: ResourceState<AdminOrganization[]>;
  summary: ResourceState<AdminOrganizationSummary>;
  search: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onRetry: () => void;
  onOpen: (id: string) => void;
  detail: ResourceState<AdminOrganization> | null;
  onCloseDetail: () => void;
  onRetryDetail: () => void;
  /** Plans from the server, to show plan names and filter by plan. */
  plans?: CommercialPlan[];
  planId?: string;
  onPlanChange?: (value: string) => void;
  onCreate?: () => void;
  onAction?: (id: string, action: Exclude<OrganizationAction, "view">) => void;
  onExport?: () => void;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onBulkSuspend?: () => void;
}

function summaryValue(summary: ResourceState<AdminOrganizationSummary>, pick: (s: AdminOrganizationSummary) => number) {
  return summary.status === "ready" ? pick(summary.data) : "-";
}

function PlanName({ planId, plans }: { planId: string | null; plans?: CommercialPlan[] }) {
  if (!planId) return <span className="text-[var(--color-text-muted)]">-</span>;
  const plan = plans?.find((p) => p.id === planId);
  const theme = planTheme({ brand_color: plan?.brand_color ?? null });
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${theme.badge}`}>
      {plan ? plan.name : planId}
    </span>
  );
}

function SeatsCell({ used, limit }: { used: number; limit: number | null }) {
  const pct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;
  return (
    <div className="min-w-[80px]">
      <span className="tabular-nums">
        {used} / {limit ?? "-"}
      </span>
      {pct !== null && (
        <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--color-elevated)] overflow-hidden" aria-hidden="true">
          <div className={`h-full rounded-full ${pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export function OrganizationsView(props: OrganizationsViewProps) {
  const {
    state,
    summary,
    search,
    status,
    onSearchChange,
    onStatusChange,
    onRetry,
    onOpen,
    detail,
    onCloseDetail,
    onRetryDetail,
    plans,
    planId = "ALL",
    onPlanChange,
    onCreate,
    onAction,
    onExport,
    selectedIds = [],
    onSelectedIdsChange,
    onBulkSuspend,
  } = props;
  const rows = state.status === "ready" ? state.data : [];
  const filtered = search.trim() !== "" || status !== "ALL" || planId !== "ALL";
  const selectable = Boolean(onSelectedIdsChange);
  const selected = new Set(selectedIds);
  const { pageRows, barProps } = usePagedRows(rows);
  // "Select all" picks the rows on the visible page; selections made on other pages are kept.
  const pageIds = pageRows.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const togglePage = () =>
    onSelectedIdsChange?.(
      allSelected ? selectedIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])),
    );
  const toggle = (id: string) =>
    onSelectedIdsChange?.(selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organizations"
        description="Tenant organizations on the platform: provision, edit, suspend, reactivate and delete."
        badge={state.status === "ready" ? `${rows.length} shown` : undefined}
        actions={
          <>
            <AdminButton variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </AdminButton>
            {onExport && (
              <AdminButton variant="outline" size="sm" onClick={onExport} disabled={rows.length === 0}>
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </AdminButton>
            )}
            {onCreate && (
              <AdminButton variant="primary" size="sm" onClick={onCreate}>
                <Plus className="w-3.5 h-3.5" />
                Create Organization
              </AdminButton>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total" value={summaryValue(summary, (s) => s.total_orgs)} icon={Building2} tone="blue" />
        <KpiCard label="Active" value={summaryValue(summary, (s) => s.active_orgs)} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Trial" value={summaryValue(summary, (s) => s.trial_orgs)} icon={UserCheck} tone="amber" />
        <KpiCard label="Suspended" value={summaryValue(summary, (s) => s.suspended_orgs)} icon={Ban} tone="rose" />
      </div>
      {summary.status === "error" && (
        <p className="text-xs text-rose-700 dark:text-rose-300">Summary unavailable: {summary.message}</p>
      )}

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder="Name, slug or owner"
            hasActiveFilters={filtered}
            onResetFilters={() => {
              onSearchChange("");
              onStatusChange("ALL");
              onPlanChange?.("ALL");
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Filter organization status" className={selectClass} value={status} onChange={(e) => onStatusChange(e.target.value)}>
                  <option value="ALL">All statuses</option>
                  {ORGANIZATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </select>
                {onPlanChange && (
                  <select aria-label="Filter plan" className={selectClass} value={planId} onChange={(e) => onPlanChange(e.target.value)}>
                    <option value="ALL">All plans</option>
                    {(plans ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            }
          />
        </div>

        {selectable && onBulkSuspend && (
          <BulkSelectionBar
            selectedCount={selectedIds.length}
            onClear={() => onSelectedIdsChange?.([])}
            actions={
              <AdminButton variant="danger" size="xs" onClick={onBulkSuspend}>
                <Ban className="w-3.5 h-3.5" />
                Suspend selected
              </AdminButton>
            }
          />
        )}

        <ResourceStatus
          state={state}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={Building2}
          emptyTitle={filtered ? "No organizations match" : "No organizations yet"}
          emptyDescription={
            filtered ? "Change the search or filters." : "Organizations appear here once they are created on the platform."
          }
        />
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Organizations">
              <thead className={theadClass}>
                <tr>
                  {selectable && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all organizations"
                        checked={allSelected}
                        onChange={togglePage}
                        className="h-4 w-4 accent-blue-600"
                      />
                    </th>
                  )}
                  <th className={thClass}>Organization</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Owner</th>
                  <th className={thClass}>Plan</th>
                  <th className={thClass}>Seats</th>
                  <th className={thClass}>Projects</th>
                  <th className={thClass}>Created</th>
                  {onAction && <th className={`${thClass} text-right`}>Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {pageRows.map((org) => {
                  const actions = organizationActions(org);
                  return (
                    <tr key={org.id} className={`hover:bg-[var(--color-hover)] ${selected.has(org.id) ? "bg-blue-500/5" : ""}`}>
                      {selectable && (
                        <td className="px-4 py-3 w-10 align-top">
                          <input
                            type="checkbox"
                            aria-label={`Select ${org.name}`}
                            checked={selected.has(org.id)}
                            onChange={() => toggle(org.id)}
                            className="h-4 w-4 accent-blue-600"
                          />
                        </td>
                      )}
                      <td className={tdClass}>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                            {getOrgInitials(org.name)}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onOpen(org.id)}
                              className="text-left font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                            >
                              {org.name}
                            </button>
                            <div className="text-[11px] text-[var(--color-text-muted)] font-mono">{org.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className={tdClass}>
                        <StatusBadge label={humanize(org.status)} tone={getStatusTone(org.status)} dot />
                      </td>
                      <td className={`${tdClass} text-[var(--color-text-secondary)]`}>
                        <div>{org.owner_name || "-"}</div>
                        {org.owner_email && <div className="text-[11px] text-[var(--color-text-muted)]">{org.owner_email}</div>}
                      </td>
                      <td className={tdClass}>
                        <PlanName planId={org.plan_id} plans={plans} />
                      </td>
                      <td className={`${tdClass} text-[var(--color-text-secondary)] whitespace-nowrap`}>
                        <SeatsCell used={org.seats_used} limit={org.seats_limit} />
                      </td>
                      <td className={`${tdClass} text-[var(--color-text-secondary)]`}>{org.projects_count}</td>
                      <td className={`${tdClass} text-[var(--color-text-secondary)] whitespace-nowrap`}>{formatInstant(org.created_at)}</td>
                      {onAction && (
                        <td className={`${tdClass} text-right`}>
                          <div className="inline-flex items-center justify-end gap-1">
                            <AdminButton variant="ghost" size="xs" title="View organization" aria-label={`View ${org.name}`} onClick={() => onOpen(org.id)}>
                              <Eye className="w-3.5 h-3.5" />
                            </AdminButton>
                            <AdminButton variant="ghost" size="xs" title="Edit organization" aria-label={`Edit ${org.name}`} onClick={() => onAction(org.id, "edit")}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </AdminButton>
                            {actions.includes("suspend") && (
                              <AdminButton variant="outline" size="xs" onClick={() => onAction(org.id, "suspend")}>
                                <Ban className="w-3 h-3" /> Suspend
                              </AdminButton>
                            )}
                            {actions.includes("reactivate") && (
                              <AdminButton variant="subtle" size="xs" onClick={() => onAction(org.id, "reactivate")}>
                                <RotateCcw className="w-3 h-3" /> Reactivate
                              </AdminButton>
                            )}
                            <AdminButton
                              variant="ghost"
                              size="xs"
                              className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                              title="Delete organization"
                              aria-label={`Delete ${org.name}`}
                              onClick={() => onAction(org.id, "delete")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </AdminButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && <PaginationBar {...barProps} />}
      </SurfaceCard>

      <SlideOverDrawer
        isOpen={detail !== null}
        onClose={onCloseDetail}
        title={detail?.status === "ready" ? detail.data.name : "Organization"}
        subtitle={detail?.status === "ready" ? detail.data.slug : undefined}
      >
        {detail && (
          <>
            <ResourceStatus state={detail} isEmpty={() => false} onRetry={onRetryDetail} emptyTitle="" emptyDescription="" />
            {detail.status === "ready" && <OrganizationDetail org={detail.data} plans={plans} />}
            {detail.status === "ready" && onAction && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
                <AdminButton variant="outline" size="sm" onClick={() => onAction(detail.data.id, "edit")}>
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </AdminButton>
                {detail.data.status === "SUSPENDED" ? (
                  <AdminButton variant="primary" size="sm" onClick={() => onAction(detail.data.id, "reactivate")}>
                    <RotateCcw className="w-3.5 h-3.5" /> Reactivate
                  </AdminButton>
                ) : (
                  <AdminButton variant="danger" size="sm" onClick={() => onAction(detail.data.id, "suspend")}>
                    <Ban className="w-3.5 h-3.5" /> Suspend
                  </AdminButton>
                )}
              </div>
            )}
          </>
        )}
      </SlideOverDrawer>
    </div>
  );
}

export function OrganizationDetail({ org, plans }: { org: AdminOrganization; plans?: CommercialPlan[] }) {
  const fields: [string, React.ReactNode][] = [
    ["Status", <StatusBadge key="s" label={humanize(org.status)} tone={getStatusTone(org.status)} dot />],
    ["Owner", org.owner_name || "-"],
    ["Owner email", org.owner_email || "-"],
    ["Plan", <PlanName key="p" planId={org.plan_id} plans={plans} />],
    ["Seats", `${org.seats_used} / ${org.seats_limit ?? "-"}`],
    ["Projects", String(org.projects_count)],
    ["Time zone", org.timezone || "-"],
    ["Domain", org.domain || "-"],
    ["Industry", org.industry || "-"],
    ["Country", org.country || "-"],
    ["Created", formatInstant(org.created_at)],
    ["Last activity", formatInstant(org.last_activity_at)],
  ];
  if (org.suspended_reason) fields.push(["Suspended reason", org.suspended_reason]);
  if (org.notes) fields.push(["Notes", org.notes]);
  return (
    <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-xs">
      {fields.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt className="text-[var(--color-text-muted)]">{label}</dt>
          <dd className="text-[var(--color-text-primary)] break-words">{value}</dd>
        </React.Fragment>
      ))}
      <dt className="text-[var(--color-text-muted)]">ID</dt>
      <dd className="font-mono text-[11px] break-all">{org.id}</dd>
    </dl>
  );
}

/* ---------------------------------------------------------------- create / edit */

interface OrgFormValues {
  name: string;
  slug: string;
  domain: string;
  industry: string;
  country: string;
  timezone: string;
  owner_name: string;
  owner_email: string;
  plan_id: string;
  seats_limit: string;
  notes: string;
}

function orgFormValues(org: AdminOrganization | null): OrgFormValues {
  return {
    name: org?.name ?? "",
    slug: org?.slug ?? "",
    domain: org?.domain ?? "",
    industry: org?.industry ?? "",
    country: org?.country ?? "",
    timezone: org?.timezone ?? "UTC",
    owner_name: org?.owner_name ?? "",
    owner_email: org?.owner_email ?? "",
    plan_id: org?.plan_id ?? "",
    seats_limit: org?.seats_limit === null || org?.seats_limit === undefined ? "" : String(org.seats_limit),
    notes: org?.notes ?? "",
  };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Mirrors CreateOrgRequest (name, slug, owner name, owner email required; email format). */
export function validateOrganizationForm(v: OrgFormValues, isCreate: boolean): FieldErrors {
  const e: FieldErrors = {};
  if (!v.name.trim()) e.name = "Name is required.";
  if (isCreate) {
    if (!v.slug.trim()) e.slug = "Slug is required.";
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.slug.trim())) e.slug = "Lowercase letters, digits and single hyphens.";
  }
  if (!v.owner_name.trim()) e.owner_name = "Owner name is required.";
  if (!v.owner_email.trim()) e.owner_email = "Owner email is required.";
  else if (!EMAIL_PATTERN.test(v.owner_email.trim())) e.owner_email = "Enter a valid email address.";
  const seats = parseOptionalNumber(v.seats_limit);
  if (seats !== null && (!Number.isInteger(seats) || seats < 1)) e.seats_limit = "Whole number, 1 or more.";
  if (v.timezone.trim()) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: v.timezone.trim() });
    } catch {
      e.timezone = "Use an IANA time zone, e.g. Europe/Berlin.";
    }
  }
  return e;
}

export function OrganizationFormModal({
  isOpen,
  org,
  plans,
  busy,
  failure,
  onReload,
  onClose,
  onCreate,
  onUpdate,
}: {
  isOpen: boolean;
  org: AdminOrganization | null;
  plans: CommercialPlan[];
  busy: boolean;
  failure: MutationFailure | null;
  onReload: () => void;
  onClose: () => void;
  onCreate: (body: CreateOrganizationBody) => void;
  onUpdate: (body: UpdateOrganizationBody) => void;
}) {
  const [v, setV] = useState(() => orgFormValues(org));
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  useEffect(() => {
    if (isOpen) {
      setV(orgFormValues(org));
      setSlugTouched(false);
      setErrors({});
    }
  }, [isOpen, org]);
  const set = <K extends keyof OrgFormValues>(k: K, value: OrgFormValues[K]) => setV((p) => ({ ...p, [k]: value }));
  const err = (f: string) => fieldError(failure, errors, f);
  const isCreate = org === null;
  const countries = useMemo(() => countryNames(), []);
  const zones = useMemo(() => timeZones(), []);

  return (
    <CommercialFormModal
      isOpen={isOpen}
      title={isCreate ? "Create Organization" : `Edit ${org.name}`}
      description={isCreate ? "Provisions a tenant organization." : undefined}
      maxWidth="2xl"
      busy={busy}
      failure={failure}
      onReload={onReload}
      onClose={onClose}
      submitLabel={isCreate ? "Create Organization" : "Save Organization"}
      onSubmit={() => {
        const found = validateOrganizationForm(v, isCreate);
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        const common = {
          name: v.name.trim(),
          domain: optionalText(v.domain),
          industry: optionalText(v.industry),
          country: optionalText(v.country),
          timezone: optionalText(v.timezone),
          owner_name: v.owner_name.trim(),
          owner_email: v.owner_email.trim(),
          plan_id: optionalText(v.plan_id),
          seats_limit: parseOptionalNumber(v.seats_limit),
          notes: optionalText(v.notes),
        };
        if (isCreate) onCreate({ ...common, slug: v.slug.trim() });
        else onUpdate(common);
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AdminInput
          label="Name *"
          placeholder="e.g. Acme Health Systems"
          value={v.name}
          onChange={(e) => {
            set("name", e.target.value);
            if (isCreate && !slugTouched) set("slug", slugify(e.target.value));
          }}
          error={err("name")}
        />
        <AdminInput
          label={isCreate ? "Slug *" : "Slug"}
          placeholder="e.g. acme-health-systems"
          value={v.slug}
          disabled={!isCreate}
          helperText={isCreate ? "Filled from the name; lowercase letters, digits and hyphens." : "The slug cannot change."}
          onChange={(e) => {
            setSlugTouched(true);
            set("slug", e.target.value.toLowerCase());
          }}
          error={err("slug")}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AdminInput
          label="Owner name *"
          placeholder="e.g. Priya Sharma"
          autoComplete="off"
          value={v.owner_name}
          onChange={(e) => set("owner_name", e.target.value)}
          error={err("owner_name")}
        />
        <AdminInput
          label="Owner email *"
          type="email"
          placeholder="e.g. owner@company.com"
          autoComplete="off"
          value={v.owner_email}
          onChange={(e) => set("owner_email", e.target.value)}
          error={err("owner_email")}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AdminInput label="Domain" placeholder="e.g. company.com" value={v.domain} onChange={(e) => set("domain", e.target.value)} error={err("domain")} />
        <AdminSelect
          label="Industry"
          value={v.industry}
          onChange={(e) => set("industry", e.target.value)}
          options={selectOptions(INDUSTRIES, v.industry, "Select industry")}
          error={err("industry")}
        />
        <AdminSelect
          label="Country"
          value={v.country}
          onChange={(e) => set("country", e.target.value)}
          options={selectOptions(countries, v.country, "Select country")}
          error={err("country")}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AdminSelect
          label="Time zone"
          value={v.timezone}
          onChange={(e) => set("timezone", e.target.value)}
          options={selectOptions(zones, v.timezone, "Select time zone")}
          error={err("timezone")}
        />
        <AdminSelect
          label="Plan"
          value={v.plan_id}
          onChange={(e) => set("plan_id", e.target.value)}
          options={[
            { label: plans.length === 0 ? "No plans created yet" : "No plan", value: "" },
            ...plans.map((p) => ({ label: `${p.name} (${p.code})`, value: p.id })),
            ...(v.plan_id && !plans.some((p) => p.id === v.plan_id) ? [{ label: v.plan_id, value: v.plan_id }] : []),
          ]}
          error={err("plan_id")}
        />
        <AdminInput
          label="Seat limit"
          type="number"
          min={1}
          placeholder="e.g. 25"
          value={v.seats_limit}
          onChange={(e) => set("seats_limit", e.target.value)}
          error={err("seats_limit")}
        />
      </div>
      <AdminTextarea
        label="Notes"
        placeholder="Optional internal notes, e.g. contract reference or onboarding contact"
        value={v.notes}
        onChange={(e) => set("notes", e.target.value)}
        error={err("notes")}
      />
    </CommercialFormModal>
  );
}
