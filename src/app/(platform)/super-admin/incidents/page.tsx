"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  Plus,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { IncidentGovernanceItem } from "../_types";
import { formatDateTime } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  EmptyStateView,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  SimulationNotice,
  SlideOverDrawer,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "../_components/SuperAdminPrimitives";

const AFFECTED_AREA_OPTIONS = [
  "Authentication & Sign-In",
  "Billing & Checkout",
  "Customer Workspaces",
  "Email Delivery",
  "GitHub & Webhooks",
  "Reporting & Exports",
];

export default function IncidentGovernancePage() {
  const incidents = useSuperAdminStore((s) => s.incidents);
  const operators = useSuperAdminStore((s) => s.operators);
  const createIncident = useSuperAdminStore((s) => s.createIncident);
  const updateIncident = useSuperAdminStore((s) => s.updateIncident);

  const { can } = useAdminPermissions();
  const canManageSecurity = can("security.manage");

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Declare Incident Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState<IncidentGovernanceItem["severity"]>("Major");
  const [ownerOperatorId, setOwnerOperatorId] = useState("");
  const [escalationLevel, setEscalationLevel] =
    useState<IncidentGovernanceItem["escalationLevel"]>("Tier 1 — Operator");
  const [affectedAreas, setAffectedAreas] = useState<string[]>(["Customer Workspaces"]);
  const [formError, setFormError] = useState<string | null>(null);

  // Update / Governance Drawer
  const [selectedIncident, setSelectedIncident] = useState<IncidentGovernanceItem | null>(null);
  const [editStatus, setEditStatus] = useState<IncidentGovernanceItem["status"]>("Investigating");
  const [editSeverity, setEditSeverity] = useState<IncidentGovernanceItem["severity"]>("Major");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editEscalation, setEditEscalation] =
    useState<IncidentGovernanceItem["escalationLevel"]>("Tier 1 — Operator");
  const [editNotes, setEditNotes] = useState("");

  const activeIncidents = useMemo(
    () => incidents.filter((i) => i.status !== "Resolved"),
    [incidents]
  );
  const criticalCount = useMemo(
    () => activeIncidents.filter((i) => i.severity === "Critical").length,
    [activeIncidents]
  );
  const executiveCount = useMemo(
    () => activeIncidents.filter((i) => i.escalationLevel === "Executive Escalation").length,
    [activeIncidents]
  );

  const getOperatorName = (id: string) =>
    operators.find((op) => op.id === id)?.name || "Unassigned Operator";

  const filteredIncidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((inc) => {
      const ownerName = getOperatorName(inc.ownerOperatorId).toLowerCase();
      const matchesQ =
        !q ||
        inc.incidentCode.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.summary.toLowerCase().includes(q) ||
        ownerName.includes(q);
      const matchesSev = severityFilter === "ALL" || inc.severity === severityFilter;
      const matchesStatus = statusFilter === "ALL" || inc.status === statusFilter;
      return matchesQ && matchesSev && matchesStatus;
    });
  }, [incidents, operators, search, severityFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedIncidents = filteredIncidents.slice((safePage - 1) * pageSize, safePage * pageSize);

  const openDeclareModal = () => {
    const activeOps = operators.filter((o) => o.status === "ACTIVE");
    setTitle("");
    setSummary("");
    setSeverity("Major");
    setOwnerOperatorId(activeOps[0]?.id || "");
    setEscalationLevel("Tier 1 — Operator");
    setAffectedAreas(["Customer Workspaces"]);
    setFormError(null);
    setCreateOpen(true);
  };

  const toggleArea = (area: string) => {
    setAffectedAreas((prev) =>
      prev.includes(area) ? prev.filter((item) => item !== area) : [...prev, area]
    );
  };

  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5) {
      setFormError("Please provide a clear incident headline (at least 5 characters).");
      return;
    }
    if (summary.trim().length < 10) {
      setFormError("Please describe the customer impact and symptoms.");
      return;
    }
    if (!ownerOperatorId) {
      setFormError("Please assign an owner responsible for coordinating resolution.");
      return;
    }
    if (affectedAreas.length === 0) {
      setFormError("Select at least one affected platform area.");
      return;
    }

    createIncident({
      title: title.trim(),
      summary: summary.trim(),
      severity,
      status: "Investigating",
      ownerOperatorId,
      escalationLevel,
      affectedAreas,
    });
    toast.success("Governance incident declared and owner notified (simulated).");
    setCreateOpen(false);
  };

  const openDrawer = (inc: IncidentGovernanceItem) => {
    setSelectedIncident(inc);
    setEditStatus(inc.status);
    setEditSeverity(inc.severity);
    setEditOwnerId(inc.ownerOperatorId);
    setEditEscalation(inc.escalationLevel);
    setEditNotes(inc.resolutionNotes || "");
  };

  const handleSaveGovernance = () => {
    if (!selectedIncident) return;
    if (!canManageSecurity) {
      toast.error("Your role does not permit updating incident governance records.");
      return;
    }
    updateIncident(selectedIncident.id, {
      status: editStatus,
      severity: editSeverity,
      ownerOperatorId: editOwnerId,
      escalationLevel: editEscalation,
      resolutionNotes: editNotes.trim() || undefined,
    });
    toast.success(`Incident ${selectedIncident.incidentCode} updated.`);
    setSelectedIncident(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incident Governance"
        badge="Executive Oversight"
        simulationLabel="Governance Tracker"
        description="Track platform-wide incidents, assign accountability owners, escalate critical issues, and record post-resolution notes."
        actions={
          <AdminButton
            variant="primary"
            size="sm"
            permissionLocked={!canManageSecurity}
            onClick={openDeclareModal}
          >
            <Plus className="w-4 h-4" />
            Declare Incident
          </AdminButton>
        }
      />

      <SimulationNotice
        title="Governance vs. Operations"
        description="Live runbooks and server diagnostics remain in the Platform Operator workspace. Super Admin governs severity, ownership, escalation, and compliance sign-off."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Active Incidents"
          value={activeIncidents.length}
          sublabel="Currently under oversight"
          icon={AlertTriangle}
          tone={activeIncidents.length > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Critical Severity"
          value={criticalCount}
          sublabel="High customer visibility"
          icon={ShieldAlert}
          tone={criticalCount > 0 ? "rose" : "emerald"}
        />
        <KpiCard
          label="Executive Escalations"
          value={executiveCount}
          sublabel="Requires leadership coordination"
          icon={ArrowUpRight}
          tone="violet"
        />
        <KpiCard
          label="Resolved Records"
          value={incidents.filter((i) => i.status === "Resolved").length}
          sublabel="Documented with governance notes"
          icon={CheckCircle2}
          tone="blue"
        />
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
              <div className="w-36">
                <AdminSelect
                  value={severityFilter}
                  onChange={(e) => {
                    setSeverityFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by severity"
                  options={[
                    { label: "All Severities", value: "ALL" },
                    { label: "Critical", value: "Critical" },
                    { label: "Major", value: "Major" },
                    { label: "Minor", value: "Minor" },
                  ]}
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
                  options={[
                    { label: "All Statuses", value: "ALL" },
                    { label: "Investigating", value: "Investigating" },
                    { label: "Identified", value: "Identified" },
                    { label: "Monitoring", value: "Monitoring" },
                    { label: "Resolved", value: "Resolved" },
                  ]}
                />
              </div>
            </div>
          }
        />

        {paginatedIncidents.length === 0 ? (
          <EmptyStateView
            icon={CheckCircle2}
            title="No incidents match your filter"
            description="No governance incident records match your current search or filter."
          />
        ) : (
          <div className="space-y-3">
            {paginatedIncidents.map((inc) => (
              <div
                key={inc.id}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-primary)]">
                      {inc.incidentCode}
                    </span>
                    <StatusBadge
                      label={inc.severity}
                      tone={inc.severity === "Critical" ? "danger" : inc.severity === "Major" ? "warning" : "info"}
                    />
                    <StatusBadge label={inc.status} tone={getStatusTone(inc.status)} dot />
                    <StatusBadge label={inc.escalationLevel} tone="neutral" />
                  </div>

                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{inc.title}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{inc.summary}</p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)] pt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Owner: <strong className="text-[var(--color-text-secondary)]">{getOperatorName(inc.ownerOperatorId)}</strong>
                    </span>
                    <span>Areas: {inc.affectedAreas.join(", ")}</span>
                    <span>Updated {formatDateTime(inc.updatedAt)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <AdminButton variant="outline" size="xs" onClick={() => openDrawer(inc)}>
                    <Eye className="w-3.5 h-3.5" />
                    Manage Oversight
                  </AdminButton>
                </div>
              </div>
            ))}
          </div>
        )}

        <PaginationBar
          currentPage={safePage}
          totalItems={filteredIncidents.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </SurfaceCard>

      {/* Declare Incident Modal */}
      <AdminModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Declare Governance Incident"
        description="Log a platform issue, assign ownership, and establish an escalation level."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateIncident} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <AdminInput
            label="Incident Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Delayed invoice PDF generation for European workspaces"
          />

          <AdminTextarea
            label="Impact Summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Explain what customers are experiencing in plain language..."
            rows={3}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AdminSelect
              label="Severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IncidentGovernanceItem["severity"])}
              options={[
                { label: "Minor", value: "Minor" },
                { label: "Major", value: "Major" },
                { label: "Critical", value: "Critical" },
              ]}
            />
            <AdminSelect
              label="Accountable Owner"
              value={ownerOperatorId}
              onChange={(e) => setOwnerOperatorId(e.target.value)}
              options={operators
                .filter((o) => o.status === "ACTIVE")
                .map((op) => ({ label: op.name, value: op.id }))}
            />
            <AdminSelect
              label="Escalation Level"
              value={escalationLevel}
              onChange={(e) =>
                setEscalationLevel(e.target.value as IncidentGovernanceItem["escalationLevel"])
              }
              options={[
                { label: "Tier 1 — Operator", value: "Tier 1 — Operator" },
                { label: "Tier 2 — Engineering", value: "Tier 2 — Engineering" },
                { label: "Executive Escalation", value: "Executive Escalation" },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[var(--color-text-secondary)]">
              Affected Platform Areas
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AFFECTED_AREA_OPTIONS.map((area) => {
                const checked = affectedAreas.includes(area);
                return (
                  <label
                    key={area}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs cursor-pointer hover:border-blue-500/40"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleArea(area)}
                      className="rounded border-[var(--color-border)]"
                    />
                    <span className="text-[var(--color-text-primary)]">{area}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary" size="sm">
              Declare Incident
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Manage Oversight Drawer */}
      <SlideOverDrawer
        isOpen={Boolean(selectedIncident)}
        onClose={() => setSelectedIncident(null)}
        title={selectedIncident ? `${selectedIncident.incidentCode} Governance` : "Incident Oversight"}
        subtitle={selectedIncident?.title}
      >
        {selectedIncident && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs space-y-1">
              <p className="font-semibold text-[var(--color-text-primary)]">Reported Impact</p>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                {selectedIncident.summary}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] pt-1">
                Opened {formatDateTime(selectedIncident.createdAt)} · Affected:{" "}
                {selectedIncident.affectedAreas.join(", ")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AdminSelect
                label="Incident Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as IncidentGovernanceItem["status"])}
                options={[
                  { label: "Investigating", value: "Investigating" },
                  { label: "Identified", value: "Identified" },
                  { label: "Monitoring", value: "Monitoring" },
                  { label: "Resolved", value: "Resolved" },
                ]}
              />
              <AdminSelect
                label="Severity Classification"
                value={editSeverity}
                onChange={(e) => setEditSeverity(e.target.value as IncidentGovernanceItem["severity"])}
                options={[
                  { label: "Minor", value: "Minor" },
                  { label: "Major", value: "Major" },
                  { label: "Critical", value: "Critical" },
                ]}
              />
              <AdminSelect
                label="Assigned Owner"
                value={editOwnerId}
                onChange={(e) => setEditOwnerId(e.target.value)}
                options={operators.map((op) => ({ label: `${op.name} (${op.department})`, value: op.id }))}
              />
              <AdminSelect
                label="Escalation Tier"
                value={editEscalation}
                onChange={(e) =>
                  setEditEscalation(e.target.value as IncidentGovernanceItem["escalationLevel"])
                }
                options={[
                  { label: "Tier 1 — Operator", value: "Tier 1 — Operator" },
                  { label: "Tier 2 — Engineering", value: "Tier 2 — Engineering" },
                  { label: "Executive Escalation", value: "Executive Escalation" },
                ]}
              />
            </div>

            <AdminTextarea
              label="Governance & Resolution Notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Document stakeholder updates, root-cause findings, or customer communication decisions..."
              rows={4}
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton variant="outline" size="sm" onClick={() => setSelectedIncident(null)}>
                Cancel
              </AdminButton>
              <AdminButton
                variant="primary"
                size="sm"
                permissionLocked={!canManageSecurity}
                onClick={handleSaveGovernance}
              >
                Save Governance Update
              </AdminButton>
            </div>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}
