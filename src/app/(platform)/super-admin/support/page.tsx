"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileText,
  Flame,
  Globe,
  Headphones,
  History,
  Lock,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Tag,
  UserCheck,
  UserX,
  X,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { usePlatformOperatorStore } from "../../platform-operator/_store/usePlatformOperatorStore";
import {
  SupportEscalationTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketSlaState,
  TicketAttachment,
  TicketMessage,
  TicketAuditEvent,
} from "../_types";
import { exportRowsToCsv, formatDateTime, isValidEmail } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  BulkSelectionBar,
  EmptyStateView,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/SuperAdminPrimitives";

const CATEGORIES: TicketCategory[] = [
  "Integration",
  "Billing & Invoices",
  "SSO & Access",
  "Performance",
  "API & Webhooks",
  "General Support",
];

const PRIORITIES: TicketPriority[] = ["Critical", "High", "Medium", "Low"];
const STATUSES: TicketStatus[] = ["Open", "In Progress", "Escalated", "Resolved", "Closed"];
const SLA_STATES: TicketSlaState[] = ["On Track", "At Risk", "Breached"];

function getCategoryTone(category: TicketCategory): "info" | "success" | "warning" | "violet" | "danger" | "neutral" {
  switch (category) {
    case "Integration":
      return "info";
    case "Billing & Invoices":
      return "success";
    case "SSO & Access":
      return "violet";
    case "Performance":
      return "warning";
    case "API & Webhooks":
      return "danger";
    default:
      return "neutral";
  }
}

function getPriorityTone(priority: TicketPriority): "danger" | "warning" | "info" | "neutral" {
  switch (priority) {
    case "Critical":
      return "danger";
    case "High":
      return "warning";
    case "Medium":
      return "info";
    default:
      return "neutral";
  }
}

function getSlaTone(sla: TicketSlaState): "danger" | "warning" | "success" {
  switch (sla) {
    case "Breached":
      return "danger";
    case "At Risk":
      return "warning";
    default:
      return "success";
  }
}

