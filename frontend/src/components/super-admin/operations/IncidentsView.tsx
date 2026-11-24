"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, Plus, ShieldAlert, UserX, Users } from "lucide-react";
import type {
  CreateIncidentBody,
  IncidentAssignment,
  IncidentSeverity,
  IncidentStatus,
  OpsIncident,
  OpsOperator,
  UpdateIncidentBody,
} from "@/types/admin-operations";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  FilterBar,
  PageHeader,
  PaginationBar,
  SlideOverDrawer,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { ResourceStatus, formatInstant, humanize, type ResourceState } from "../admin-resource";
import {
  CountKpi,
  INCIDENT_SEVERITY_OPTIONS,
  MutationNotice,
  OPERATOR_DEPARTMENTS,
  departmentLabel,
  matchesSearch,
  operatorOptions,
  paginate,
  severityTone,
  type MutationNoticeState,
} from "./shared";

const STATUS_OPTIONS = [
  { label: "Investigating", value: "INVESTIGATING" },
  { label: "Identified", value: "IDENTIFIED" },
  { label: "Monitoring", value: "MONITORING" },
];

const isActive = (i: OpsIncident) => i.status !== "RESOLVED";

export interface IncidentsViewProps {
  incidents: ResourceState<OpsIncident[]>;
  operators: ResourceState<OpsOperator[]>;
  onRetry: () => void;
  busy: string | null;
  notice: MutationNoticeState | null;
  onReload: () => void;
  onDismissNotice: () => void;
  onCreate: (body: CreateIncidentBody) => Promise<boolean>;
  onUpdate: (incident: OpsIncident, body: UpdateIncidentBody) => Promise<boolean>;
  onAssign: (incident: OpsIncident, operatorId: string, notes: string) => Promise<boolean>;
  onResolve: (incident: OpsIncident, body: { root_cause: string; mitigation_steps: string }) => Promise<boolean>;
  assignments: ResourceState<IncidentAssignment[]> | null;
  onOpenIncident: (incidentId: string | null) => void;
  onRetryAssignments: () => void;
}

