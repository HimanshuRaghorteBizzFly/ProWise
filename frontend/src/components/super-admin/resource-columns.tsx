"use client";

import React from "react";
import type {
  AdminAnnouncement,
  AdminEmailTemplate,
  AdminInvoice,
  AdminPermission,
  AdminPlan,
  AdminRole,
  AdminSubscription,
} from "@/types/admin";
import { StatusBadge, getStatusTone } from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { AdminTable, cellClass, formatInstant, formatLocalDate, formatMoney, humanize, mutedCellClass } from "./admin-resource";
import { DetailList, type AdminColumn } from "./AdminListView";

/** Jackson may emit a record's `isX` component as `is_x` or as `x`; read whichever the server sent. */
export function flag(value: { [k: string]: unknown }, snake: string, plain: string): boolean {
  return Boolean(value[snake] ?? value[plain]);
}

function status(value: string | null | undefined) {
  return value ? <StatusBadge label={humanize(value)} tone={getStatusTone(value)} dot /> : "-";
}

function list(values: string[] | null | undefined) {
  return values && values.length > 0 ? values.join(", ") : "-";
}

/* ------------------------------------------------------------------ Announcements */

export const ANNOUNCEMENT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export const announcementColumns: AdminColumn<AdminAnnouncement>[] = [
  { header: "Title", render: (a) => a.title },
  { header: "Status", render: (a) => status(a.status) },
  { header: "Type", render: (a) => humanize(a.type), className: mutedCellClass },
  { header: "Audience", render: (a) => humanize(a.target_audience), className: mutedCellClass },
  { header: "Published", render: (a) => formatInstant(a.published_at), className: `${mutedCellClass} whitespace-nowrap` },
  { header: "Expires", render: (a) => formatInstant(a.expires_at), className: `${mutedCellClass} whitespace-nowrap` },
];

export function AnnouncementDetail({ a }: { a: AdminAnnouncement }) {
  return (
    <DetailList
      fields={[
        ["Status", status(a.status)],
        ["Type", humanize(a.type)],
        ["Message", a.message],
        ["Audience", humanize(a.target_audience)],
        ["Plans", list(a.target_plans)],
        ["Organizations", list(a.target_org_ids)],
        ["Channels", list(a.channels)],
        ["Scheduled for", formatInstant(a.scheduled_for)],
        ["Published", formatInstant(a.published_at)],
        ["Expires", formatInstant(a.expires_at)],
        ["Created by", a.created_by || "-"],
        ["Created", formatInstant(a.created_at)],
        ["Updated", formatInstant(a.updated_at)],
      ]}
    />
  );
}

/* ------------------------------------------------------------------ Email templates */

export const EMAIL_TEMPLATE_STATUSES = ["ACTIVE", "DRAFT", "ARCHIVED"];

export const emailTemplateColumns: AdminColumn<AdminEmailTemplate>[] = [
  { header: "Template", render: (t) => t.name },
  { header: "Key", render: (t) => t.key, className: `${cellClass} font-mono text-[11px]` },
  { header: "Category", render: (t) => humanize(t.category), className: mutedCellClass },
  { header: "Status", render: (t) => status(t.status) },
  { header: "Subject", render: (t) => t.subject || "-", className: mutedCellClass },
  { header: "Updated", render: (t) => formatInstant(t.updated_at), className: `${mutedCellClass} whitespace-nowrap` },
];

export function EmailTemplateDetail({ t }: { t: AdminEmailTemplate }) {
  return (
    <DetailList
      fields={[
        ["Key", <span key="k" className="font-mono text-[11px]">{t.key}</span>],
        ["Status", status(t.status)],
        ["Category", humanize(t.category)],
        ["Trigger", t.trigger_description || "-"],
        ["Subject", t.subject || "-"],
        ["Headline", t.headline || "-"],
        ["Body", t.body_paragraphs || "-"],
        ["Button", t.cta_label ? `${t.cta_label}${t.cta_url ? ` (${t.cta_url})` : ""}` : "-"],
        ["Footer", t.footer_note || "-"],
        ["Variables", list(t.variables)],
        ["Updated", `${formatInstant(t.updated_at)}${t.updated_by ? ` by ${t.updated_by}` : ""}`],
      ]}
    />
  );
}