export default function SupportOversightPage() {
  const supportTickets = useSuperAdminStore((s) => s.supportTickets);
  const organizations = useSuperAdminStore((s) => s.organizations);
  const operators = useSuperAdminStore((s) => s.operators);
  const incidents = useSuperAdminStore((s) => s.incidents);
  const accountProfile = useSuperAdminStore((s) => s.accountProfile);

  const createSupportTicket = useSuperAdminStore((s) => s.createSupportTicket);
  const updateSupportTicket = useSuperAdminStore((s) => s.updateSupportTicket);
  const respondToSupportTicket = useSuperAdminStore((s) => s.respondToSupportTicket);
  const assignSupportTicketOperator = useSuperAdminStore((s) => s.assignSupportTicketOperator);
  const changeSupportTicketPriority = useSuperAdminStore((s) => s.changeSupportTicketPriority);
  const escalateSupportTicket = useSuperAdminStore((s) => s.escalateSupportTicket);
  const resolveSupportTicket = useSuperAdminStore((s) => s.resolveSupportTicket);
  const reopenSupportTicket = useSuperAdminStore((s) => s.reopenSupportTicket);
  const closeSupportTicket = useSuperAdminStore((s) => s.closeSupportTicket);
  const linkTicketToIncident = useSuperAdminStore((s) => s.linkTicketToIncident);
  const createIncident = useSuperAdminStore((s) => s.createIncident);

  const { can } = useAdminPermissions();
  const canManageSupport = can("support.manage");
  const canExport = can("system.export");
  const canManageIncidents = can("incidents.manage");

  // Synchronize state with Platform Operator tickets on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const opTickets = (usePlatformOperatorStore.getState() as any).tickets || [];
        for (const opT of opTickets) {
          const match = supportTickets.find((t) => t.ticketNumber === opT.ticketNumber || t.id === opT.id);
          if (match && opT.status === "Resolved" && match.status !== "Resolved" && match.status !== "Closed") {
            updateSupportTicket(match.id, { status: "Resolved", slaState: "On Track" });
          }
        }
      }
    } catch {}
  }, []);

  // Filters & State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [slaFilter, setSlaFilter] = useState<string>("ALL");
  const [orgFilter, setOrgFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Critical Queue Collapsible
  const [criticalQueueExpanded, setCriticalQueueExpanded] = useState(true);

  // Selected Ticket for Modal
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"communication" | "overview" | "audit" | "history">("communication");

  // Modal keyboard accessibility & body scroll lock
  useEffect(() => {
    if (!selectedTicketId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTicketId(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedTicketId]);

  // Response Composer State
  const [replyText, setReplyText] = useState("");
  const [replyMode, setReplyMode] = useState<"public" | "internal">("public");
  const [composerAttachments, setComposerAttachments] = useState<TicketAttachment[]>([]);

  // Action Modals State
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveRootCause, setResolveRootCause] = useState("");

  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");

  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentSummary, setIncidentSummary] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState<"Minor" | "Major" | "Critical">("Major");
  const [incidentLevel, setIncidentLevel] = useState<"Tier 1 — Operator" | "Tier 2 — Engineering" | "Executive Escalation">("Tier 2 — Engineering");
  const [incidentOwner, setIncidentOwner] = useState(operators[0]?.id || "op-main-1");
  const [incidentTargetTicket, setIncidentTargetTicket] = useState<SupportEscalationTicket | null>(null);

  // Optional Secondary Action: Manually Log Customer Case Modal
  const [createCaseOpen, setCreateCaseOpen] = useState(false);
  const [newOrgId, setNewOrgId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState<TicketCategory>("Integration");
  const [newPriority, setNewPriority] = useState<TicketPriority>("High");
  const [newOperatorId, setNewOperatorId] = useState("");
  const [newRequesterEmail, setNewRequesterEmail] = useState("");
  const [newRequesterName, setNewRequesterName] = useState("");
  const [newCaseError, setNewCaseError] = useState<string | null>(null);

  // Find currently selected ticket
  const selectedTicket = useMemo(
    () => supportTickets.find((t) => t.id === selectedTicketId) || null,
    [supportTickets, selectedTicketId]
  );

  const getOperatorName = (id: string) =>
    operators.find((o) => o.id === id)?.name || "Unassigned";

  // Recurring issue map by orgId
  const recurringOrgIssues = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of supportTickets) {
      if (t.orgId) {
        counts[t.orgId] = (counts[t.orgId] || 0) + 1;
      }
    }
    return counts;
  }, [supportTickets]);

  // KPIs: Exactly the 5 requested KPIs
  const openCount = useMemo(
    () => supportTickets.filter((t) => t.status === "Open" || t.status === "In Progress").length,
    [supportTickets]
  );
  const criticalCount = useMemo(
    () => supportTickets.filter((t) => t.priority === "Critical" && t.status !== "Resolved" && t.status !== "Closed").length,
    [supportTickets]
  );
  const escalatedCount = useMemo(
    () => supportTickets.filter((t) => t.status === "Escalated").length,
    [supportTickets]
  );
  const slaBreachedCount = useMemo(
    () => supportTickets.filter((t) => t.slaState === "Breached" && t.status !== "Resolved" && t.status !== "Closed").length,
    [supportTickets]
  );
  const resolvedCount = useMemo(
    () => supportTickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length,
    [supportTickets]
  );

  // Critical Issue Queue items (Unresolved Critical or Escalated tickets)
  const criticalQueueTickets = useMemo(() => {
    return supportTickets.filter(
      (t) =>
        (t.priority === "Critical" || t.status === "Escalated" || t.slaState === "Breached") &&
        t.status !== "Resolved" &&
        t.status !== "Closed"
    );
  }, [supportTickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return supportTickets.filter((ticket) => {
      const opName = (ticket.assignedOperatorName || getOperatorName(ticket.assignedOperatorId)).toLowerCase();
      const matchesQ =
        !q ||
        ticket.ticketNumber.toLowerCase().includes(q) ||
        ticket.subject.toLowerCase().includes(q) ||
        ticket.orgName.toLowerCase().includes(q) ||
        ticket.requesterEmail.toLowerCase().includes(q) ||
        (ticket.category && ticket.category.toLowerCase().includes(q)) ||
        opName.includes(q);

      const matchesStatus = statusFilter === "ALL" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "ALL" || ticket.priority === priorityFilter;
      const matchesCategory = categoryFilter === "ALL" || ticket.category === categoryFilter;
      const matchesSla = slaFilter === "ALL" || ticket.slaState === slaFilter;
      const matchesOrg = orgFilter === "ALL" || ticket.orgId === orgFilter;

      return matchesQ && matchesStatus && matchesPriority && matchesCategory && matchesSla && matchesOrg;
    });
  }, [supportTickets, operators, search, statusFilter, priorityFilter, categoryFilter, slaFilter, orgFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedTickets = filteredTickets.slice((safePage - 1) * pageSize, safePage * pageSize);

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    filteredTickets.map((t) => t.id),
    paginatedTickets.map((t) => t.id)
  );

  // Quick Open Ticket Drawer
  const openTicketDrawer = (ticket: SupportEscalationTicket, tab: "communication" | "overview" | "audit" | "history" = "communication") => {
    setSelectedTicketId(ticket.id);
    setActiveTab(tab);
    setReplyText("");
    setComposerAttachments([]);
  };

  // Handle Response Submit
  const handleSendResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    if (!canManageSupport) {
      toast.error("Your role does not permit modifying customer support tickets.");
      return;
    }
    if (!replyText.trim()) {
      toast.error("Please enter your reply or internal note before submitting.");
      return;
    }

    const isInternal = replyMode === "internal";
    respondToSupportTicket(selectedTicket.id, replyText.trim(), isInternal, composerAttachments);
    toast.success(
      isInternal
        ? "Internal staff note recorded (private to governance team)."
        : `Customer reply delivered to ${selectedTicket.requesterEmail}.`
    );
    setReplyText("");
    setComposerAttachments([]);
  };

  // Quick Reassign Operator
  const handleReassignOperator = (ticketId: string, operatorId: string) => {
    if (!canManageSupport) {
      toast.error("Your role does not permit reassigning support tickets.");
      return;
    }
    assignSupportTicketOperator(ticketId, operatorId);
    const opName = getOperatorName(operatorId);
    toast.success(`Assigned ticket to operator ${opName}.`);
  };

  // Quick Change Priority
  const handleChangePriority = (ticketId: string, newPriority: TicketPriority) => {
    if (!canManageSupport) {
      toast.error("Your role does not permit changing ticket priority.");
      return;
    }
    changeSupportTicketPriority(ticketId, newPriority);
    toast.info(`Priority updated to ${newPriority}. SLA deadline recalculated.`);
  };

  // Open Resolve Modal
  const openResolveDialog = (ticket: SupportEscalationTicket) => {
    setSelectedTicketId(ticket.id);
    setResolveNotes(ticket.resolutionNotes || "");
    setResolveRootCause(ticket.rootCause || "");
    setResolveModalOpen(true);
  };

  // Submit Resolve
  const handleConfirmResolve = () => {
    if (!selectedTicketId) return;
    if (!canManageSupport) {
      toast.error("Your role does not permit resolving customer support tickets.");
      return;
    }
    if (!resolveNotes.trim()) {
      toast.error("Please provide resolution notes detailing the outcome for the customer.");
      return;
    }
    resolveSupportTicket(selectedTicketId, resolveNotes.trim(), resolveRootCause.trim());
    toast.success("Support ticket marked as Resolved. SLA status set to On Track.");
    setResolveModalOpen(false);
  };

  // Open Reopen Dialog
  const openReopenDialog = (ticket: SupportEscalationTicket) => {
    setSelectedTicketId(ticket.id);
    setReopenReason("");
    setReopenModalOpen(true);
  };

  // Submit Reopen
  const handleConfirmReopen = () => {
    if (!selectedTicketId) return;
    if (!canManageSupport) {
      toast.error("Your role does not permit reopening tickets.");
      return;
    }
    if (!reopenReason.trim()) {
      toast.error("Please provide a reason for reopening this ticket.");
      return;
    }
    reopenSupportTicket(selectedTicketId, reopenReason.trim());
    toast.warning("Support ticket reopened and restored to active triage queue.");
    setReopenModalOpen(false);
  };

  // Open Escalate Dialog
  const openEscalateDialog = (ticket: SupportEscalationTicket) => {
    setSelectedTicketId(ticket.id);
    setEscalateReason("");
    setEscalateModalOpen(true);
  };

  // Submit Escalate
  const handleConfirmEscalate = () => {
    if (!selectedTicketId) return;
    if (!canManageSupport) {
      toast.error("Your role does not permit escalating tickets.");
      return;
    }
    escalateSupportTicket(selectedTicketId, escalateReason.trim());
    toast.warning("Ticket escalated for Super Admin executive governance.");
    setEscalateModalOpen(false);
  };

  // Close Ticket
  const handleCloseTicket = (ticketId: string) => {
    if (!canManageSupport) {
      toast.error("Your role does not permit archiving tickets.");
      return;
    }
    closeSupportTicket(ticketId);
    toast.info("Ticket closed and permanently archived.");
  };

  // Open Declare Platform Incident Dialog
  const openDeclareIncidentModal = (linkedTicket?: SupportEscalationTicket) => {
    if (linkedTicket) {
      setIncidentTargetTicket(linkedTicket);
      setIncidentTitle(`Service Interruption: ${linkedTicket.subject}`);
      setIncidentSummary(`Declared from customer escalation ${linkedTicket.ticketNumber} (${linkedTicket.orgName}): ${linkedTicket.description}`);
      setIncidentSeverity(linkedTicket.priority === "Critical" ? "Critical" : "Major");
    } else {
      setIncidentTargetTicket(null);
      setIncidentTitle("");
      setIncidentSummary("");
      setIncidentSeverity("Major");
    }
    setIncidentLevel("Tier 2 — Engineering");
    setIncidentOwner(operators[0]?.id || "op-main-1");
    setIncidentModalOpen(true);
  };

  // Submit Incident Declaration
  const handleConfirmDeclareIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageIncidents) {
      toast.error("Your role does not permit declaring platform incidents.");
      return;
    }
    if (incidentTitle.trim().length < 5) {
      toast.error("Please provide an incident title (at least 5 characters).");
      return;
    }
    if (incidentSummary.trim().length < 10) {
      toast.error("Please provide an incident summary describing the impact.");
      return;
    }

    createIncident({
      title: incidentTitle.trim(),
      summary: incidentSummary.trim(),
      severity: incidentSeverity,
      status: "Investigating",
      ownerOperatorId: incidentOwner,
      escalationLevel: incidentLevel,
      affectedAreas: [incidentTargetTicket?.category || "Infrastructure"],
    });

    const newInc = useSuperAdminStore.getState().incidents[0];
    if (incidentTargetTicket && newInc) {
      linkTicketToIncident(incidentTargetTicket.id, newInc.id);
      toast.success(`Declared incident ${newInc.incidentCode} and linked to ${incidentTargetTicket.ticketNumber}.`);
    } else {
      toast.success("Platform incident declared and broadcast to operators.");
    }
    setIncidentModalOpen(false);
  };

  // Open Log Case Modal (Secondary Action)
  const openLogCaseModal = () => {
    const firstOrg = organizations[0];
    const activeOps = operators.filter((o) => o.status === "ACTIVE");
    setNewOrgId(firstOrg?.id || "");
    setNewRequesterEmail(firstOrg?.ownerEmail || "");
    setNewRequesterName(firstOrg?.ownerName || "");
    setNewSubject("");
    setNewDesc("");
    setNewCategory("Integration");
    setNewPriority("High");
    setNewOperatorId(activeOps[0]?.id || "");
    setNewCaseError(null);
    setCreateCaseOpen(true);
  };

  const handleCreateCaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgId) {
      setNewCaseError("Please select a customer organization.");
      return;
    }
    if (newSubject.trim().length < 5) {
      setNewCaseError("Please enter a clear ticket subject.");
      return;
    }
    if (newDesc.trim().length < 10) {
      setNewCaseError("Please enter detailed issue information.");
      return;
    }
    if (!isValidEmail(newRequesterEmail)) {
      setNewCaseError("Please provide a valid customer email.");
      return;
    }

    createSupportTicket({
      orgId: newOrgId,
      subject: newSubject.trim(),
      description: newDesc.trim(),
      category: newCategory,
      priority: newPriority,
      assignedOperatorId: newOperatorId,
      requesterEmail: newRequesterEmail.trim(),
      requesterName: newRequesterName.trim() || undefined,
    });

    toast.success("Customer support escalation logged and routed to operator.");
    setCreateCaseOpen(false);
  };

  // CSV Export
  const handleExportCsv = () => {
    if (!canExport) {
      toast.error("Your role does not permit exporting reports.");
      return;
    }
    exportRowsToCsv(
      `prowise-support-oversight-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Ticket #",
        "Organization",
        "Category",
        "Subject",
        "Priority",
        "Status",
        "Assigned Operator",
        "SLA State",
        "SLA Target (min)",
        "Requester Email",
        "Created Date",
        "Updated Date",
      ],
      filteredTickets.map((t) => [
        t.ticketNumber,
        t.orgName,
        t.category || "General",
        t.subject,
        t.priority,
        t.status,
        t.assignedOperatorName || getOperatorName(t.assignedOperatorId),
        t.slaState,
        t.slaTargetMinutes,
        t.requesterEmail,
        t.createdAt,
        t.updatedAt,
      ])
    );
    toast.success(`Exported ${filteredTickets.length} support ticket(s) to CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* Header with primary actions being Governance & Incident Declaration (NOT Raise Ticket) */}
      <PageHeader
        title="Support Oversight & Governance"
        badge="Multi-Tenant Resolution Desk"
        simulationLabel="Cross-Org Sync"
        description="Oversee customer escalations across all organizations, coordinate operator accountability, track SLAs, and resolve recurring tenant issues."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton
              variant="outline"
              size="sm"
              permissionLocked={!canManageIncidents}
              onClick={() => openDeclareIncidentModal()}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              Declare Platform Incident
            </AdminButton>
            <AdminButton
              variant="outline"
              size="sm"
              permissionLocked={!canExport || filteredTickets.length === 0}
              onClick={handleExportCsv}
            >
              <Download className="w-3.5 h-3.5" />
              Export Governance Report
            </AdminButton>
            <AdminButton
              variant="subtle"
              size="sm"
              permissionLocked={!canManageSupport}
              onClick={openLogCaseModal}
              title="Record an incoming customer issue manually if not received via API"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Customer Case
            </AdminButton>
          </div>
        }
      />

      <SimulationNotice
        title="Customer Issue Resolution & SLA Governance Center"
        description="Real-time multi-tenant support ticket sync with Platform Operator desk. Super Admin resolves escalations, governs recurring failures, and reassigns operational accountability."
      />

      {/* 5 KPIs as strictly specified: Open, Critical, Escalated, SLA Breached, Resolved */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter(statusFilter === "Open" ? "ALL" : "Open");
            setPriorityFilter("ALL");
            setSlaFilter("ALL");
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setStatusFilter(statusFilter === "Open" ? "ALL" : "Open");
              setPriorityFilter("ALL");
              setSlaFilter("ALL");
              setPage(1);
            }
          }}
          className={`cursor-pointer rounded-xl transition-all ${
            statusFilter === "Open" ? "ring-2 ring-blue-500 shadow-md" : ""
          }`}
        >
          <KpiCard
            label="Open Tickets"
            value={openCount}
            sublabel="Awaiting operator triage"
            icon={Headphones}
            tone="blue"
          />
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setPriorityFilter(priorityFilter === "Critical" ? "ALL" : "Critical");
            setStatusFilter("ALL");
            setSlaFilter("ALL");
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setPriorityFilter(priorityFilter === "Critical" ? "ALL" : "Critical");
              setStatusFilter("ALL");
              setSlaFilter("ALL");
              setPage(1);
            }
          }}
          className={`cursor-pointer rounded-xl transition-all ${
            priorityFilter === "Critical" ? "ring-2 ring-rose-500 shadow-md" : ""
          }`}
        >
          <KpiCard
            label="Critical Priority"
            value={criticalCount}
            sublabel="High customer impact"
            icon={Flame}
            tone={criticalCount > 0 ? "rose" : "slate"}
          />
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter(statusFilter === "Escalated" ? "ALL" : "Escalated");
            setPriorityFilter("ALL");
            setSlaFilter("ALL");
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setStatusFilter(statusFilter === "Escalated" ? "ALL" : "Escalated");
              setPriorityFilter("ALL");
              setSlaFilter("ALL");
              setPage(1);
            }
          }}
          className={`cursor-pointer rounded-xl transition-all ${
            statusFilter === "Escalated" ? "ring-2 ring-amber-500 shadow-md" : ""
          }`}
        >
          <KpiCard
            label="Escalated"
            value={escalatedCount}
            sublabel="Executive governance"
            icon={AlertCircle}
            tone={escalatedCount > 0 ? "amber" : "slate"}
          />
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSlaFilter(slaFilter === "Breached" ? "ALL" : "Breached");
            setStatusFilter("ALL");
            setPriorityFilter("ALL");
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setSlaFilter(slaFilter === "Breached" ? "ALL" : "Breached");
              setStatusFilter("ALL");
              setPriorityFilter("ALL");
              setPage(1);
            }
          }}
          className={`cursor-pointer rounded-xl transition-all ${
            slaFilter === "Breached" ? "ring-2 ring-rose-500 shadow-md" : ""
          }`}
        >
          <KpiCard
            label="SLA Breached"
            value={slaBreachedCount}
            sublabel="Exceeded target window"
            icon={Clock}
            tone={slaBreachedCount > 0 ? "rose" : "emerald"}
          />
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter(statusFilter === "Resolved" ? "ALL" : "Resolved");
            setPriorityFilter("ALL");
            setSlaFilter("ALL");
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setStatusFilter(statusFilter === "Resolved" ? "ALL" : "Resolved");
              setPriorityFilter("ALL");
              setSlaFilter("ALL");
              setPage(1);
            }
          }}
          className={`cursor-pointer rounded-xl transition-all ${
            statusFilter === "Resolved" ? "ring-2 ring-emerald-500 shadow-md" : ""
          }`}
        >
          <KpiCard
            label="Resolved"
            value={resolvedCount}
            sublabel="Confirmed resolved & closed"
            icon={CheckCircle2}
            tone="emerald"
          />
        </div>
      </div>

      {/* Critical Issue Queue (Requirement 6) */}
      {criticalQueueTickets.length > 0 && (
        <SurfaceCard className="border-rose-500/30 bg-rose-500/[0.03] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <Flame className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                    Critical Issue Queue
                  </h3>
                  <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                    {criticalQueueTickets.length} Urgent Case{criticalQueueTickets.length > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                  Unresolved high-priority, escalated, and SLA-breached cases requiring immediate executive governance.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCriticalQueueExpanded(!criticalQueueExpanded)}
              aria-label={criticalQueueExpanded ? "Collapse critical queue" : "Expand critical queue"}
              className="text-xs sm:text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>{criticalQueueExpanded ? "Hide Queue" : "Show Queue"}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${criticalQueueExpanded ? "rotate-180" : ""}`} />
            </button>
          </div>

          {criticalQueueExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 pt-2">
              {criticalQueueTickets.map((t) => {
                const opName = t.assignedOperatorName || getOperatorName(t.assignedOperatorId);
                const hasRecurring = (recurringOrgIssues[t.orgId] || 0) > 1;

                return (
                  <div
                    key={t.id}
                    className="flex flex-col justify-between rounded-xl border border-rose-500/20 bg-[var(--color-surface)] p-4 shadow-xs hover:border-rose-500/40 transition-colors space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 font-mono text-xs font-bold text-rose-700 dark:text-rose-300">
                            {t.ticketNumber}
                          </span>
                          <StatusBadge label={t.priority} tone={getPriorityTone(t.priority)} className="text-xs" />
                          {hasRecurring && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                              <History className="w-3.5 h-3.5" />
                              Recurring
                            </span>
                          )}
                        </div>
                        <StatusBadge
                          label={t.slaState}
                          tone={getSlaTone(t.slaState)}
                          dot
                          className="text-xs"
                        />
                      </div>

                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-1">
                        {t.subject}
                      </h4>
                      <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        <span className="font-semibold text-[var(--color-text-primary)]">{t.orgName}</span>
                        <span className="mx-1.5 text-[var(--color-text-muted)]">·</span>
                        <span>{opName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <AdminButton
                          variant="primary"
                          size="xs"
                          onClick={() => openTicketDrawer(t, "communication")}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Triage
                        </AdminButton>
                        <AdminButton
                          variant="outline"
                          size="xs"
                          onClick={() => openDeclareIncidentModal(t)}
                          title="Spin off platform incident"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        </AdminButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SurfaceCard>
      )}

      {/* Main Ticket Governance Table & Filters */}
      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search ticket #, organization, subject, category, owner..."
          hasActiveFilters={Boolean(
            search ||
              statusFilter !== "ALL" ||
              priorityFilter !== "ALL" ||
              categoryFilter !== "ALL" ||
              slaFilter !== "ALL" ||
              orgFilter !== "ALL"
          )}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
            setPriorityFilter("ALL");
            setCategoryFilter("ALL");
            setSlaFilter("ALL");
            setOrgFilter("ALL");
            setPage(1);
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={!canExport || filteredTickets.length === 0}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <AdminSelect
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by status"
                  options={[
                    { label: "All Statuses", value: "ALL" },
                    ...STATUSES.map((s) => ({ label: s, value: s })),
                  ]}
                />
              </div>

              <div className="w-32">
                <AdminSelect
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by priority"
                  options={[
                    { label: "All Priorities", value: "ALL" },
                    ...PRIORITIES.map((p) => ({ label: p, value: p })),
                  ]}
                />
              </div>

              <div className="w-36">
                <AdminSelect
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by category"
                  options={[
                    { label: "All Categories", value: "ALL" },
                    ...CATEGORIES.map((c) => ({ label: c, value: c })),
                  ]}
                />
              </div>

              <div className="w-32">
                <AdminSelect
                  value={slaFilter}
                  onChange={(e) => {
                    setSlaFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by SLA state"
                  options={[
                    { label: "All SLAs", value: "ALL" },
                    ...SLA_STATES.map((s) => ({ label: s, value: s })),
                  ]}
                />
              </div>

              <div className="w-44">
                <AdminSelect
                  value={orgFilter}
                  onChange={(e) => {
                    setOrgFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by organization"
                  options={[
                    { label: "All Organizations", value: "ALL" },
                    ...organizations.map((o) => ({ label: o.name, value: o.id })),
                  ]}
                />
              </div>
            </div>
          }
        />

        {/* Bulk Selection Bar */}
        <BulkSelectionBar
          selectedCount={selectedIds.length}
          totalFilteredCount={filteredTickets.length}
          onSelectAllMatching={() => setSelectedIds(filteredTickets.map((t) => t.id))}
          onClear={() => setSelectedIds([])}
          actions={
            <>
              <AdminButton
                variant="subtle"
                size="xs"
                permissionLocked={!canManageSupport}
                onClick={() => {
                  let count = 0;
                  for (const id of selectedIds) {
                    const t = supportTickets.find((item) => item.id === id);
                    if (t && t.status !== "Resolved" && t.status !== "Closed") {
                      resolveSupportTicket(id, "Bulk resolved by Super Admin leadership review.");
                      count++;
                    }
                  }
                  if (count === 0) toast.info("Selected tickets are already resolved.");
                  else {
                    toast.success(`Resolved ${count} support ticket${count === 1 ? "" : "s"}.`);
                    setSelectedIds([]);
                  }
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Bulk Resolve
              </AdminButton>

              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canManageSupport}
                onClick={() => {
                  let count = 0;
                  for (const id of selectedIds) {
                    const t = supportTickets.find((item) => item.id === id);
                    if (t && t.status !== "Escalated") {
                      escalateSupportTicket(id, "Bulk escalated by Super Admin.");
                      count++;
                    }
                  }
                  if (count === 0) toast.info("Selected tickets are already escalated.");
                  else {
                    toast.warning(`Escalated ${count} support ticket${count === 1 ? "" : "s"}.`);
                    setSelectedIds([]);
                  }
                }}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Bulk Escalate
              </AdminButton>

              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canExport}
                onClick={() => {
                  const targets = filteredTickets.filter((t) => selectedSet.has(t.id));
                  exportRowsToCsv(
                    "prowise-support-selected.csv",
                    ["Sr. No.", "Ticket #", "Organization", "Category", "Subject", "Priority", "Status", "SLA", "Owner"],
                    targets.map((t, idx) => [
                      idx + 1,
                      t.ticketNumber,
                      t.orgName,
                      t.category,
                      t.subject,
                      t.priority,
                      t.status,
                      t.slaState,
                      t.assignedOperatorName || getOperatorName(t.assignedOperatorId),
                    ])
                  );
                  toast.success(`Exported ${targets.length} selected ticket(s) to CSV.`);
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export Selected
              </AdminButton>
            </>
          }
        />

        {/* Ticket Table */}
        {paginatedTickets.length === 0 ? (
          <EmptyStateView
            icon={Headphones}
            title="No support tickets found"
            description="No customer issues match your current search queries or filter attributes."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected;
                      }}
                      onChange={toggleSelectPage}
                      aria-label="Select all support tickets on this page"
                      className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="py-3 px-2.5 w-10 whitespace-nowrap text-center hidden sm:table-cell">Sr.</th>
                  <th className="py-3 px-3 whitespace-nowrap">Ticket ID</th>
                  <th className="py-3 px-3 whitespace-nowrap">Organization</th>
                  <th className="py-3 px-3 min-w-[150px] max-w-[220px] xl:max-w-[280px]">Issue &amp; Description</th>
                  <th className="py-3 px-2.5 whitespace-nowrap hidden lg:table-cell">Category</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">Priority</th>
                  <th className="py-3 px-2.5 whitespace-nowrap hidden md:table-cell">Assigned Operator</th>
                  <th className="py-3 px-2.5 whitespace-nowrap">Status</th>
                  <th className="py-3 px-2.5 whitespace-nowrap hidden sm:table-cell">SLA Health</th>
                  <th className="py-3 px-3 whitespace-nowrap hidden xl:table-cell">Created</th>
                  <th className="sticky right-0 z-20 bg-[var(--color-sidebar)] py-3 px-3 text-right whitespace-nowrap shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.12)] border-l border-[var(--color-border)]/40">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-sm">
                {paginatedTickets.map((ticket, idx) => {
                  const serialNumber = (safePage - 1) * pageSize + idx + 1;
                  const isSelected = selectedSet.has(ticket.id);
                  const opName = ticket.assignedOperatorName || getOperatorName(ticket.assignedOperatorId);
                  const orgRecurringCount = recurringOrgIssues[ticket.orgId] || 1;

                  return (
                    <tr
                      key={ticket.id}
                      className={`group transition-colors ${
                        isSelected ? "bg-blue-500/10" : "hover:bg-[var(--color-hover)]"
                      }`}
                    >
                      <td className="py-2.5 px-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(ticket.id)}
                          aria-label={`Select ticket ${ticket.ticketNumber}`}
                          className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>

                      <td className="py-2.5 px-2.5 w-10 whitespace-nowrap text-center font-medium text-[var(--color-text-secondary)] tabular-nums text-xs hidden sm:table-cell">
                        {serialNumber}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openTicketDrawer(ticket, "communication")}
                            className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
                            title="View ticket details"
                          >
                            {ticket.ticketNumber}
                          </button>
                          {orgRecurringCount > 1 && (
                            <span
                              title={`Organization has ${orgRecurringCount} customer issues logged`}
                              className="inline-flex items-center rounded-full bg-amber-500/15 p-1 text-amber-700 dark:text-amber-300"
                            >
                              <History className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full border border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                            {getOrgInitials(ticket.orgName)}
                          </div>
                          <div className="min-w-0 max-w-[120px] sm:max-w-[150px]">
                            <p className="font-semibold text-xs sm:text-sm text-[var(--color-text-primary)] leading-tight truncate" title={ticket.orgName}>
                              {ticket.orgName}
                            </p>
                            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 truncate" title={ticket.requesterEmail}>
                              {ticket.requesterEmail}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 min-w-[150px] max-w-[220px] xl:max-w-[280px]">
                        <p className="font-semibold text-xs sm:text-sm text-[var(--color-text-primary)] truncate" title={ticket.subject}>
                          {ticket.subject}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate mt-0.5" title={ticket.description}>
                          {ticket.description}
                        </p>
                      </td>

                      <td className="py-2.5 px-2.5 whitespace-nowrap hidden lg:table-cell">
                        <StatusBadge
                          label={ticket.category || "General"}
                          tone={getCategoryTone(ticket.category || "General Support")}
                          className="text-xs py-0.5 px-2"
                        />
                      </td>

                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <StatusBadge
                          label={ticket.priority}
                          tone={getPriorityTone(ticket.priority)}
                          className="text-xs py-0.5 px-2"
                        />
                      </td>

                      <td className="py-2.5 px-2.5 whitespace-nowrap hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <div className="h-5 w-5 rounded-full bg-[var(--color-elevated)] border border-[var(--color-border)] flex items-center justify-center text-[10px] font-semibold text-[var(--color-text-secondary)] shrink-0">
                            {opName.slice(0, 1)}
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-[var(--color-text-primary)] truncate max-w-[110px]" title={opName}>
                            {opName}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <StatusBadge label={ticket.status} tone={getStatusTone(ticket.status)} dot className="text-xs py-0.5 px-2" />
                      </td>

                      <td className="py-2.5 px-2.5 whitespace-nowrap hidden sm:table-cell">
                        <StatusBadge
                          label={`${ticket.slaState} (${ticket.slaTargetMinutes}m)`}
                          tone={getSlaTone(ticket.slaState)}
                          className="text-xs py-0.5 px-2"
                        />
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-xs text-[var(--color-text-secondary)] font-medium hidden xl:table-cell">
                        {formatDateTime(ticket.createdAt)}
                      </td>

                      <td
                        className={`sticky right-0 z-10 py-2.5 px-3 whitespace-nowrap text-right shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.12)] border-l border-[var(--color-border)]/40 transition-colors ${
                          isSelected
                            ? "bg-blue-50/95 dark:bg-blue-950/80"
                            : "bg-[var(--color-surface)] group-hover:bg-[var(--color-hover)]"
                        }`}
                      >
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <AdminButton
                            variant="primary"
                            size="sm"
                            onClick={() => openTicketDrawer(ticket, "communication")}
                            title="Open ticket details and customer message thread"
                            className="h-8 px-2.5 text-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Details
                          </AdminButton>

                          {ticket.status !== "Resolved" && ticket.status !== "Closed" ? (
                            <AdminButton
                              variant="subtle"
                              size="sm"
                              permissionLocked={!canManageSupport}
                              onClick={() => openResolveDialog(ticket)}
                              title="Resolve this ticket"
                              className="h-8 w-8 p-0 inline-flex items-center justify-center"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </AdminButton>
                          ) : (
                            <AdminButton
                              variant="outline"
                              size="sm"
                              permissionLocked={!canManageSupport}
                              onClick={() => openReopenDialog(ticket)}
                              title="Reopen resolved ticket"
                              className="h-8 w-8 p-0 inline-flex items-center justify-center"
                            >
                              <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </AdminButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar
          currentPage={safePage}
          totalItems={filteredTickets.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </SurfaceCard>

      {/* Ticket Details & Governance Centered Modal (Requirement 4, 5, 8, 9, 10) */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setSelectedTicketId(null)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            className="relative z-10 flex max-h-[88vh] w-full max-w-4xl flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 min-h-0"
          >
            {/* Modal Header */}
            <div className="border-b border-[var(--color-border)] px-5 sm:px-6 py-4 shrink-0 space-y-3 bg-[var(--color-sidebar)] rounded-t-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 font-mono text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-300">
                      {selectedTicket.ticketNumber}
                    </span>
                    <StatusBadge
                      label={selectedTicket.category || "General"}
                      tone={getCategoryTone(selectedTicket.category || "General Support")}
                      className="text-xs py-1 px-2.5"
                    />
                    <StatusBadge label={selectedTicket.priority} tone={getPriorityTone(selectedTicket.priority)} className="text-xs py-1 px-2.5" />
                    <StatusBadge label={selectedTicket.status} tone={getStatusTone(selectedTicket.status)} dot className="text-xs py-1 px-2.5" />
                    <StatusBadge label={`SLA: ${selectedTicket.slaState}`} tone={getSlaTone(selectedTicket.slaState)} className="text-xs py-1 px-2.5" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)] truncate">
                    {selectedTicket.subject}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                    <span className="font-semibold text-[var(--color-text-primary)]">{selectedTicket.orgName}</span>
                    <span className="mx-2 text-[var(--color-text-muted)]">·</span>
                    <span>Requester: {selectedTicket.requesterName ? `${selectedTicket.requesterName} (${selectedTicket.requesterEmail})` : selectedTicket.requesterEmail}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTicketId(null)}
                  aria-label="Close ticket details modal"
                  className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-3 border-t border-[var(--color-border)]">
                {/* Reassign Operator & Change Priority */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">Assignee:</span>
                    <div className="w-36 sm:w-40">
                      <AdminSelect
                        value={selectedTicket.assignedOperatorId}
                        onChange={(e) => handleReassignOperator(selectedTicket.id, e.target.value)}
                        aria-label="Reassign operator"
                        options={operators.map((o) => ({ label: o.name, value: o.id }))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">Priority:</span>
                    <div className="w-28 sm:w-32">
                      <AdminSelect
                        value={selectedTicket.priority}
                        onChange={(e) => handleChangePriority(selectedTicket.id, e.target.value as TicketPriority)}
                        aria-label="Change priority"
                        options={PRIORITIES.map((p) => ({ label: p, value: p }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Status and Governance Actions Cluster */}
                <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                  {selectedTicket.status !== "Resolved" && selectedTicket.status !== "Closed" ? (
                    <>
                      <AdminButton
                        variant="primary"
                        size="sm"
                        permissionLocked={!canManageSupport}
                        onClick={() => openResolveDialog(selectedTicket)}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Resolve Ticket
                      </AdminButton>

                      {selectedTicket.status !== "Escalated" && (
                        <AdminButton
                          variant="outline"
                          size="sm"
                          permissionLocked={!canManageSupport}
                          onClick={() => openEscalateDialog(selectedTicket)}
                        >
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          Escalate
                        </AdminButton>
                      )}
                    </>
                  ) : (
                    <>
                      <AdminButton
                        variant="outline"
                        size="sm"
                        permissionLocked={!canManageSupport}
                        onClick={() => openReopenDialog(selectedTicket)}
                      >
                        <RefreshCw className="w-4 h-4 text-amber-500" />
                        Reopen Ticket
                      </AdminButton>

                      {selectedTicket.status === "Resolved" && (
                        <AdminButton
                          variant="subtle"
                          size="sm"
                          permissionLocked={!canManageSupport}
                          onClick={() => handleCloseTicket(selectedTicket.id)}
                        >
                          <Lock className="w-4 h-4 text-slate-500" />
                          Close &amp; Archive
                        </AdminButton>
                      )}
                    </>
                  )}

                  {/* Secondary: Link/Declare Incident */}
                  <AdminButton
                    variant="outline"
                    size="sm"
                    permissionLocked={!canManageIncidents}
                    onClick={() => openDeclareIncidentModal(selectedTicket)}
                    title="Create or link an internal platform incident"
                    className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-rose-500/30"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    Spin Off Incident
                  </AdminButton>
                </div>
              </div>
            </div>

            {/* Navigation Tabs inside Modal */}
            <div className="flex border-b border-[var(--color-border)] px-5 sm:px-6 bg-[var(--color-app-bg)] text-xs sm:text-sm font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("communication")}
                className={`py-3 px-4 border-b-2 font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                  activeTab === "communication"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Messages &amp; Notes</span>
                <span className="rounded-full bg-[var(--color-elevated)] px-2 py-0.5 text-xs">
                  {selectedTicket.messages?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`py-3 px-4 border-b-2 font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                  activeTab === "overview"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Overview &amp; SLA</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`py-3 px-4 border-b-2 font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                  activeTab === "audit"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <History className="w-4 h-4" />
                <span>Audit Trail</span>
                <span className="rounded-full bg-[var(--color-elevated)] px-2 py-0.5 text-xs">
                  {selectedTicket.auditHistory?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`py-3 px-4 border-b-2 font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                  activeTab === "history"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Org History</span>
                <span className="rounded-full bg-[var(--color-elevated)] px-2 py-0.5 text-xs">
                  {recurringOrgIssues[selectedTicket.orgId] || 1}
                </span>
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5">
              {/* TAB 1: COMMUNICATION & NOTES (Requirement 9) */}
              {activeTab === "communication" && (
                <div className="space-y-4">
                  {/* Messages Thread */}
                  <div className="space-y-3.5">
                    {(!selectedTicket.messages || selectedTicket.messages.length === 0) ? (
                      <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
                        No messages or staff notes recorded yet.
                      </div>
                    ) : (
                      selectedTicket.messages.map((msg) => {
                        const isInternal = msg.isInternal;
                        const isCustomer = msg.senderRole === "customer";

                        return (
                          <div
                            key={msg.id}
                            className={`rounded-xl p-4.5 text-sm transition-colors space-y-2.5 ${
                              isInternal
                                ? "border-l-4 border-l-amber-500 border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20"
                                : isCustomer
                                ? "border border-[var(--color-border)] bg-[var(--color-app-bg)]"
                                : "border border-blue-500/30 bg-blue-500/10 dark:bg-blue-950/20"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2.5 flex-wrap">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                    isInternal
                                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                      : isCustomer
                                      ? "bg-slate-500/20 text-slate-700 dark:text-slate-300"
                                      : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                  }`}
                                >
                                  {isInternal ? <Lock className="w-3.5 h-3.5" /> : msg.senderName.slice(0, 1)}
                                </span>
                                <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                                  {msg.senderName}
                                </span>
                                {msg.senderEmail && (
                                  <span className="text-xs text-[var(--color-text-secondary)]">
                                    ({msg.senderEmail})
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2.5">
                                {isInternal ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-200">
                                    <Lock className="w-3 h-3" />
                                    Internal Staff Note (Private)
                                  </span>
                                ) : isCustomer ? (
                                  <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                                    Customer Contact
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                                    Public Customer Reply
                                  </span>
                                )}
                                <span className="text-xs text-[var(--color-text-muted)] font-medium">
                                  {formatDateTime(msg.timestamp)}
                                </span>
                              </div>
                            </div>

                            <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
                              {msg.message}
                            </p>

                            {/* Attachments if any */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1.5 border-t border-[var(--color-border)]">
                                {msg.attachments.map((att, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)]"
                                  >
                                    <Paperclip className="w-3.5 h-3.5 text-blue-500" />
                                    <span className="font-medium">{att.name}</span>
                                    <span className="text-xs text-[var(--color-text-muted)]">({att.size})</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Reply Composer Form */}
                  <form onSubmit={handleSendResponse} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        Add Message or Governance Note
                      </span>

                      {/* Segmented Mode Switcher */}
                      <div className="inline-flex rounded-lg border border-[var(--color-border)] p-1 bg-[var(--color-app-bg)] text-xs sm:text-sm">
                        <button
                          type="button"
                          onClick={() => setReplyMode("public")}
                          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                            replyMode === "public"
                              ? "bg-blue-600 text-white shadow-xs font-semibold"
                              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          💬 Public Reply to Customer
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyMode("internal")}
                          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                            replyMode === "internal"
                              ? "bg-amber-600 text-white shadow-xs font-semibold"
                              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          🔒 Internal Staff Note
                        </button>
                      </div>
                    </div>

                    <div className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                      replyMode === "internal"
                        ? "bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20"
                        : "bg-blue-500/10 text-blue-800 dark:text-blue-200 border border-blue-500/20"
                    }`}>
                      {replyMode === "internal"
                        ? "🔒 Internal note: Only visible to Super Administrators and Platform Operators. Customer cannot see this note."
                        : `💬 Public reply: Will be dispatched to ${selectedTicket.requesterEmail} and recorded in customer support history.`}
                    </div>

                    <AdminTextarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={
                        replyMode === "internal"
                          ? "Record engineering notes, key rotation checks, root cause hypotheses, or operator handoff instructions..."
                          : "Type your official response to the customer..."
                      }
                      rows={3}
                    />

                    {composerAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {composerAttachments.map((att, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1 text-xs"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-blue-500" />
                            <span className="font-medium">{att.name}</span>
                            <button
                              type="button"
                              onClick={() => setComposerAttachments(composerAttachments.filter((_, idx) => idx !== i))}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <AdminButton
                        type="button"
                        variant="subtle"
                        size="sm"
                        onClick={() => {
                          const mockName = `diagnostic_log_${Date.now().toString().slice(-4)}.json`;
                          setComposerAttachments([...composerAttachments, { name: mockName, size: "3.4 KB", type: "application/json" }]);
                          toast.info(`Simulated file attached: ${mockName}`);
                        }}
                      >
                        <Paperclip className="w-4 h-4" />
                        Attach Diagnostic File
                      </AdminButton>

                      <AdminButton
                        type="submit"
                        variant={replyMode === "internal" ? "outline" : "primary"}
                        size="sm"
                        permissionLocked={!canManageSupport}
                      >
                        <Send className="w-4 h-4" />
                        {replyMode === "internal" ? "Save Internal Note" : "Send Customer Reply"}
                      </AdminButton>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 2: OVERVIEW & SLA (Requirement 8) */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  {/* Issue Summary Card */}
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4.5 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--color-text-primary)]">Issue Summary</span>
                      <span className="text-xs text-[var(--color-text-muted)] font-medium">
                        Logged {formatDateTime(selectedTicket.createdAt)}
                      </span>
                    </div>
                    <p className="text-[var(--color-text-primary)] leading-relaxed">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* SLA Tracking Matrix */}
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4.5 space-y-3.5">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      SLA Performance &amp; Target Deadlines
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
                      <div className="rounded-lg border border-[var(--color-border)] p-3.5 space-y-1.5 bg-[var(--color-app-bg)]">
                        <span className="text-xs uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
                          Response SLA Target
                        </span>
                        <p className="font-bold text-base text-[var(--color-text-primary)]">
                          {selectedTicket.priority === "Critical" ? "30 minutes" : selectedTicket.priority === "High" ? "60 minutes" : "120 minutes"}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          First Response: {selectedTicket.firstResponseAt ? formatDateTime(selectedTicket.firstResponseAt) : "Pending"}
                        </p>
                      </div>

                      <div className="rounded-lg border border-[var(--color-border)] p-3.5 space-y-1.5 bg-[var(--color-app-bg)]">
                        <span className="text-xs uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
                          Resolution SLA Target
                        </span>
                        <p className="font-bold text-base text-[var(--color-text-primary)]">
                          {selectedTicket.slaTargetMinutes} minutes
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Deadline: {selectedTicket.resolutionDeadline ? formatDateTime(selectedTicket.resolutionDeadline) : "Estimated 2h"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-[var(--color-elevated)] border border-[var(--color-border)]">
                      <span className="font-medium text-[var(--color-text-secondary)]">Current SLA State:</span>
                      <StatusBadge label={selectedTicket.slaState} tone={getSlaTone(selectedTicket.slaState)} dot className="text-xs py-1 px-3" />
                    </div>
                  </div>

                  {/* Resolution Notes & Root Cause (if resolved) */}
                  {selectedTicket.resolutionNotes && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4.5 space-y-2 text-sm text-emerald-950 dark:text-emerald-100">
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Resolution Confirmation
                        </span>
                        {selectedTicket.resolvedAt && (
                          <span className="text-xs opacity-80">{formatDateTime(selectedTicket.resolvedAt)}</span>
                        )}
                      </div>
                      <p className="leading-relaxed">{selectedTicket.resolutionNotes}</p>
                      {selectedTicket.rootCause && (
                        <p className="pt-2 border-t border-emerald-500/20 text-xs">
                          <span className="font-semibold">Root Cause:</span> {selectedTicket.rootCause}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Attachments Section */}
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4.5 space-y-3">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-blue-500" />
                      Attached Diagnostic Artifacts
                    </h4>

                    {(!selectedTicket.attachments || selectedTicket.attachments.length === 0) ? (
                      <p className="text-sm text-[var(--color-text-muted)]">No files attached to this escalation.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedTicket.attachments.map((file, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3.5 py-2.5 text-sm"
                          >
                            <div className="flex items-center gap-2.5">
                              <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                              <div>
                                <p className="font-medium text-[var(--color-text-primary)]">{file.name}</p>
                                <p className="text-xs text-[var(--color-text-muted)]">{file.size} · {file.type}</p>
                              </div>
                            </div>
                            <AdminButton
                              variant="subtle"
                              size="sm"
                              onClick={() => toast.success(`Simulated download of ${file.name} complete.`)}
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </AdminButton>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: AUDIT TRAIL (Requirement 10) */}
              {activeTab === "audit" && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-[var(--color-border)]">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Governance &amp; Accountability Timeline
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)] font-medium">
                      {selectedTicket.auditHistory?.length || 0} Events Recorded
                    </span>
                  </div>

                  {(!selectedTicket.auditHistory || selectedTicket.auditHistory.length === 0) ? (
                    <p className="text-sm text-[var(--color-text-muted)]">No audit events recorded yet.</p>
                  ) : (
                    <div className="relative pl-6 space-y-4 border-l-2 border-[var(--color-border)] ml-2">
                      {selectedTicket.auditHistory.map((item, idx) => (
                        <div key={item.id || idx} className="relative space-y-1.5 text-sm">
                          <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold">
                            •
                          </span>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-semibold text-[var(--color-text-primary)]">
                              {item.action}
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {formatDateTime(item.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            Actor: <span className="font-medium text-[var(--color-text-primary)]">{item.actor}</span>
                          </p>
                          {item.details && (
                            <p className="text-xs text-[var(--color-text-muted)] italic">
                              &quot;{item.details}&quot;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: ORGANIZATION HISTORY & RECURRING DETECTION (Requirement 7) */}
              {activeTab === "history" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4.5 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                        Tenant Support Profile
                      </span>
                      <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">
                        {selectedTicket.orgId}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      Organization: <span className="font-semibold text-[var(--color-text-primary)]">{selectedTicket.orgName}</span>
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Total Tracked Escalations: <span className="font-bold text-[var(--color-text-primary)]">{recurringOrgIssues[selectedTicket.orgId] || 1}</span>
                    </p>
                  </div>

                  {/* Recurring Issue Detection Notice */}
                  {(recurringOrgIssues[selectedTicket.orgId] || 1) > 1 && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2 text-sm text-amber-900 dark:text-amber-200">
                      <div className="flex items-center gap-2 font-bold">
                        <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Recurring Issue Pattern Detected</span>
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed">
                        This customer organization has logged multiple escalations in the same service category.
                        Super Admin recommended action: coordinate with Site Reliability to review tenant webhook endpoint stability.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2.5 pt-2">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Previous Tenant Escalations
                    </h4>
                    {supportTickets
                      .filter((t) => t.orgId === selectedTicket.orgId && t.id !== selectedTicket.id)
                      .map((pastT) => (
                        <div
                          key={pastT.id}
                          className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3.5 text-sm bg-[var(--color-surface)] hover:bg-[var(--color-hover)] transition-colors cursor-pointer"
                          onClick={() => setSelectedTicketId(pastT.id)}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs sm:text-sm text-blue-600 dark:text-blue-400">
                                {pastT.ticketNumber}
                              </span>
                              <StatusBadge label={pastT.status} tone={getStatusTone(pastT.status)} dot className="text-xs" />
                              <StatusBadge label={pastT.priority} tone={getPriorityTone(pastT.priority)} className="text-xs" />
                            </div>
                            <p className="font-medium text-[var(--color-text-primary)]">{pastT.subject}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              Created {formatDateTime(pastT.createdAt)}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* RESOLVE TICKET MODAL */}
      <AdminModal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Confirm Ticket Resolution"
        description="Provide resolution notes and root cause to close out customer issue governance."
        maxWidth="md"
      >
        <div className="space-y-4">
          <AdminTextarea
            label="Resolution Summary (Required)"
            value={resolveNotes}
            onChange={(e) => setResolveNotes(e.target.value)}
            placeholder="Describe the technical fix or customer confirmation..."
            rows={3}
          />

          <AdminInput
            label="Root Cause Categorization (Optional)"
            value={resolveRootCause}
            onChange={(e) => setResolveRootCause(e.target.value)}
            placeholder="e.g. Ingestion consumer pod latency, Okta SCIM token mismatch"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton variant="outline" size="sm" onClick={() => setResolveModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={handleConfirmResolve}>
              Confirm &amp; Mark Resolved
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* REOPEN TICKET MODAL */}
      <AdminModal
        isOpen={reopenModalOpen}
        onClose={() => setReopenModalOpen(false)}
        title="Reopen Support Ticket"
        description="Return this ticket to active triage queue. Record reason for reopening."
        maxWidth="md"
      >
        <div className="space-y-4">
          <AdminTextarea
            label="Reason for Reopening"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="e.g. Customer reported recurrence after deployment..."
            rows={3}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton variant="outline" size="sm" onClick={() => setReopenModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={handleConfirmReopen}>
              Confirm Reopen
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* ESCALATE TICKET MODAL */}
      <AdminModal
        isOpen={escalateModalOpen}
        onClose={() => setEscalateModalOpen(false)}
        title="Escalate to Executive Governance"
        description="Flag this case for elevated visibility and immediate Super Admin intervention."
        maxWidth="md"
      >
        <div className="space-y-4">
          <AdminTextarea
            label="Escalation Justification"
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
            placeholder="e.g. Breached 2-hour SLA, multiple executive complaints from tenant..."
            rows={3}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton variant="outline" size="sm" onClick={() => setEscalateModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={handleConfirmEscalate}>
              Confirm Escalation
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* DECLARE PLATFORM INCIDENT MODAL (Requirement 12 - Secondary Action) */}
      <AdminModal
        isOpen={incidentModalOpen}
        onClose={() => setIncidentModalOpen(false)}
        title="Declare Internal Platform Incident"
        description="Authorized platform incident declaration. Distinct from customer support tickets, broadcast across SRE and Platform Operator desks."
        maxWidth="lg"
      >
        <form onSubmit={handleConfirmDeclareIncident} className="space-y-4">
          {incidentTargetTicket && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-900 dark:text-blue-200">
              Linking customer escalation <span className="font-bold">{incidentTargetTicket.ticketNumber}</span> ({incidentTargetTicket.orgName}) to this incident.
            </div>
          )}

          <AdminInput
            label="Incident Title"
            value={incidentTitle}
            onChange={(e) => setIncidentTitle(e.target.value)}
            placeholder="e.g. Multi-Tenant Webhook Ingestion Queue Backlog"
          />

          <AdminTextarea
            label="Incident Summary & Impact"
            value={incidentSummary}
            onChange={(e) => setIncidentSummary(e.target.value)}
            placeholder="Describe affected regions, services, and initial mitigation steps..."
            rows={3}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AdminSelect
              label="Severity"
              value={incidentSeverity}
              onChange={(e) => setIncidentSeverity(e.target.value as "Minor" | "Major" | "Critical")}
              options={[
                { label: "Minor", value: "Minor" },
                { label: "Major", value: "Major" },
                { label: "Critical", value: "Critical" },
              ]}
            />

            <AdminSelect
              label="Escalation Level"
              value={incidentLevel}
              onChange={(e) => setIncidentLevel(e.target.value as any)}
              options={[
                { label: "Tier 1 — Operator", value: "Tier 1 — Operator" },
                { label: "Tier 2 — Engineering", value: "Tier 2 — Engineering" },
                { label: "Executive Escalation", value: "Executive Escalation" },
              ]}
            />

            <AdminSelect
              label="Incident Commander"
              value={incidentOwner}
              onChange={(e) => setIncidentOwner(e.target.value)}
              options={operators.map((o) => ({ label: o.name, value: o.id }))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setIncidentModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary" size="sm">
              Declare Incident
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* RECORD CUSTOMER CASE MODAL (Secondary Manual Case Logging) */}
      <AdminModal
        isOpen={createCaseOpen}
        onClose={() => setCreateCaseOpen(false)}
        title="Record Customer Support Case"
        description="Secondary entry: manually record an incoming customer issue and route to a Platform Operator owner."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateCaseSubmit} className="space-y-4">
          {newCaseError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {newCaseError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminSelect
              label="Customer Organization"
              value={newOrgId}
              onChange={(e) => {
                setNewOrgId(e.target.value);
                const matched = organizations.find((o) => o.id === e.target.value);
                if (matched) {
                  setNewRequesterEmail(matched.ownerEmail);
                  setNewRequesterName(matched.ownerName);
                }
              }}
              options={organizations.map((o) => ({ label: o.name, value: o.id }))}
            />
            <AdminInput
              label="Customer Contact Email"
              type="email"
              value={newRequesterEmail}
              onChange={(e) => setNewRequesterEmail(e.target.value)}
              placeholder="lead@company.com"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminSelect
              label="Issue Category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as TicketCategory)}
              options={CATEGORIES.map((c) => ({ label: c, value: c }))}
            />
            <AdminSelect
              label="Priority & SLA Window"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
              options={[
                { label: "Critical (1 hour SLA)", value: "Critical" },
                { label: "High (2 hour SLA)", value: "High" },
                { label: "Medium (4 hour SLA)", value: "Medium" },
                { label: "Low (24 hour SLA)", value: "Low" },
              ]}
            />
          </div>

          <AdminInput
            label="Ticket Subject"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="e.g. Single Sign-on SAML redirection looping on clinical workspace"
          />

          <AdminTextarea
            label="Issue Description"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Summarize the customer impact, affected users, and reproduction details..."
            rows={3}
          />

          <AdminSelect
            label="Assign Platform Operator Owner"
            value={newOperatorId}
            onChange={(e) => setNewOperatorId(e.target.value)}
            options={operators
              .filter((o) => o.status === "ACTIVE")
              .map((op) => ({ label: `${op.name} (${op.department})`, value: op.id }))}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setCreateCaseOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary" size="sm">
              Save &amp; Route Case
            </AdminButton>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
