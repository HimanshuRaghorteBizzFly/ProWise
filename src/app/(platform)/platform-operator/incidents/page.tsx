"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { OperatorIncident } from "../_types";
import { exportRowsToCsv, formatDateTime } from "../_services/operator-service";
import {
  BulkSelectionBar,
  ConfirmModal,
  DemoDataBanner,
  EmptyState,
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

const OPERATOR_NAMES = ["Alex Rivera", "Priya Nair", "Marcus Chen", "Elena Brooks"];
const SERVICE_AREAS = [
  "Core Application API",
  "Primary Database Cluster",
  "Webhook Ingestion Gateway",
  "Background Sync Workers",
  "Transactional Email Relay",
  "GitHub App Connector",
];

type IncidentSortField = "code" | "title" | "severity" | "priority" | "status" | "updatedAt";

export default function OperatorIncidentsPage() {
  const incidents = usePlatformOperatorStore((s) => s.incidents);
  const createIncident = usePlatformOperatorStore((s) => s.createIncident);
  const updateIncident = usePlatformOperatorStore((s) => s.updateIncident);
  const escalateIncident = usePlatformOperatorStore((s) => s.escalateIncident);
  const createTicketFromIncident = usePlatformOperatorStore((s) => s.createTicketFromIncident);
  const bulkResolveIncidents = usePlatformOperatorStore((s) => s.bulkResolveIncidents);
  const { can } = useOperatorPermissions();
  const canManage = can("incidents.manage");

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
  const [severity, setSeverity] = useState<OperatorIncident["severity"]>("Major");
  const [priority, setPriority] = useState<OperatorIncident["priority"]>("High");
  const [assignedTo, setAssignedTo] = useState(OPERATOR_NAMES[0]);
  const [affectedService, setAffectedService] = useState(SERVICE_AREAS[0]);
  const [formError, setFormError] = useState<string | null>(null);

  // Manage Drawer
  const [selected, setSelected] = useState<OperatorIncident | null>(null);
  const [editStatus, setEditStatus] = useState<OperatorIncident["status"]>("Investigating");
  const [editPriority, setEditPriority] = useState<OperatorIncident["priority"]>("High");
  const [editAssignee, setEditAssignee] = useState("");
  const [updateNote, setUpdateNote] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Escalate confirm (non-overlapping with drawer/create)
  const [escalateTarget, setEscalateTarget] = useState<OperatorIncident | null>(null);

  const closeOverlays = () => {
    setCreateOpen(false);
    setSelected(null);
    setEscalateTarget(null);
  };

  const activeCount = useMemo(
    () => incidents.filter((i) => i.status !== "Resolved").length,
    [incidents]
  );
  const criticalCount = useMemo(
    () => incidents.filter((i) => i.status !== "Resolved" && i.severity === "Critical").length,
    [incidents]
  );
  const escalatedCount = useMemo(
    () => incidents.filter((i) => i.escalatedToSuperAdmin).length,
    [incidents]
  );
  const resolvedCount = useMemo(
    () => incidents.filter((i) => i.status === "Resolved").length,
    [incidents]
  );

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
    const sevRank: Record<string, number> = { Critical: 0, Major: 1, Minor: 2 };
    const priRank: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
    const list = incidents.filter((inc) => {
      const matchesQ =
        !q ||
        inc.code.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.summary.toLowerCase().includes(q) ||
        inc.assignedTo.toLowerCase().includes(q) ||
        inc.affectedService.toLowerCase().includes(q);
      const matchesSev = severityFilter === "ALL" || inc.severity === severityFilter;
      const matchesStatus = statusFilter === "ALL" || inc.status === statusFilter;
      return matchesQ && matchesSev && matchesStatus;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "code") cmp = a.code.localeCompare(b.code);
      else if (sortField === "title") cmp = a.title.localeCompare(b.title);
      else if (sortField === "severity") cmp = (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9);
      else if (sortField === "priority") cmp = (priRank[a.priority] ?? 9) - (priRank[b.priority] ?? 9);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
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
    setSeverity("Major");
    setPriority("High");
    setAssignedTo(OPERATOR_NAMES[0]);
    setAffectedService(SERVICE_AREAS[0]);
    setFormError(null);
    setCreateOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5) {
      setFormError("Please enter a clear incident title (at least 5 characters).");
      return;
    }
    if (summary.trim().length < 10) {
      setFormError("Please describe the service impact for customers.");
      return;
    }
    const created = createIncident({
      title: title.trim(),
      summary: summary.trim(),
      severity,
      priority,
      assignedTo,
      affectedService,
    });
    toast.success(`Incident ${created.code} created and assigned to ${assignedTo}.`);
    setCreateOpen(false);
  };

  const openDrawer = (inc: OperatorIncident) => {
    closeOverlays();
    setSelected(inc);
    setEditStatus(inc.status);
    setEditPriority(inc.priority);
    setEditAssignee(inc.assignedTo);
    setUpdateNote("");
    setResolutionNotes(inc.resolutionNotes || "");
  };

  const openEscalate = (inc: OperatorIncident) => {
    closeOverlays();
    setEscalateTarget(inc);
  };

  const handleSaveUpdate = () => {
    if (!selected) return;
    updateIncident(
      selected.id,
      {
        status: editStatus,
        priority: editPriority,
        assignedTo: editAssignee,
        resolutionNotes: resolutionNotes.trim() || undefined,
      },
      updateNote.trim() || `Status updated to ${editStatus} (Assigned: ${editAssignee}).`
    );
    toast.success(`Incident ${selected.code} updated.`);
    setSelected(null);
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-incidents-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Code", "Title", "Severity", "Priority", "Status", "Service", "Assignee", "Updated At"],
      filtered.map((inc, i) => [
        i + 1,
        inc.code,
        inc.title,
        inc.severity,
        inc.priority,
        inc.status,
        inc.affectedService,
        inc.assignedTo,
        inc.updatedAt,
      ])
    );
    toast.success(`Exported ${filtered.length} incident(s).`);
  };

  const liveSelected = selected ? incidents.find((i) => i.id === selected.id) || selected : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incident Management"
        badge={`${activeCount} Active`}
        demoLabel="Demo Operations"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Open Incidents"
          value={activeCount}
          sublabel="Currently under investigation or monitoring"
          icon={AlertTriangle}
          tone={activeCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Critical Severity"
          value={criticalCount}
          sublabel="High customer-impact events"
          icon={ShieldAlert}
          tone={criticalCount > 0 ? "rose" : "emerald"}
        />
        <KpiCard
          label="Escalated to Super Admin"
          value={escalatedCount}
          sublabel="Flagged for governance visibility"
          icon={ArrowUpRight}
          tone="violet"
        />
        <KpiCard
          label="Resolved Incidents"
          value={resolvedCount}
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
                  options={[
                    { label: "All Severities", value: "ALL" },
                    { label: "Critical", value: "Critical" },
                    { label: "Major", value: "Major" },
                    { label: "Minor", value: "Minor" },
                  ]}
                />
              </div>
              <div className="w-40">
                <OpSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter status"
                  options={[
                    { label: "All Statuses", value: "ALL" },
                    { label: "Open", value: "Open" },
                    { label: "Investigating", value: "Investigating" },
                    { label: "Identified", value: "Identified" },
                    { label: "Monitoring", value: "Monitoring" },
                    { label: "Resolved", value: "Resolved" },
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

        {paginated.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No incidents match your filter"
            description="Adjust search or status filters, or declare a new operational incident."
          />
        ) : viewMode === "TABLE" ? (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((i) => i.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="primary"
                  size="xs"
                  disabled={!canManage}
                  onClick={() => {
                    const count = bulkResolveIncidents(selectedIds);
                    toast.success(`Resolved ${count} selected incident(s).`);
                    setSelectedIds([]);
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Resolve Selected ({selectedIds.length})
                </OpButton>
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
                            aria-label={`Select ${inc.code}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 max-w-[320px]">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="rounded border border-[var(--color-border)] bg-[var(--color-app-bg)] px-1.5 py-0.5 text-[10px] font-bold">
                              {inc.code}
                            </span>
                            {inc.escalatedToSuperAdmin && (
                              <StatusBadge label="Super Admin Escalated" tone="violet" />
                            )}
                          </div>
                          <p className="font-semibold text-[var(--color-text-primary)] truncate">{inc.title}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                            {inc.affectedService} · Owner: {inc.assignedTo}
                          </p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="space-y-1">
                            <StatusBadge
                              label={inc.severity}
                              tone={inc.severity === "Critical" ? "danger" : inc.severity === "Major" ? "warning" : "info"}
                            />
                            <p className="text-[10px] text-[var(--color-text-muted)]">Priority: {inc.priority}</p>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={inc.status} tone={getStatusTone(inc.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatDateTime(inc.updatedAt)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <OpButton variant="outline" size="xs" onClick={() => openDrawer(inc)}>
                              <Eye className="w-3.5 h-3.5" />
                              Manage
                            </OpButton>
                            {!inc.linkedTicketId && inc.status !== "Resolved" && (
                              <OpButton
                                variant="subtle"
                                size="xs"
                                disabled={!canManage}
                                onClick={() => {
                                  const tkt = createTicketFromIncident(inc.id);
                                  if (tkt) toast.success(`Linked support ticket ${tkt.ticketNumber} created.`);
                                }}
                              >
                                <LifeBuoy className="w-3.5 h-3.5" />
                                Ticket
                              </OpButton>
                            )}
                            {!inc.escalatedToSuperAdmin && inc.status !== "Resolved" && (
                              <OpButton
                                variant="danger"
                                size="xs"
                                disabled={!canManage}
                                onClick={() => openEscalate(inc)}
                              >
                                Escalate
                              </OpButton>
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
                  <OpButton
                    variant="primary"
                    size="xs"
                    disabled={!canManage}
                    onClick={() => {
                      const count = bulkResolveIncidents(selectedIds);
                      toast.success(`Resolved ${count} selected incident(s).`);
                      setSelectedIds([]);
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Resolve Selected ({selectedIds.length})
                  </OpButton>
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
                      aria-label={`Select ${inc.code}`}
                      className="mt-1 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] accent-teal-600 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums">
                          #{srNo}
                        </span>
                        <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-semibold">
                          {inc.code}
                        </span>
                        <StatusBadge
                          label={inc.severity}
                          tone={inc.severity === "Critical" ? "danger" : inc.severity === "Major" ? "warning" : "info"}
                        />
                        <StatusBadge label={inc.status} tone={getStatusTone(inc.status)} dot />
                        <StatusBadge label={`Priority: ${inc.priority}`} tone="neutral" />
                        {inc.escalatedToSuperAdmin && (
                          <StatusBadge label="Escalated to Super Admin" tone="violet" />
                        )}
                      </div>

                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{inc.title}</p>
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{inc.summary}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Owner: <strong className="text-[var(--color-text-secondary)]">{inc.assignedTo}</strong> · Service:{" "}
                        {inc.affectedService} · Updated {formatDateTime(inc.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <OpButton variant="outline" size="xs" onClick={() => openDrawer(inc)}>
                      <Eye className="w-3.5 h-3.5" />
                      Manage
                    </OpButton>
                    {!inc.linkedTicketId && inc.status !== "Resolved" && (
                      <OpButton
                        variant="subtle"
                        size="xs"
                        disabled={!canManage}
                        onClick={() => {
                          const tkt = createTicketFromIncident(inc.id);
                          if (tkt) toast.success(`Linked support ticket ${tkt.ticketNumber} created.`);
                        }}
                      >
                        <LifeBuoy className="w-3.5 h-3.5" />
                        Create Ticket
                      </OpButton>
                    )}
                    {!inc.escalatedToSuperAdmin && inc.status !== "Resolved" && (
                      <OpButton
                        variant="danger"
                        size="xs"
                        disabled={!canManage}
                        onClick={() => openEscalate(inc)}
                      >
                        Escalate
                      </OpButton>
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
              onChange={(e) => setSeverity(e.target.value as OperatorIncident["severity"])}
              options={[
                { label: "Critical", value: "Critical" },
                { label: "Major", value: "Major" },
                { label: "Minor", value: "Minor" },
              ]}
            />
            <OpSelect
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as OperatorIncident["priority"])}
              options={[
                { label: "Urgent", value: "Urgent" },
                { label: "High", value: "High" },
                { label: "Medium", value: "Medium" },
                { label: "Low", value: "Low" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OpSelect
              label="Assign Operator"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              options={OPERATOR_NAMES.map((n) => ({ label: n, value: n }))}
            />
            <OpSelect
              label="Affected Service"
              value={affectedService}
              onChange={(e) => setAffectedService(e.target.value)}
              options={SERVICE_AREAS.map((s) => ({ label: s, value: s }))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </OpButton>
            <OpButton type="submit" variant="primary" size="sm">
              Declare Incident
            </OpButton>
          </div>
        </form>
      </OpModal>

      {/* Manage Incident Drawer */}
      <SlideOverDrawer
        isOpen={Boolean(liveSelected)}
        onClose={() => setSelected(null)}
        title={liveSelected ? `${liveSelected.code} — Triage` : "Incident Triage"}
        subtitle={liveSelected?.title}
      >
        {liveSelected && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs space-y-1">
              <p className="font-semibold text-[var(--color-text-primary)]">
                Affected: {liveSelected.affectedService}
              </p>
              <p className="text-[var(--color-text-secondary)]">{liveSelected.summary}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <OpSelect
                label="Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as OperatorIncident["status"])}
                options={[
                  { label: "Open", value: "Open" },
                  { label: "Investigating", value: "Investigating" },
                  { label: "Identified", value: "Identified" },
                  { label: "Monitoring", value: "Monitoring" },
                  { label: "Resolved", value: "Resolved" },
                ]}
              />
              <OpSelect
                label="Priority"
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as OperatorIncident["priority"])}
                options={[
                  { label: "Urgent", value: "Urgent" },
                  { label: "High", value: "High" },
                  { label: "Medium", value: "Medium" },
                  { label: "Low", value: "Low" },
                ]}
              />
              <OpSelect
                label="Assigned To"
                value={editAssignee}
                onChange={(e) => setEditAssignee(e.target.value)}
                options={OPERATOR_NAMES.map((n) => ({ label: n, value: n }))}
              />
            </div>

            <OpInput
              label="Add Timeline Progress Note (Optional)"
              value={updateNote}
              onChange={(e) => setUpdateNote(e.target.value)}
              placeholder="e.g. Replayed failed EU webhooks; delivery rate recovering..."
            />

            <OpTextarea
              label="Resolution / Post-Incident Summary"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Document final root cause and preventive verification steps..."
              rows={3}
            />

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                Activity Timeline ({liveSelected.timeline.length})
              </p>
              <div className="max-h-44 overflow-y-auto space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs">
                {liveSelected.timeline.map((t) => (
                  <div
                    key={t.id}
                    className="space-y-0.5 border-b last:border-b-0 border-[var(--color-border)] pb-2 last:pb-0"
                  >
                    <div className="flex justify-between gap-2 text-[11px] text-[var(--color-text-muted)]">
                      <strong className="text-[var(--color-text-secondary)]">{t.actor}</strong>
                      <span>{formatDateTime(t.at)}</span>
                    </div>
                    <p className="text-[var(--color-text-primary)]">{t.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
              {!liveSelected.escalatedToSuperAdmin && liveSelected.status !== "Resolved" ? (
                <OpButton
                  variant="danger"
                  size="sm"
                  disabled={!canManage}
                  onClick={() => openEscalate(liveSelected)}
                >
                  Escalate to Super Admin
                </OpButton>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <OpButton variant="outline" size="sm" onClick={() => setSelected(null)}>
                  Cancel
                </OpButton>
                <OpButton variant="primary" size="sm" disabled={!canManage} onClick={handleSaveUpdate}>
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
            ? `Escalate ${escalateTarget.code} ("${escalateTarget.title}") to Super Admin executive governance and raise priority to Urgent?`
            : ""
        }
        confirmLabel="Escalate Now"
        variant="danger"
        onConfirm={() => {
          if (escalateTarget) {
            escalateIncident(escalateTarget.id);
            toast.success(`Escalated ${escalateTarget.code} to Super Admin.`);
          }
        }}
      />
    </div>
  );
}
