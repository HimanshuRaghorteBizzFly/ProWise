"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  LayoutGrid,
  LifeBuoy,
  List,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import type { IncidentSeverity, IncidentStatus, OpsIncident } from "@/types/admin-operations";
import { useOperatorPermissions } from "../_services/operator-access";
import { operatorApi } from "../_services/operator-api";
import { exportRowsToCsv, formatDateTime } from "../_services/operator-service";
import {
  MutationNotice,
  NOT_AVAILABLE,
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  humanizeCode,
  operatorChoices,
  readyValue,
  rowsOf,
  useOperatorDirectory,
  useOperatorMutation,
  useOperatorResource,
} from "../_components/OperatorLive";
import {
  BulkSelectionBar,
  ConfirmModal,
  DemoDataBanner,
  FilterBar,
  KpiCard,
  OpButton,
  OpInput,
  OpModal,
  OpSelect,
  OpTextarea,
  PageHeader,
  PaginationBar,
  SlideOverDrawer,
  SortableHeader,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";

/** Kept for the "Affected Service" picker; the server has no service field yet, so the picker is disabled. */
const SERVICE_AREAS = [
  "Core Application API",
  "Primary Database Cluster",
  "Webhook Ingestion Gateway",
  "Background Sync Workers",
  "Transactional Email Relay",
  "GitHub App Connector",
];

const SEVERITY_OPTIONS: { label: string; value: IncidentSeverity }[] = [
  { label: "Sev 1 (Critical)", value: "SEV_1" },
  { label: "Sev 2 (Major)", value: "SEV_2" },
  { label: "Sev 3 (Minor)", value: "SEV_3" },
  { label: "Sev 4 (Low)", value: "SEV_4" },
];

const STATUS_OPTIONS: { label: string; value: IncidentStatus }[] = [
  { label: "Investigating", value: "INVESTIGATING" },
  { label: "Identified", value: "IDENTIFIED" },
  { label: "Monitoring", value: "MONITORING" },
  { label: "Resolved", value: "RESOLVED" },
];

/** Priority is not stored by the server; the selects stay visible but disabled. */
const PRIORITY_OPTIONS = [
  { label: "Urgent", value: "Urgent" },
  { label: "High", value: "High" },
  { label: "Medium", value: "Medium" },
  { label: "Low", value: "Low" },
];

/** Filter value meaning "any status except RESOLVED" (the server has no OPEN status). */
const OPEN_FILTER = "OPEN";

type IncidentSortField = "code" | "title" | "severity" | "priority" | "status" | "updatedAt";

function severityTone(severity: string): "danger" | "warning" | "info" | "neutral" {
  const s = (severity || "").toUpperCase();
  if (s === "SEV_1") return "danger";
  if (s === "SEV_2") return "warning";
  if (s === "SEV_3") return "info";
  return "neutral";
}

const isResolved = (inc: OpsIncident) => (inc.status || "").toUpperCase() === "RESOLVED";
const updatedOf = (inc: OpsIncident) => inc.updated_at ?? inc.created_at ?? "";
const ownerOf = (inc: OpsIncident) => inc.assigned_operator_name || "Unassigned";

export default function OperatorIncidentsPage() {
  const { can } = useOperatorPermissions();
  const canManage = can("incidents.manage");

  const incidentsResource = useOperatorResource(() => operatorApi.incidents.list(), "incidents");
  const incidents = rowsOf(incidentsResource.state);
  const directory = useOperatorDirectory();
  const operatorOptions = operatorChoices(directory.state);

  const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<IncidentSortField>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("SEV_2");
  const [assignedTo, setAssignedTo] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Manage Drawer (the record is re-read from the latest list so its version is always current)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>("INVESTIGATING");
  const [editAssignee, setEditAssignee] = useState("");
  const [updateNote, setUpdateNote] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [mitigationSteps, setMitigationSteps] = useState("");

  // Escalate confirm: kept in the page, never opened (no escalation endpoint yet).
  const [escalateTarget, setEscalateTarget] = useState<OpsIncident | null>(null);

  const assignments = useOperatorResource(
    () => (selectedId ? operatorApi.incidents.assignments(selectedId) : Promise.resolve([])),
    `incident-assignments:${selectedId ?? "none"}`
  );

  const reloadAll = () => {
    void incidentsResource.reload();
    if (selectedId) void assignments.reload();
  };
  const mutation = useOperatorMutation(reloadAll);

  const closeOverlays = () => {
    setCreateOpen(false);
    setSelectedId(null);
    setEscalateTarget(null);
  };

  const activeCount = useMemo(() => incidents.filter((i) => !isResolved(i)).length, [incidents]);
  const criticalCount = useMemo(
    () => incidents.filter((i) => !isResolved(i) && (i.severity || "").toUpperCase() === "SEV_1").length,
    [incidents]
  );
  const resolvedCount = useMemo(() => incidents.filter(isResolved).length, [incidents]);

  const handleSort = (field: IncidentSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "updatedAt" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sevRank: Record<string, number> = { SEV_1: 0, SEV_2: 1, SEV_3: 2, SEV_4: 3 };
    const list = incidents.filter((inc) => {
      const matchesQ =
        !q ||
        inc.id.toLowerCase().includes(q) ||
        (inc.title || "").toLowerCase().includes(q) ||
        (inc.description || "").toLowerCase().includes(q) ||
        ownerOf(inc).toLowerCase().includes(q) ||
        (inc.department_name || "").toLowerCase().includes(q);
      const matchesSev = severityFilter === "ALL" || inc.severity === severityFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === OPEN_FILTER ? !isResolved(inc) : inc.status === statusFilter);
      return matchesQ && matchesSev && matchesStatus;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "code") cmp = a.id.localeCompare(b.id);
      else if (sortField === "title") cmp = (a.title || "").localeCompare(b.title || "");
      else if (sortField === "severity") cmp = (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9);
      else if (sortField === "priority") cmp = 0; // priority is not stored by the server
      else if (sortField === "status") cmp = (a.status || "").localeCompare(b.status || "");
      else cmp = new Date(updatedOf(a)).getTime() - new Date(updatedOf(b)).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [incidents, search, severityFilter, statusFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, severityFilter, statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    filtered.map((i) => i.id),
    paginated.map((i) => i.id)
  );

  const handleOpenCreate = () => {
    closeOverlays();
    setTitle("");
    setSummary("");
    setSeverity("SEV_2");
    setAssignedTo("");
    setFormError(null);
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5) {
      setFormError("Please enter a clear incident title (at least 5 characters).");
      return;
    }
    if (summary.trim().length < 10) {
      setFormError("Please describe the service impact for customers.");
      return;
    }
    setFormError(null);
    const ok = await mutation.run(
      "create",
      () =>
        operatorApi.incidents.create({
          title: title.trim(),
          description: summary.trim(),
          severity,
          ...(assignedTo ? { assigned_operator_id: assignedTo } : {}),
        }),
      "Incident declared."
    );
    if (ok) setCreateOpen(false);
  };

  const openDrawer = (inc: OpsIncident) => {
    closeOverlays();
    setSelectedId(inc.id);
    setEditStatus(inc.status || "INVESTIGATING");
    setEditAssignee(inc.assigned_operator_id || "");
    setUpdateNote("");
    setResolutionNotes(inc.root_cause || "");
    setMitigationSteps(inc.mitigation_steps || "");
  };

  const liveSelected = selectedId ? incidents.find((i) => i.id === selectedId) ?? null : null;
  const assigneeChanged = Boolean(liveSelected && editAssignee && editAssignee !== (liveSelected.assigned_operator_id || ""));

  /**
   * Saves the drawer as real server calls, one after another, each with the version the previous answer returned:
   * assign (if the owner changed), then resolve (status RESOLVED) or a PATCH (status / root cause / mitigation).
   */
  const handleSaveUpdate = async () => {
    if (!liveSelected) return;
    const inc = liveSelected;
    const ok = await mutation.run(
      "update",
      async () => {
        let version = inc.version;
        if (assigneeChanged) {
          const assigned = await operatorApi.incidents.assign(inc.id, editAssignee, updateNote.trim(), version);
          version = assigned.version;
        }
        const rootCause = resolutionNotes.trim();
        const mitigation = mitigationSteps.trim();
        if (editStatus === "RESOLVED" && !isResolved(inc)) {
          await operatorApi.incidents.resolve(inc.id, { root_cause: rootCause, mitigation_steps: mitigation }, version);
          return;
        }
        const body: { status?: IncidentStatus; root_cause?: string; mitigation_steps?: string } = {};
        if (editStatus !== inc.status) body.status = editStatus as IncidentStatus;
        if (rootCause !== (inc.root_cause || "")) body.root_cause = rootCause;
        if (mitigation !== (inc.mitigation_steps || "")) body.mitigation_steps = mitigation;
        if (Object.keys(body).length > 0) await operatorApi.incidents.update(inc.id, body, version);
      },
      `Incident ${inc.id} updated.`
    );
    if (ok) setSelectedId(null);
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-incidents-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Code", "Title", "Severity", "Priority", "Status", "Service", "Assignee", "Updated At"],
      filtered.map((inc, i) => [
        i + 1,
        inc.id,
        inc.title,
        humanizeCode(inc.severity),
        "",
        humanizeCode(inc.status),
        inc.department_name ?? "",
        ownerOf(inc),
        updatedOf(inc),
      ])
    );
    toast.success(`Exported ${filtered.length} incident(s).`);
  };

  const assignmentRows = rowsOf(assignments.state);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incident Management"
        badge={`${readyValue(incidentsResource.state, () => activeCount)} Active`}
        liveData
        description="Declare service incidents, coordinate operator triage, link customer support tickets, and escalate critical outages to Super Admin."
        actions={
          <OpButton variant="primary" size="sm" disabled={!canManage} onClick={handleOpenCreate}>
            <Plus className="w-4 h-4" />
            Declare Incident
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Connected Incident Workflow"
        description="Open incidents directly from system alerts, link support tickets, resolve in bulk, or escalate critical outages cleanly."
      />

      <MutationNotice
        notice={mutation.notice}
        onReload={() => {
          mutation.clearNotice();
          reloadAll();
        }}
        onDismiss={mutation.clearNotice}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Open Incidents"
          value={readyValue(incidentsResource.state, () => activeCount)}
          sublabel="Currently under investigation or monitoring"
          icon={AlertTriangle}
          tone={activeCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Critical Severity"
          value={readyValue(incidentsResource.state, () => criticalCount)}
          sublabel="High customer-impact events (Sev 1, open)"
          icon={ShieldAlert}
          tone={criticalCount > 0 ? "rose" : "emerald"}
        />
        <KpiCard
          label="Escalated to Super Admin"
          value="—"
          sublabel={NOT_AVAILABLE}
          icon={ArrowUpRight}
          tone="violet"
        />
        <KpiCard
          label="Resolved Incidents"
          value={readyValue(incidentsResource.state, () => resolvedCount)}
          sublabel="Closed with mitigation summary"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search incident code, title, service, or assignee..."
          hasActiveFilters={Boolean(search || severityFilter !== "ALL" || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setSeverityFilter("ALL");
            setStatusFilter("ALL");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={filtered.length === 0}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <OpSelect
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  aria-label="Filter severity"
                  options={[{ label: "All Severities", value: "ALL" }, ...SEVERITY_OPTIONS]}
                />
              </div>
              <div className="w-40">
                <OpSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter status"
                  options={[
                    { label: "All Statuses", value: "ALL" },
                    { label: "Open", value: OPEN_FILTER },
                    ...STATUS_OPTIONS,
                  ]}
                />
              </div>
            </div>
          }
          rightActions={
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("TABLE")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  viewMode === "TABLE"
                    ? "bg-[#0D9488] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("CARDS")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  viewMode === "CARDS"
                    ? "bg-[#0D9488] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards
              </button>
            </div>
          }
        />

        {incidentsResource.state.status !== "ready" || incidents.length === 0 ? (
          <OperatorResourceStatus
            state={incidentsResource.state}
            isEmpty={(rows) => rows.length === 0}
            onRetry={() => void incidentsResource.reload()}
            emptyIcon={CheckCircle2}
            emptyTitle="No incidents yet"
            emptyDescription="No operational incidents are recorded on the server. Declare one when a service issue starts."
          />
        ) : paginated.length === 0 ? (
          <OperatorResourceStatus
            state={{ status: "ready", data: [] as OpsIncident[] }}
            isEmpty={() => true}
            onRetry={() => void incidentsResource.reload()}
            emptyIcon={CheckCircle2}
            emptyTitle="No incidents match your filter"
            emptyDescription="Adjust search or status filters, or declare a new operational incident."
          />
        ) : viewMode === "TABLE" ? (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((i) => i.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <NotAvailableButton variant="primary" size="xs" reason="no bulk resolve endpoint">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Resolve Selected ({selectedIds.length})
                </NotAvailableButton>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[860px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-elevated)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    <th className="py-2.5 px-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = somePageSelected;
                        }}
                        onChange={toggleSelectPage}
                        aria-label="Select all incidents on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Incident" active={sortField === "title"} direction={sortDir} onSort={() => handleSort("title")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Severity" active={sortField === "severity"} direction={sortDir} onSort={() => handleSort("severity")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Updated" active={sortField === "updatedAt"} direction={sortDir} onSort={() => handleSort("updatedAt")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((inc, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(inc.id);
                    return (
                      <tr key={inc.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(inc.id)}
                            aria-label={`Select ${inc.id}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 max-w-[320px]">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="rounded border border-[var(--color-border)] bg-[var(--color-app-bg)] px-1.5 py-0.5 text-[10px] font-bold">
                              {inc.id}
                            </span>
                          </div>
                          <p className="font-semibold text-[var(--color-text-primary)] truncate">{inc.title}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                            {inc.department_name || "—"} · Owner: {ownerOf(inc)}
                          </p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="space-y-1">
                            <StatusBadge label={humanizeCode(inc.severity)} tone={severityTone(inc.severity)} />
                            <p className="text-[10px] text-[var(--color-text-muted)]">
                              Priority: <NotAvailableText className="text-[10px]" />
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={humanizeCode(inc.status)} tone={getStatusTone(humanizeCode(inc.status))} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatDateTime(updatedOf(inc))}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <OpButton variant="outline" size="xs" onClick={() => openDrawer(inc)}>
                              <Eye className="w-3.5 h-3.5" />
                              Manage
                            </OpButton>
                            {!isResolved(inc) && (
                              <NotAvailableButton variant="subtle" size="xs" hideLabel reason="no ticket-from-incident endpoint">
                                <LifeBuoy className="w-3.5 h-3.5" />
                                Ticket
                              </NotAvailableButton>
                            )}
                            {!isResolved(inc) && (
                              <NotAvailableButton variant="danger" size="xs" hideLabel reason="no escalation endpoint">
                                Escalate
                              </NotAvailableButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)]/40 overflow-hidden">
              <div className="px-4 py-2 flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected;
                    }}
                    onChange={toggleSelectPage}
                    aria-label="Select all incidents on this page"
                    className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                  />
                  <span>Select all on page ({paginated.length})</span>
                </label>
              </div>
              <BulkSelectionBar
                selectedCount={selectedIds.length}
                totalFilteredCount={filtered.length}
                onSelectAllMatching={() => setSelectedIds(filtered.map((i) => i.id))}
                onClear={() => setSelectedIds([])}
                actions={
                  <NotAvailableButton variant="primary" size="xs" reason="no bulk resolve endpoint">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Resolve Selected ({selectedIds.length})
                  </NotAvailableButton>
                }
              />
            </div>

            {paginated.map((inc, idx) => {
              const srNo = (safePage - 1) * pageSize + idx + 1;
              const isSelected = selectedSet.has(inc.id);
              return (
                <div
                  key={inc.id}
                  className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border bg-[var(--color-app-bg)] p-4 ${
                    isSelected ? "border-teal-500 ring-1 ring-teal-500" : "border-[var(--color-border)]"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(inc.id)}
                      aria-label={`Select ${inc.id}`}
                      className="mt-1 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] accent-teal-600 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums">
                          #{srNo}
                        </span>
                        <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-semibold">
                          {inc.id}
                        </span>
                        <StatusBadge label={humanizeCode(inc.severity)} tone={severityTone(inc.severity)} />
                        <StatusBadge label={humanizeCode(inc.status)} tone={getStatusTone(humanizeCode(inc.status))} dot />
                        <StatusBadge label={`Priority: ${NOT_AVAILABLE}`} tone="neutral" />
                      </div>

                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{inc.title}</p>
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{inc.description || "—"}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Owner: <strong className="text-[var(--color-text-secondary)]">{ownerOf(inc)}</strong> · Service:{" "}
                        {inc.department_name || "—"} · Updated {formatDateTime(updatedOf(inc))}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <OpButton variant="outline" size="xs" onClick={() => openDrawer(inc)}>
                      <Eye className="w-3.5 h-3.5" />
                      Manage
                    </OpButton>
                    {!isResolved(inc) && (
                      <NotAvailableButton variant="subtle" size="xs" reason="no ticket-from-incident endpoint">
                        <LifeBuoy className="w-3.5 h-3.5" />
                        Create Ticket
                      </NotAvailableButton>
                    )}
                    {!isResolved(inc) && (
                      <NotAvailableButton variant="danger" size="xs" reason="no escalation endpoint">
                        Escalate
                      </NotAvailableButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <PaginationBar
          currentPage={safePage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </SurfaceCard>

      {/* Declare Incident Modal */}
      <OpModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Declare Operational Incident"
        description="Log a service issue so operators can coordinate triage and notify stakeholders."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <OpInput
            label="Incident Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. EU Webhook Delivery Timeout Spike"
          />

          <OpTextarea
            label="Customer Impact Summary *"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Describe which tenant actions or background queues are affected..."
            rows={3}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OpSelect
              label="Severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
              options={SEVERITY_OPTIONS}
            />
            <div title={NOT_AVAILABLE}>
              <OpSelect label="Priority" value="High" disabled onChange={() => undefined} options={PRIORITY_OPTIONS} />
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{NOT_AVAILABLE}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OpSelect
              label="Assign Operator"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              options={[{ label: "Unassigned", value: "" }, ...operatorOptions]}
            />
            <div title={NOT_AVAILABLE}>
              <OpSelect
                label="Affected Service"
                value={SERVICE_AREAS[0]}
                disabled
                onChange={() => undefined}
                options={SERVICE_AREAS.map((s) => ({ label: s, value: s }))}
              />
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{NOT_AVAILABLE}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </OpButton>
            <OpButton type="submit" variant="primary" size="sm" isLoading={mutation.busy === "create"}>
              Declare Incident
            </OpButton>
          </div>
        </form>
      </OpModal>

      {/* Manage Incident Drawer */}
      <SlideOverDrawer
        isOpen={Boolean(liveSelected)}
        onClose={() => setSelectedId(null)}
        title={liveSelected ? `${liveSelected.id} — Triage` : "Incident Triage"}
        subtitle={liveSelected?.title}
      >
        {liveSelected && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs space-y-1">
              <p className="font-semibold text-[var(--color-text-primary)]">
                Affected: {liveSelected.department_name || "—"}
              </p>
              <p className="text-[var(--color-text-secondary)]">{liveSelected.description || "—"}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <OpSelect
                label="Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                options={STATUS_OPTIONS}
              />
              <div title={NOT_AVAILABLE}>
                <OpSelect label="Priority" value="High" disabled onChange={() => undefined} options={PRIORITY_OPTIONS} />
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{NOT_AVAILABLE}</p>
              </div>
              <OpSelect
                label="Assigned To"
                value={editAssignee}
                onChange={(e) => setEditAssignee(e.target.value)}
                options={[
                  ...(liveSelected.assigned_operator_id ? [] : [{ label: "Unassigned", value: "" }]),
                  ...operatorOptions,
                  ...(liveSelected.assigned_operator_id &&
                  !operatorOptions.some((o) => o.value === liveSelected.assigned_operator_id)
                    ? [{ label: ownerOf(liveSelected), value: liveSelected.assigned_operator_id }]
                    : []),
                ]}
              />
            </div>

            <OpInput
              label="Add Timeline Progress Note (Optional)"
              value={updateNote}
              onChange={(e) => setUpdateNote(e.target.value)}
              disabled={!assigneeChanged}
              helperText={
                assigneeChanged
                  ? "Saved as the note of this assignment."
                  : `${NOT_AVAILABLE}: notes are saved only with an assignment change.`
              }
              placeholder="e.g. Replayed failed EU webhooks; delivery rate recovering..."
            />

            <OpTextarea
              label="Resolution / Post-Incident Summary"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              helperText="Saved as the incident's root cause."
              placeholder="Document final root cause and preventive verification steps..."
              rows={3}
            />

            <OpTextarea
              label="Mitigation Steps"
              value={mitigationSteps}
              onChange={(e) => setMitigationSteps(e.target.value)}
              placeholder="What was done to restore service and prevent a repeat..."
              rows={2}
            />

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                Activity Timeline ({assignments.state.status === "ready" ? assignmentRows.length : "—"})
              </p>
              <div className="max-h-44 overflow-y-auto space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs">
                {assignments.state.status !== "ready" || assignmentRows.length === 0 ? (
                  <OperatorResourceStatus
                    state={assignments.state}
                    isEmpty={(rows) => rows.length === 0}
                    onRetry={() => void assignments.reload()}
                    rows={2}
                    emptyTitle="No assignment history"
                    emptyDescription="Assignment changes for this incident appear here."
                  />
                ) : (
                  assignmentRows.map((t) => (
                    <div
                      key={t.id}
                      className="space-y-0.5 border-b last:border-b-0 border-[var(--color-border)] pb-2 last:pb-0"
                    >
                      <div className="flex justify-between gap-2 text-[11px] text-[var(--color-text-muted)]">
                        <strong className="text-[var(--color-text-secondary)]">{t.assigned_by || "—"}</strong>
                        <span>{formatDateTime(t.created_at ?? "")}</span>
                      </div>
                      <p className="text-[var(--color-text-primary)]">
                        Assigned to {t.assigned_to_name || t.assigned_to || "—"}
                        {t.notes ? `: ${t.notes}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
              {!isResolved(liveSelected) ? (
                <NotAvailableButton variant="danger" size="sm" reason="no escalation endpoint">
                  Escalate to Super Admin
                </NotAvailableButton>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <OpButton variant="outline" size="sm" onClick={() => setSelectedId(null)}>
                  Cancel
                </OpButton>
                <OpButton
                  variant="primary"
                  size="sm"
                  disabled={!canManage}
                  isLoading={mutation.busy === "update"}
                  onClick={() => void handleSaveUpdate()}
                >
                  Save Incident Update
                </OpButton>
              </div>
            </div>
          </div>
        )}
      </SlideOverDrawer>

      <ConfirmModal
        isOpen={Boolean(escalateTarget)}
        onClose={() => setEscalateTarget(null)}
        title="Escalate Incident to Super Admin?"
        description={
          escalateTarget
            ? `Escalate ${escalateTarget.id} ("${escalateTarget.title}") to Super Admin executive governance and raise priority to Urgent?`
            : ""
        }
        confirmLabel="Escalate Now"
        variant="danger"
        onConfirm={() => setEscalateTarget(null)}
      />
    </div>
  );
}
