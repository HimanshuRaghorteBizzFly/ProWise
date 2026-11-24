"use client";

import React from "react";
import { Inbox, RefreshCw } from "lucide-react";
import {
  AdminButton,
  PageHeader,
  SlideOverDrawer,
  SurfaceCard,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { AdminTable, ResourceStatus, cellClass, humanize, type ResourceState } from "./admin-resource";

export interface AdminColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

export interface AdminFilter {
  id: string;
  label: string;
  value: string;
  /** Option values; "ALL" is added automatically. */
  options: string[];
  onChange: (value: string) => void;
}

export interface AdminListViewProps<T> {
  title: string;
  description: string;
  state: ResourceState<T[]>;
  columns: AdminColumn<T>[];
  rowKey: (row: T) => string;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: React.ElementType;
  notice?: React.ReactNode;
  kpis?: React.ReactNode;
  search?: { value: string; placeholder: string; onChange: (value: string) => void };
  filters?: AdminFilter[];
  /** Opens the detail drawer for a row; the first column becomes the link. */
  onOpen?: (row: T) => void;
  detail?: {
    title: string;
    subtitle?: string;
    state: ResourceState<unknown> | null;
    onClose: () => void;
    onRetry: () => void;
    render: () => React.ReactNode;
  };
}

const inputClass =
  "h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)]";

export function AdminListView<T>(props: AdminListViewProps<T>) {
  const { title, description, state, columns, rowKey, onRetry, notice, kpis, search, filters = [], onOpen, detail } = props;
  const rows = state.status === "ready" ? state.data : [];
  const filtered = (search && search.value.trim() !== "") || filters.some((f) => f.value !== "ALL");

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        badge={state.status === "ready" ? `${rows.length} shown` : undefined}
        actions={
          <AdminButton variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </AdminButton>
        }
      />
      {notice}
      {kpis}

      {(search || filters.length > 0) && (
        <SurfaceCard className="p-3 flex flex-wrap items-end gap-2 text-xs">
          {search && (
            <label className="flex flex-col gap-1">
              <span className="text-[var(--color-text-muted)]">Search</span>
              <input
                className={`${inputClass} w-56`}
                type="search"
                value={search.value}
                placeholder={search.placeholder}
                onChange={(e) => search.onChange(e.target.value)}
              />
            </label>
          )}
          {filters.map((f) => (
            <label key={f.id} className="flex flex-col gap-1">
              <span className="text-[var(--color-text-muted)]">{f.label}</span>
              <select className={inputClass} value={f.value} onChange={(e) => f.onChange(e.target.value)}>
                <option value="ALL">All</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {humanize(o)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </SurfaceCard>
      )}

      <SurfaceCard className="overflow-hidden">
        <ResourceStatus
          state={state}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={props.emptyIcon ?? Inbox}
          emptyTitle={filtered ? "Nothing matches these filters" : props.emptyTitle}
          emptyDescription={filtered ? "Change or clear the filters to see more." : props.emptyDescription}
        />
        {rows.length > 0 && (
          <AdminTable label={title} headers={columns.map((c) => c.header)}>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-[var(--color-hover)]">
                {columns.map((col, idx) => (
                  <td key={col.header} className={col.className ?? cellClass}>
                    {idx === 0 && onOpen ? (
                      <button
                        type="button"
                        onClick={() => onOpen(row)}
                        className="text-left font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                      >
                        {col.render(row)}
                      </button>
                    ) : (
                      col.render(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </AdminTable>
        )}
      </SurfaceCard>

      {detail && (
        <SlideOverDrawer isOpen={detail.state !== null} onClose={detail.onClose} title={detail.title} subtitle={detail.subtitle}>
          {detail.state && (
            <>
              <ResourceStatus state={detail.state} isEmpty={() => false} onRetry={detail.onRetry} emptyTitle="" emptyDescription="" />
              {detail.state.status === "ready" && detail.render()}
            </>
          )}
        </SlideOverDrawer>
      )}
    </div>
  );
}

/** Label / value list for detail drawers. */
export function DetailList({ fields }: { fields: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-xs">
      {fields.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt className="text-[var(--color-text-muted)]">{label}</dt>
          <dd className="text-[var(--color-text-primary)] break-words whitespace-pre-wrap">{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
