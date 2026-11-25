"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Ban, CalendarClock, CheckCircle2, Pencil, Play, Plus, Wrench } from "lucide-react";
import type { CreateMaintenanceBody, OpsMaintenanceWindow, UpdateMaintenanceBody } from "@/types/admin-operations";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  ConfirmActionModal,
  FilterBar,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { ResourceStatus, formatInstant, humanize, type ResourceState } from "../admin-resource";
import {
  CountKpi,
  MutationNotice,
  OPERATOR_DEPARTMENTS,
  departmentLabel,
  instantToLocalInput,
  localInputToInstant,
  matchesSearch,
  paginate,
  type MutationNoticeState,
} from "./shared";

const STATUS_FILTERS = [
  { label: "All Statuses", value: "ALL" },
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

type Transition = { window: OpsMaintenanceWindow; to: "IN_PROGRESS" | "COMPLETED" | "CANCELLED" };

const TRANSITION_COPY: Record<Transition["to"], { title: string; label: string; description: string }> = {
  IN_PROGRESS: { title: "Start Maintenance Window?", label: "Start Now", description: "The window is marked in progress and its actual start time is recorded now." },
  COMPLETED: { title: "Complete Maintenance Window?", label: "Mark Completed", description: "The window is marked completed and its actual end time is recorded now." },
  CANCELLED: { title: "Cancel Maintenance Window?", label: "Cancel Window", description: "The scheduled window is cancelled. This is recorded in the operator activity log." },
};

export interface MaintenanceViewProps {
  windows: ResourceState<OpsMaintenanceWindow[]>;
  onRetry: () => void;
  busy: string | null;
  notice: MutationNoticeState | null;
  onReload: () => void;
  onDismissNotice: () => void;
  onCreate: (body: CreateMaintenanceBody) => Promise<boolean>;
  onUpdate: (window: OpsMaintenanceWindow, body: UpdateMaintenanceBody) => Promise<boolean>;
}

export function MaintenanceView(props: MaintenanceViewProps) {
  const { windows, onRetry, busy, notice, onReload, onDismissNotice } = props;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editor, setEditor] = useState<{ mode: "create" } | { mode: "edit"; window: OpsMaintenanceWindow } | null>(null);
  const [transition, setTransition] = useState<Transition | null>(null);

  const rows = useMemo(() => (windows.status === "ready" ? windows.data : []), [windows]);
  const filtered = useMemo(
    () => rows.filter((w) => matchesSearch(search, w.id, w.title, w.description) && (statusFilter === "ALL" || w.status === statusFilter)),
    [rows, search, statusFilter],
  );
  const pageData = paginate(filtered, page, pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Mode"
        badge="Platform Authority"
        description="Schedule platform maintenance windows, start and complete them, and keep the maintenance record accurate."
        actions={
          <AdminButton variant="primary" size="sm" onClick={() => setEditor({ mode: "create" })}>
            <Plus className="w-4 h-4" />
            Schedule Maintenance
          </AdminButton>
        }
      />

      <MutationNotice notice={notice} onReload={onReload} onDismiss={onDismissNotice} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CountKpi state={windows} count={(d) => d.filter((w) => w.status === "IN_PROGRESS").length} label="Active Maintenance" sublabel="Currently in progress" icon={Wrench} tone="amber" />
        <CountKpi state={windows} count={(d) => d.filter((w) => w.status === "SCHEDULED").length} label="Scheduled" sublabel="Planned windows" icon={CalendarClock} tone="blue" />
        <CountKpi state={windows} count={(d) => d.filter((w) => w.status === "COMPLETED").length} label="Completed" sublabel="Finished windows" icon={CheckCircle2} tone="emerald" />
        <CountKpi state={windows} count={(d) => d.filter((w) => w.status === "CANCELLED").length} label="Cancelled" sublabel="Called off before starting" icon={Ban} tone="slate" />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search maintenance title or ID..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
            setPage(1);
          }}
          filters={
            <div className="w-40">
              <AdminSelect
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by status"
                options={STATUS_FILTERS}
              />
            </div>
          }
        />

        <ResourceStatus
          state={windows}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={CalendarClock}
          emptyTitle="No maintenance windows"
          emptyDescription="No maintenance has been scheduled yet."
        />

        {windows.status === "ready" && windows.data.length > 0 && (
          <>
            {pageData.rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--color-text-secondary)]">No maintenance windows match your filters.</p>
            ) : (
              <div className="space-y-3">
                {pageData.rows.map((w) => (
                  <div key={w.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-semibold">{w.id}</span>
                        <StatusBadge label={humanize(w.status)} tone={w.status === "IN_PROGRESS" ? "warning" : getStatusTone(w.status === "COMPLETED" ? "RESOLVED" : w.status)} dot />
                        <StatusBadge label={departmentLabel(w.department_id)} tone="neutral" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{w.title}</p>
                      {w.description && <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{w.description}</p>}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)] pt-0.5">
                        <span>
                          Planned {formatInstant(w.scheduled_start)} to {formatInstant(w.scheduled_end)}
                        </span>
                        {w.actual_start && <span>Started {formatInstant(w.actual_start)}</span>}
                        {w.actual_end && <span>Ended {formatInstant(w.actual_end)}</span>}
                        {w.created_by && <span>Created by {w.created_by}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {w.status === "SCHEDULED" && (
                        <>
                          <AdminButton size="xs" variant="outline" disabled={Boolean(busy)} onClick={() => setEditor({ mode: "edit", window: w })}>
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </AdminButton>
                          <AdminButton size="xs" variant="primary" disabled={Boolean(busy)} isLoading={busy === `update:${w.id}`} onClick={() => setTransition({ window: w, to: "IN_PROGRESS" })}>
                            <Play className="w-3.5 h-3.5" />
                            Start
                          </AdminButton>
                          <AdminButton size="xs" variant="danger" disabled={Boolean(busy)} onClick={() => setTransition({ window: w, to: "CANCELLED" })}>
                            <Ban className="w-3.5 h-3.5" />
                            Cancel
                          </AdminButton>
                        </>
                      )}
                      {w.status === "IN_PROGRESS" && (
                        <AdminButton size="xs" variant="primary" disabled={Boolean(busy)} isLoading={busy === `update:${w.id}`} onClick={() => setTransition({ window: w, to: "COMPLETED" })}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Complete
                        </AdminButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <PaginationBar
              currentPage={pageData.page}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </>
        )}
      </SurfaceCard>

      <MaintenanceEditor
        editor={editor}
        busy={busy}
        onClose={() => setEditor(null)}
        onCreate={async (body) => {
          if (await props.onCreate(body)) setEditor(null);
        }}
        onUpdate={async (w, body) => {
          if (await props.onUpdate(w, body)) setEditor(null);
        }}
      />

      <ConfirmActionModal
        isOpen={Boolean(transition)}
        onClose={() => setTransition(null)}
        onConfirm={() => transition && void props.onUpdate(transition.window, { status: transition.to })}
        title={transition ? TRANSITION_COPY[transition.to].title : ""}
        description={transition ? `${transition.window.title}: ${TRANSITION_COPY[transition.to].description}` : ""}
        confirmLabel={transition ? TRANSITION_COPY[transition.to].label : "Confirm"}
        variant={transition?.to === "CANCELLED" ? "danger" : "primary"}
      />
    </div>
  );
}

function MaintenanceEditor({
  editor,
  busy,
  onClose,
  onCreate,
  onUpdate,
}: {
  editor: { mode: "create" } | { mode: "edit"; window: OpsMaintenanceWindow } | null;
  busy: string | null;
  onClose: () => void;
  onCreate: (body: CreateMaintenanceBody) => void;
  onUpdate: (w: OpsMaintenanceWindow, body: UpdateMaintenanceBody) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("platform-operations");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;
    const w = editor.mode === "edit" ? editor.window : null;
    setTitle(w?.title ?? "");
    setDescription(w?.description ?? "");
    setDepartment(w?.department_id ?? "platform-operations");
    setStart(instantToLocalInput(w?.scheduled_start));
    setEnd(instantToLocalInput(w?.scheduled_end));
    setFormError(null);
  }, [editor]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      setFormError("Please give the maintenance window a title.");
      return;
    }
    const startAt = localInputToInstant(start);
    const endAt = localInputToInstant(end);
    if (!startAt || !endAt) {
      setFormError("Please choose both a start and an end time.");
      return;
    }
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      setFormError("The end time must be after the start time.");
      return;
    }
    if (editor?.mode === "edit") {
      onUpdate(editor.window, { title: title.trim(), description: description.trim(), scheduled_start: startAt, scheduled_end: endAt });
    } else {
      onCreate({ title: title.trim(), description: description.trim() || undefined, department_id: department, scheduled_start: startAt, scheduled_end: endAt });
    }
  };

  const isEdit = editor?.mode === "edit";
  return (
    <AdminModal
      isOpen={Boolean(editor)}
      onClose={onClose}
      title={isEdit ? "Edit Maintenance Window" : "Schedule Planned Maintenance Window"}
      description="Times are entered in your local time zone and stored as UTC instants."
      maxWidth="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        {formError && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{formError}</div>}
        <AdminInput label="Maintenance Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <AdminTextarea label="Scope & Justification" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        {!isEdit && <AdminSelect label="Owning Department" value={department} onChange={(e) => setDepartment(e.target.value)} options={OPERATOR_DEPARTMENTS} />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AdminInput label="Scheduled Start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          <AdminInput label="Scheduled End" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
          <AdminButton type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" variant="primary" size="sm" isLoading={isEdit ? busy === `edit:${editor.window.id}` : busy === "create"}>
            {isEdit ? "Save Changes" : "Schedule Window"}
          </AdminButton>
        </div>
      </form>
    </AdminModal>
  );
}