/* ------------------------------------------------------------------ Roles and permissions */

export const roleColumns: AdminColumn<AdminRole>[] = [
  { header: "Role", render: (r) => r.name },
  { header: "Scope", render: (r) => humanize(r.scope), className: mutedCellClass },
  { header: "Type", render: (r) => (flag(r as never, "is_system", "system") ? "System template" : "Custom"), className: mutedCellClass },
  { header: "Permissions", render: (r) => (r.permissions ?? []).length, className: mutedCellClass },
  { header: "Users", render: (r) => r.user_count, className: mutedCellClass },
  {
    header: "Status",
    render: (r) => {
      const active = (r as { is_active?: boolean; active?: boolean }).is_active ?? (r as { active?: boolean }).active;
      return active === undefined ? "-" : status(active ? "ACTIVE" : "INACTIVE");
    },
  },
];

export function RoleDetail({ role, catalog }: { role: AdminRole; catalog: AdminPermission[] }) {
  const labels = new Map(catalog.map((p) => [p.key, p.label]));
  const users = role.assigned_users ?? [];
  return (
    <div className="space-y-4">
      <DetailList
        fields={[
          ["Slug", <span key="s" className="font-mono text-[11px]">{role.slug}</span>],
          ["Description", role.description || "-"],
          ["Scope", humanize(role.scope)],
          ["Hierarchy", [role.hierarchy_tier, role.hierarchy_title].filter(Boolean).join(" / ") || "-"],
          ["Users", String(role.user_count)],
          ["Updated", formatInstant(role.updated_at)],
        ]}
      />
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Roles are templates: a role name grants nothing by itself. Access comes from the permissions below, checked by the
        server on every request.
      </p>
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          Permissions ({(role.permissions ?? []).length})
        </h4>
        {(role.permissions ?? []).length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)]">No permissions.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
            {role.permissions.map((key) => (
              <li key={key} className="rounded-md border border-[var(--color-border)] px-2 py-1">
                <span className="font-mono text-[11px]">{key}</span>
                {labels.get(key) && <span className="block text-[var(--color-text-muted)]">{labels.get(key)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {users.length > 0 && (
        <AdminTable label="Assigned users" headers={["Name", "Email", "Department"]}>
          {users.map((u) => (
            <tr key={u.id}>
              <td className={cellClass}>{u.name}</td>
              <td className={mutedCellClass}>{u.email}</td>
              <td className={mutedCellClass}>{u.department || "-"}</td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}

export const permissionColumns: AdminColumn<AdminPermission>[] = [
  { header: "Permission", render: (p) => p.label },
  { header: "Key", render: (p) => p.key, className: `${cellClass} font-mono text-[11px]` },
  { header: "Module", render: (p) => p.module_id, className: mutedCellClass },
  { header: "Risk", render: (p) => humanize(p.risk_level), className: mutedCellClass },
  {
    header: "Flags",
    render: (p) =>
      [
        flag(p as never, "is_sensitive", "sensitive") ? "Sensitive" : null,
        flag(p as never, "is_platform_only", "platform_only") ? "Platform only" : null,
      ]
        .filter(Boolean)
        .join(", ") || "-",
    className: mutedCellClass,
  },
];

/* ------------------------------------------------------------------ Billing (dormant) */

export const planColumns: AdminColumn<AdminPlan>[] = [
  { header: "Plan", render: (p) => p.name },
  { header: "Code", render: (p) => p.code, className: `${cellClass} font-mono text-[11px]` },
  { header: "Status", render: (p) => status(p.status) },
  { header: "Monthly", render: (p) => formatMoney(p.monthly_price, p.currency), className: mutedCellClass },
  { header: "Annual", render: (p) => formatMoney(p.annual_price, p.currency), className: mutedCellClass },
  { header: "Seats", render: (p) => p.limits?.max_seats ?? "-", className: mutedCellClass },
  { header: "Trial days", render: (p) => p.trial_days, className: mutedCellClass },
];

export function PlanDetail({ p }: { p: AdminPlan }) {
  return (
    <DetailList
      fields={[
        ["Code", <span key="c" className="font-mono text-[11px]">{p.code}</span>],
        ["Status", status(p.status)],
        ["Tagline", p.tagline || "-"],
        ["Monthly", formatMoney(p.monthly_price, p.currency)],
        ["Annual", formatMoney(p.annual_price, p.currency)],
        ["Trial days", String(p.trial_days)],
        [
          "Limits",
          p.limits
            ? `${p.limits.max_seats} seats, ${p.limits.max_projects} projects, ${p.limits.max_workspaces} workspaces, ${p.limits.storage_gb} GB`
            : "-",
        ],
        ["Features", list(p.features)],
        ["Updated", formatInstant(p.updated_at)],
      ]}
    />
  );
}

export const SUBSCRIPTION_STATUSES = ["ACTIVE", "CANCELLED"];

export const subscriptionColumns = (orgName: (id: string) => string): AdminColumn<AdminSubscription>[] => [
  { header: "Organization", render: (s) => orgName(s.org_id) },
  { header: "Plan", render: (s) => s.plan_id, className: mutedCellClass },
  { header: "Status", render: (s) => status(s.status) },
  { header: "Cycle", render: (s) => humanize(s.billing_cycle), className: mutedCellClass },
  { header: "Seats", render: (s) => s.seats, className: mutedCellClass },
  { header: "Amount", render: (s) => formatMoney(s.amount, s.currency), className: mutedCellClass },
  { header: "Period ends", render: (s) => formatInstant(s.current_period_end), className: `${mutedCellClass} whitespace-nowrap` },
];

export function SubscriptionDetail({ s, orgName }: { s: AdminSubscription; orgName: (id: string) => string }) {
  return (
    <DetailList
      fields={[
        ["Organization", orgName(s.org_id)],
        ["Plan", s.plan_id],
        ["Status", status(s.status)],
        ["Billing cycle", humanize(s.billing_cycle)],
        ["Seats", String(s.seats)],
        ["Amount", formatMoney(s.amount, s.currency)],
        ["Current period", `${formatInstant(s.current_period_start)} to ${formatInstant(s.current_period_end)}`],
        ["Auto renew", s.auto_renew ? "Yes" : "No"],
        ["Cancels at period end", s.cancel_at_period_end ? "Yes" : "No"],
        ["Payment method", s.payment_method_label || "-"],
        ["Updated", formatInstant(s.updated_at)],
      ]}
    />
  );
}

export const INVOICE_STATUSES = ["DRAFT", "OPEN", "PAID", "OVERDUE", "VOID"];

export const invoiceColumns = (orgName: (id: string) => string): AdminColumn<AdminInvoice>[] => [
  { header: "Invoice", render: (i) => i.invoice_number },
  { header: "Organization", render: (i) => orgName(i.org_id), className: mutedCellClass },
  { header: "Status", render: (i) => status(i.status) },
  { header: "Issued", render: (i) => formatLocalDate(i.issue_date), className: `${mutedCellClass} whitespace-nowrap` },
  { header: "Due", render: (i) => formatLocalDate(i.due_date), className: `${mutedCellClass} whitespace-nowrap` },
  { header: "Total", render: (i) => formatMoney(i.total), className: mutedCellClass },
];

export function InvoiceDetail({ i, orgName }: { i: AdminInvoice; orgName: (id: string) => string }) {
  const items = i.line_items ?? [];
  return (
    <div className="space-y-4">
      <DetailList
        fields={[
          ["Organization", orgName(i.org_id)],
          ["Status", status(i.status)],
          ["Issued", formatLocalDate(i.issue_date)],
          ["Due", formatLocalDate(i.due_date)],
          ["Subtotal", formatMoney(i.subtotal)],
          ["Tax", `${formatMoney(i.tax_amount)}${i.tax_rate !== null && i.tax_rate !== undefined ? ` (${i.tax_rate}%)` : ""}`],
          ["Total", formatMoney(i.total)],
          ["Paid", formatInstant(i.paid_at)],
          ["Notes", i.notes || "-"],
        ]}
      />
      {items.length > 0 && (
        <AdminTable label="Line items" headers={["Description", "Qty", "Unit price", "Total"]}>
          {items.map((li, idx) => (
            <tr key={li.id ?? idx}>
              <td className={cellClass}>{li.description}</td>
              <td className={mutedCellClass}>{li.quantity}</td>
              <td className={mutedCellClass}>{formatMoney(li.unit_price)}</td>
              <td className={mutedCellClass}>{formatMoney(li.total)}</td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