export function IncidentsView(props: IncidentsViewProps) {
  const { incidents, operators, onRetry, busy, notice, onReload, onDismissNotice } = props;
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => (incidents.status === "ready" ? incidents.data : []), [incidents]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (i) =>
          matchesSearch(search, i.id, i.title, i.description, i.assigned_operator_name) &&
          (severityFilter === "ALL" || i.severity === severityFilter) &&
          (statusFilter === "ALL" || i.status === statusFilter),
      ),
    [rows, search, severityFilter, statusFilter],
  );
  const pageData = paginate(filtered, page, pageSize);
  const selected = rows.find((i) => i.id === selectedId) ?? null;

  const select = (incidentId: string | null) => {
    setSelectedId(incidentId);
    props.onOpenIncident(incidentId);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incident Governance"
        badge="Executive Oversight"
        description="Platform incidents recorded by operators: severity, ownership, assignment history and resolution notes."
        actions={
          <AdminButton variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            Declare Incident
          </AdminButton>
        }
      />

      {!selected && <MutationNotice notice={notice} onReload={onReload} onDismiss={onDismissNotice} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CountKpi state={incidents} count={(d) => d.filter(isActive).length} label="Active Incidents" sublabel="Not yet resolved" icon={AlertTriangle} tone="amber" />
        <CountKpi state={incidents} count={(d) => d.filter((i) => isActive(i) && i.severity === "SEV_1").length} label="SEV 1 Active" sublabel="Highest severity, unresolved" icon={ShieldAlert} tone="rose" />
        <CountKpi state={incidents} count={(d) => d.filter((i) => isActive(i) && !i.assigned_operator_id).length} label="Unassigned" sublabel="Active with no owner" icon={UserX} tone="violet" />
        <CountKpi state={incidents} count={(d) => d.filter((i) => !isActive(i)).length} label="Resolved" sublabel="With recorded root cause" icon={CheckCircle2} tone="emerald" />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search incident ID, title, or owner..."
          hasActiveFilters={Boolean(search || severityFilter !== "ALL" || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setSeverityFilter("ALL");
            setStatusFilter("ALL");
            setPage(1);
          }}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <AdminSelect
                  value={severityFilter}
                  onChange={(e) => {
                    setSeverityFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by severity"
                  options={[{ label: "All Severities", value: "ALL" }, ...INCIDENT_SEVERITY_OPTIONS]}
                />
              </div>
              <div className="w-40">
                <AdminSelect
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by status"
                  options={[{ label: "All Statuses", value: "ALL" }, ...STATUS_OPTIONS, { label: "Resolved", value: "RESOLVED" }]}
                />
              </div>
            </div>
          }
        />

        <ResourceStatus
          state={incidents}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={CheckCircle2}
          emptyTitle="No incidents recorded"
          emptyDescription="No platform incidents have been declared."
        />

        {incidents.status === "ready" && incidents.data.length > 0 && (
          <>
            {pageData.rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--color-text-secondary)]">No incidents match your filters.</p>
            ) : (
              <div className="space-y-3">
                {pageData.rows.map((inc) => (
                  <div
                    key={inc.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-primary)]">
                          {inc.id}
                        </span>
                        <StatusBadge label={humanize(inc.severity)} tone={severityTone(inc.severity)} />
                        <StatusBadge label={humanize(inc.status)} tone={getStatusTone(inc.status)} dot />
                        <StatusBadge label={inc.department_name || departmentLabel(inc.department_id)} tone="neutral" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{inc.title}</p>
                      {inc.description && (
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{inc.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)] pt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Owner:{" "}
                          <strong className="text-[var(--color-text-secondary)]">
                            {inc.assigned_operator_id ? inc.assigned_operator_name || inc.assigned_operator_id : "Unassigned"}
                          </strong>
                        </span>
                        <span>Opened {formatInstant(inc.created_at)}</span>
                        <span>Updated {formatInstant(inc.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <AdminButton variant="outline" size="xs" onClick={() => select(inc.id)}>
                        <Eye className="w-3.5 h-3.5" />
                        Manage Oversight
                      </AdminButton>
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

      <DeclareIncidentModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        operators={operators}
        busy={busy === "create"}
        onSubmit={async (body) => {
          if (await props.onCreate(body)) setCreateOpen(false);
        }}
      />

      <IncidentDrawer
        incident={selected}
        onClose={() => select(null)}
        operators={operators}
        busy={busy}
        notice={notice}
        onReload={onReload}
        onDismissNotice={onDismissNotice}
        assignments={props.assignments}
        onRetryAssignments={props.onRetryAssignments}
        onUpdate={props.onUpdate}
        onAssign={props.onAssign}
        onResolve={props.onResolve}
      />
    </div>
  );
}

function DeclareIncidentModal({
  isOpen,
  onClose,
  operators,
  busy,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  operators: ResourceState<OpsOperator[]>;
  busy: boolean;
  onSubmit: (body: CreateIncidentBody) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("SEV_2");
  const [department, setDepartment] = useState("platform-operations");
  const [owner, setOwner] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setDescription("");
    setSeverity("SEV_2");
    setDepartment("platform-operations");
    setOwner("");
    setFormError(null);
  }, [isOpen]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5) {
      setFormError("Please provide a clear incident headline (at least 5 characters).");
      return;
    }
    onSubmit({
      title: title.trim(),
      severity,
      department_id: department,
      assigned_operator_id: owner || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <AdminModal isOpen={isOpen} onClose={onClose} title="Declare Platform Incident" description="Record a platform issue, its severity and an accountable owner." maxWidth="lg">
      <form onSubmit={submit} className="space-y-4">
        {formError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{formError}</div>
        )}
        <AdminInput label="Incident Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <AdminTextarea label="Impact Summary" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <AdminSelect label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)} options={INCIDENT_SEVERITY_OPTIONS} />
          <AdminSelect label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} options={OPERATOR_DEPARTMENTS} />
          <AdminSelect
            label="Accountable Owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            options={[{ label: operators.status === "loading" ? "Loading operators..." : "Unassigned", value: "" }, ...operatorOptions(operators)]}
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
          <AdminButton type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" variant="primary" size="sm" isLoading={busy}>
            Declare Incident
          </AdminButton>
        </div>
      </form>
    </AdminModal>
  );
}

function IncidentDrawer({
  incident,
  onClose,
  operators,
  busy,
  notice,
  onReload,
  onDismissNotice,
  assignments,
  onRetryAssignments,
  onUpdate,
  onAssign,
  onResolve,
}: {
  incident: OpsIncident | null;
  onClose: () => void;
  operators: ResourceState<OpsOperator[]>;
  busy: string | null;
  notice: MutationNoticeState | null;
  onReload: () => void;
  onDismissNotice: () => void;
  assignments: ResourceState<IncidentAssignment[]> | null;
  onRetryAssignments: () => void;
  onUpdate: IncidentsViewProps["onUpdate"];
  onAssign: IncidentsViewProps["onAssign"];
  onResolve: IncidentsViewProps["onResolve"];
}) {
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("SEV_2");
  const [status, setStatus] = useState<IncidentStatus>("INVESTIGATING");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [mitigation, setMitigation] = useState("");

  // Reset the form whenever another record (or a newer version of it) is shown.
  const key = incident ? `${incident.id}:${incident.version ?? ""}:${incident.updated_at ?? ""}` : "";
  useEffect(() => {
    if (!incident) return;
    setTitle(incident.title);
    setSeverity(incident.severity as IncidentSeverity);
    setStatus((incident.status === "RESOLVED" ? "MONITORING" : incident.status) as IncidentStatus);
    setDescription(incident.description ?? "");
    setAssignee("");
    setAssignNotes("");
    setRootCause(incident.root_cause ?? "");
    setMitigation(incident.mitigation_steps ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const resolved = incident?.status === "RESOLVED";

  return (
    <SlideOverDrawer isOpen={Boolean(incident)} onClose={onClose} title={incident ? `${incident.id} Governance` : "Incident Oversight"} subtitle={incident?.title}>
      {incident && (
        <div className="space-y-5">
          <MutationNotice notice={notice} onReload={onReload} onDismiss={onDismissNotice} />

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs space-y-1">
            <p className="font-semibold text-[var(--color-text-primary)]">Reported Impact</p>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">{incident.description || "No summary recorded."}</p>
            <p className="text-[11px] text-[var(--color-text-muted)] pt-1">
              Opened {formatInstant(incident.created_at)} · {incident.department_name || departmentLabel(incident.department_id)}
              {incident.resolved_at ? ` · Resolved ${formatInstant(incident.resolved_at)}` : ""}
            </p>
          </div>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">Details</h4>
            <AdminInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={resolved} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AdminSelect label="Severity Classification" value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)} options={INCIDENT_SEVERITY_OPTIONS} disabled={resolved} />
              <AdminSelect label="Incident Status" value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus)} options={STATUS_OPTIONS} disabled={resolved} />
            </div>
            <AdminTextarea label="Impact Summary" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={resolved} />
            {!resolved && (
              <div className="flex justify-end">
                <AdminButton
                  size="sm"
                  isLoading={busy === `update:${incident.id}`}
                  disabled={title.trim().length < 5}
                  onClick={() => void onUpdate(incident, { title: title.trim(), severity, status, description: description.trim() })}
                >
                  Save Details
                </AdminButton>
              </div>
            )}
          </section>

          {!resolved && (
            <section className="space-y-3 border-t border-[var(--color-border)] pt-4">
              <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">
                Owner: {incident.assigned_operator_id ? incident.assigned_operator_name || incident.assigned_operator_id : "Unassigned"}
              </h4>
              <AdminSelect
                label="Assign To"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                options={[{ label: operators.status === "error" ? "Operators could not be loaded" : "Select an operator", value: "" }, ...operatorOptions(operators)]}
              />
              <AdminTextarea label="Handover Notes" value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} rows={2} />
              <div className="flex justify-end">
                <AdminButton size="sm" variant="secondary" disabled={!assignee} isLoading={busy === `assign:${incident.id}`} onClick={() => void onAssign(incident, assignee, assignNotes.trim())}>
                  Assign Owner
                </AdminButton>
              </div>
            </section>
          )}

          <section className="space-y-3 border-t border-[var(--color-border)] pt-4">
            <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">{resolved ? "Resolution Record" : "Resolve Incident"}</h4>
            <AdminTextarea label="Root Cause" value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={3} disabled={resolved} />
            <AdminTextarea label="Mitigation Steps" value={mitigation} onChange={(e) => setMitigation(e.target.value)} rows={3} disabled={resolved} />
            {!resolved && (
              <div className="flex justify-end">
                <AdminButton
                  size="sm"
                  variant="primary"
                  disabled={rootCause.trim().length === 0}
                  isLoading={busy === `resolve:${incident.id}`}
                  onClick={() => void onResolve(incident, { root_cause: rootCause.trim(), mitigation_steps: mitigation.trim() })}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Resolved
                </AdminButton>
              </div>
            )}
          </section>

          <section className="space-y-2 border-t border-[var(--color-border)] pt-4">
            <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">Assignment History</h4>
            {assignments && (
              <ResourceStatus
                state={assignments}
                isEmpty={(d) => d.length === 0}
                onRetry={onRetryAssignments}
                emptyIcon={Users}
                emptyTitle="No assignments yet"
                emptyDescription="Owner changes made through Assign Owner are listed here."
              />
            )}
            {assignments?.status === "ready" && assignments.data.length > 0 && (
              <ul className="space-y-2">
                {assignments.data.map((a) => (
                  <li key={a.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5 text-xs">
                    <p className="text-[var(--color-text-primary)]">
                      Assigned to <strong>{a.assigned_to_name || a.assigned_to || "-"}</strong> by {a.assigned_by || "-"}
                    </p>
                    {a.notes && <p className="text-[var(--color-text-secondary)] mt-0.5">{a.notes}</p>}
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{formatInstant(a.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </SlideOverDrawer>
  );
}
