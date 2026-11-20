"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  Download,
  Edit3,
  KeyRound,
  Lock,
  Mail,
  Plus,
  Power,
  Radio,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminRole, OperatorAccessLevel, OperatorStatus, PermissionCategory, PermissionKey, PlatformOperator } from "../_types";
import { PERMISSION_CATALOG } from "../_data/seed";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import {
  exportRowsToCsv,
  formatDateTime,
  isValidEmail,
} from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  ConfirmActionModal,
  EmptyStateView,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "../_components/SuperAdminPrimitives";
import { OperatorPermissionDrawer } from "./_components/OperatorPermissionDrawer";

const DEPARTMENT_OPTIONS = [
  "Platform Operations",
  "Site Reliability",
  "Lifecycle Messaging",
  "Customer Communications",
  "Finance & Tax",
  "Revenue Operations",
  "Trust & Compliance",
  "Platform Governance",
];

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  "Organizations",
  "Operators & Access",
  "Billing & Revenue",
  "Integrations & Security",
  "Communication",
  "Platform & Audit",
];

const ROLE_COLOR_THEMES: Record<
  AdminRole["color"],
  {
    badge: string;
    avatar: string;
    dot: string;
  }
> = {
  blue: {
    badge: "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
    avatar: "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  emerald: {
    badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    avatar: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  violet: {
    badge: "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    avatar: "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  amber: {
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    avatar: "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  slate: {
    badge: "border-cyan-500/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    avatar: "border-cyan-500/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
};

function getOperatorRoleTheme(color?: AdminRole["color"]) {
  return ROLE_COLOR_THEMES[color || "blue"] || ROLE_COLOR_THEMES.blue;
}

function getDepartmentBadgeClass(dept: string): string {
  const key = dept.toLowerCase();
  if (key.includes("operations")) return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  if (key.includes("site") || key.includes("reliability")) return "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";
  if (key.includes("message") || key.includes("messaging") || key.includes("lifecycle")) return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (key.includes("customer") || key.includes("support") || key.includes("communication")) return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  if (key.includes("finance") || key.includes("tax")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (key.includes("revenue") || key.includes("revops")) return "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300";
  if (key.includes("trust") || key.includes("compliance") || key.includes("security")) return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
}

export default function SuperAdminOperatorsPage() {
  const operators = useSuperAdminStore((s) => s.operators);
  const roles = useSuperAdminStore((s) => s.roles);
  const activeOperatorId = useSuperAdminStore((s) => s.activeOperatorId);
  const createOperator = useSuperAdminStore((s) => s.createOperator);
  const updateOperator = useSuperAdminStore((s) => s.updateOperator);
  const toggleOperatorStatus = useSuperAdminStore((s) => s.toggleOperatorStatus);
  const deleteOperator = useSuperAdminStore((s) => s.deleteOperator);
  const revokeOperatorSessions = useSuperAdminStore((s) => s.revokeOperatorSessions);
  const updateOperatorPermissions = useSuperAdminStore((s) => s.updateOperatorPermissions);
  const setOperatorStatus = useSuperAdminStore((s) => s.setOperatorStatus);
  const resendOperatorInvite = useSuperAdminStore((s) => s.resendOperatorInvite);

  const { can } = useAdminPermissions();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OperatorStatus>("ALL");
  const [sortBy, setSortBy] = useState<"name" | "department" | "status" | "lastActiveAt">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<PlatformOperator | null>(null);
  const [permDrawerOp, setPermDrawerOp] = useState<PlatformOperator | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformOperator | null>(null);

  // Multi-select bulk actions state
  const [selectedOpIds, setSelectedOpIds] = useState<string[]>([]);
  const [bulkRoleId, setBulkRoleId] = useState(roles[1]?.id || roles[0]?.id || "");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);


  // Form fields
  const [permSearch, setPermSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[1]?.id || roles[0]?.id || "");
  const [accessLevel, setAccessLevel] = useState<OperatorAccessLevel>("DEPARTMENT_OPERATOR");
  const [department, setDepartment] = useState("Site Reliability");
  const [status, setStatus] = useState<OperatorStatus>("ACTIVE");
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [onCall, setOnCall] = useState(false);
  const [shiftName, setShiftName] = useState("Americas Primary (08:00 - 17:00 UTC)");
  const [customPerms, setCustomPerms] = useState<PermissionKey[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canManage = can("operators.manage");

  const closeAllPanels = () => {
    setModalOpen(false);
    setPermDrawerOp(null);
    setDeleteTarget(null);
    setBulkDeleteOpen(false);
  };

  const openCreate = () => {
    closeAllPanels();
    setEditingOp(null);
    setName("");
    setEmail("");
    setRoleId(roles.find((r) => r.slug === "ops-lead")?.id || roles[0]?.id || "");
    setAccessLevel("DEPARTMENT_OPERATOR");
    setDepartment("Platform Operations");
    setStatus("ACTIVE");
    setMfaEnabled(true);
    setOnCall(false);
    setShiftName("Americas Primary (08:00 - 17:00 UTC)");
    setCustomPerms([]);
    setPermSearch("");
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (op: PlatformOperator) => {
    closeAllPanels();
    setEditingOp(op);
    setName(op.name);
    setEmail(op.email);
    setRoleId(op.roleId);
    setAccessLevel(op.accessLevel || "DEPARTMENT_OPERATOR");
    setDepartment(op.department);
    setStatus(op.status);
    setMfaEnabled(op.mfaEnabled);
    setOnCall(op.onCall);
    setShiftName(op.shiftName || "Americas Primary (08:00 - 17:00 UTC)");
    setCustomPerms(op.customPermissions || []);
    setPermSearch("");
    setErrors({});
    setModalOpen(true);
  };

  const openPermissionsModal = (op: PlatformOperator) => {
    closeAllPanels();
    setPermDrawerOp(op);
  };

  const handleRevokeSessions = (op: PlatformOperator) => {
    if (!canManage) {
      toast.error("Missing operators.manage permission");
      return;
    }
    const res = revokeOperatorSessions(op.id);
    if (!res.ok) {
      toast.error(res.error || "Failed to revoke active sessions.");
    } else {
      toast.success(`Revoked ${res.count} active session(s) for ${op.name}`);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = "Operator name is required.";
    if (!isValidEmail(email)) errs.email = "Valid @prowise.io or corporate email is required.";
    if (!department.trim()) errs.department = "Department is required.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (editingOp) {
      const res = updateOperator(editingOp.id, {
        name: name.trim(),
        email: email.trim(),
        roleId,
        accessLevel,
        department: department.trim(),
        status,
        mfaEnabled,
        onCall,
        shiftName: shiftName.trim(),
        customPermissions: customPerms,
      });
      if (!res.ok) {
        setErrors({ email: res.error || "Update failed" });
        return;
      }
      toast.success(`Updated operator ${name.trim()}`);
      setModalOpen(false);
    } else {
      const res = createOperator({
        name: name.trim(),
        email: email.trim(),
        roleId,
        accessLevel,
        department: department.trim(),
        status,
        mfaEnabled,
        onCall,
        shiftName: shiftName.trim(),
        activeSessionsCount: 0,
        customPermissions: customPerms,
      });
      if (!res.ok) {
        setErrors({ email: res.error || "Creation failed" });
        return;
      }
      toast.success(`Added operator ${name.trim()}`);
      setModalOpen(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return operators
      .filter((op) => {
        if (roleFilter !== "ALL" && op.roleId !== roleFilter) return false;
        if (statusFilter !== "ALL" && op.status !== statusFilter) return false;
        if (q) {
          const hit =
            op.name.toLowerCase().includes(q) ||
            op.email.toLowerCase().includes(q) ||
            op.department.toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortBy === "name") return a.name.localeCompare(b.name) * dir;
        if (sortBy === "department") return a.department.localeCompare(b.department) * dir;
        if (sortBy === "status") return a.status.localeCompare(b.status) * dir;
        return (new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime()) * dir;
      });
  }, [operators, search, roleFilter, statusFilter, sortBy, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter, pageSize]);

  useEffect(() => {
    const validIds = new Set(operators.map((o) => o.id));
    setSelectedOpIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [operators]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const selectedOpSet = useMemo(() => new Set(selectedOpIds), [selectedOpIds]);
  const allPageSelected =
    paginated.length > 0 && paginated.every((op) => selectedOpSet.has(op.id));
  const somePageSelected =
    paginated.some((op) => selectedOpSet.has(op.id)) && !allPageSelected;

  const toggleSelectPage = () => {
    const pageIds = paginated.map((op) => op.id);
    if (allPageSelected) {
      setSelectedOpIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedOpIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectOp = (id: string) => {
    setSelectedOpIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkStatusChange = (targetStatus: OperatorStatus) => {
    if (!canManage) {
      toast.error("Missing operators.manage permission");
      return;
    }
    const targets = operators.filter((o) => selectedOpSet.has(o.id));
    let updatedCount = 0;
    let skippedReason: string | undefined;
    for (const op of targets) {
      if (op.status === targetStatus) continue;
      const res = updateOperator(op.id, { status: targetStatus });
      if (res.ok) updatedCount++;
      else if (!skippedReason) skippedReason = res.error;
    }
    if (updatedCount > 0) {
      toast.success(
        `${targetStatus === "ACTIVE" ? "Activated" : "Deactivated"} ${updatedCount} operator${updatedCount === 1 ? "" : "s"}`
      );
      setSelectedOpIds([]);
    }
    if (skippedReason) {
      toast.warning(skippedReason);
    } else if (updatedCount === 0) {
      toast.info(`Selected operators are already ${targetStatus.toLowerCase()}.`);
    }
  };

  const handleBulkAssignRole = () => {
    if (!canManage) {
      toast.error("Missing operators.manage permission");
      return;
    }
    if (!bulkRoleId) return;
    const targets = operators.filter((o) => selectedOpSet.has(o.id));
    let updatedCount = 0;
    let skippedReason: string | undefined;
    for (const op of targets) {
      if (op.roleId === bulkRoleId) continue;
      const res = updateOperator(op.id, { roleId: bulkRoleId });
      if (res.ok) updatedCount++;
      else if (!skippedReason) skippedReason = res.error;
    }
    const roleLabel = roles.find((r) => r.id === bulkRoleId)?.name || "selected role";
    if (updatedCount > 0) {
      toast.success(`Assigned "${roleLabel}" to ${updatedCount} operator${updatedCount === 1 ? "" : "s"}`);
      setSelectedOpIds([]);
    }
    if (skippedReason) {
      toast.warning(skippedReason);
    } else if (updatedCount === 0) {
      toast.info(`Selected operators already have "${roleLabel}".`);
    }
  };

  const handleBulkRevokeSessions = () => {
    if (!canManage) {
      toast.error("Missing operators.manage permission");
      return;
    }
    const targets = operators.filter((o) => selectedOpSet.has(o.id));
    if (targets.length === 0) return;
    let totalSessions = 0;
    for (const op of targets) {
      const res = revokeOperatorSessions(op.id);
      if (res.ok) totalSessions += res.count;
    }
    toast.success(
      `Revoked active sessions (${totalSessions} total) for ${targets.length} operator${
        targets.length === 1 ? "" : "s"
      }`
    );
    setSelectedOpIds([]);
  };

  const handleBulkExport = () => {
    if (!can("system.export")) {
      toast.error("Missing system.export permission");
      return;
    }
    const targets = operators.filter((o) => selectedOpSet.has(o.id));
    exportRowsToCsv(
      "prowise-operators-selected.csv",
      ["Name", "Email", "Role", "Department", "Status", "MFA", "On-Call", "Last Active"],
      targets.map((o) => [
        o.name,
        o.email,
        roles.find((r) => r.id === o.roleId)?.name || o.roleId,
        o.department,
        o.status,
        o.mfaEnabled ? "Yes" : "No",
        o.onCall ? "Yes" : "No",
        o.lastActiveAt,
      ])
    );
    toast.success(`Exported ${targets.length} selected operator${targets.length === 1 ? "" : "s"}`);
  };

  const handleConfirmBulkDelete = () => {
    const targets = operators.filter((o) => selectedOpSet.has(o.id));
    let deletedCount = 0;
    let skippedReason: string | undefined;
    for (const op of targets) {
      const res = deleteOperator(op.id);
      if (res.ok) deletedCount++;
      else if (!skippedReason) skippedReason = res.error;
    }
    if (deletedCount > 0) {
      toast.success(`Removed ${deletedCount} operator${deletedCount === 1 ? "" : "s"}`);
    }
    if (skippedReason) {
      toast.warning(skippedReason);
    }
    setSelectedOpIds([]);
    setBulkDeleteOpen(false);
  };

  const toggleSort = (key: "name" | "department" | "status" | "lastActiveAt") => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "lastActiveAt" ? "desc" : "asc");
    }
    setPage(1);
  };

  const activeCount = operators.filter((o) => o.status === "ACTIVE").length;
  const onCallCount = operators.filter((o) => o.status === "ACTIVE" && o.onCall).length;
  const mfaCount = operators.filter((o) => o.mfaEnabled).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform Operators"
        description="Manage privileged ProWise staff, assign RBAC roles, configure supplemental permissions, and control active access."
        actions={
          <AdminButton
            variant="primary"
            size="sm"
            permissionLocked={!canManage}
            onClick={openCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Operator
          </AdminButton>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Total Operators" value={operators.length} sublabel="Roster accounts" icon={Users} tone="blue" />
        <KpiCard label="Active Access" value={activeCount} sublabel={`${operators.length - activeCount} inactive or invited`} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="On-Call Shift" value={onCallCount} sublabel="Incident response active" icon={Radio} tone="amber" />
        <KpiCard label="MFA Enforced" value={`${mfaCount}/${operators.length}`} sublabel="Hardware / TOTP verified" icon={ShieldCheck} tone="violet" />
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search operator name, email, or department..."
            hasActiveFilters={Boolean(search || roleFilter !== "ALL" || statusFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setRoleFilter("ALL");
              setStatusFilter("ALL");
            }}
            onExportCsv={() => {
              if (!can("system.export")) {
                toast.error("Missing system.export permission");
                return;
              }
              exportRowsToCsv(
                "prowise-operators.csv",
                [
                  "Sr. No.",
                  "Operator Name",
                  "Email",
                  "Role",
                  "Department",
                  "Shift Name",
                  "MFA Enforced",
                  "Active Sessions",
                  "Status",
                  "Last Active",
                ],
                filtered.map((o, idx) => [
                  idx + 1,
                  o.name,
                  o.email,
                  roles.find((r) => r.id === o.roleId)?.name || o.roleId,
                  o.department,
                  o.shiftName || "Standard Shift",
                  o.mfaEnabled ? "Yes" : "No",
                  o.activeSessionsCount ?? (o.status === "ACTIVE" ? 1 : 0),
                  o.status,
                  o.lastActiveAt,
                ])
              );
              toast.success("Exported operators roster CSV");
            }}
            exportDisabled={!can("system.export") || filtered.length === 0}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  aria-label="Filter by role"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "ALL" | OperatorStatus)}
                  aria-label="Filter by status"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="INVITED">Invited</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
            }
          />
        </div>

        {selectedOpIds.length > 0 && (
          <div className="border-b border-[var(--color-border)] bg-blue-500/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-0.5 font-semibold text-blue-700 dark:text-blue-300">
                {selectedOpIds.length} selected
              </span>
              {filtered.length > selectedOpIds.length && (
                <button
                  type="button"
                  onClick={() => setSelectedOpIds(filtered.map((o) => o.id))}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Select all {filtered.length} matching
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedOpIds([])}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <AdminButton
                variant="subtle"
                size="xs"
                permissionLocked={!canManage}
                onClick={() => handleBulkStatusChange("ACTIVE")}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Activate
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canManage}
                onClick={() => handleBulkStatusChange("INACTIVE")}
              >
                <Power className="w-3.5 h-3.5" />
                Deactivate
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canManage}
                onClick={handleBulkRevokeSessions}
                className="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Revoke Sessions
              </AdminButton>
              <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5">
                <select
                  value={bulkRoleId}
                  onChange={(e) => setBulkRoleId(e.target.value)}
                  aria-label="Bulk assign role"
                  className="h-6 bg-transparent px-1.5 text-[11px] text-[var(--color-text-primary)] outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <AdminButton
                  variant="ghost"
                  size="xs"
                  permissionLocked={!canManage}
                  onClick={handleBulkAssignRole}
                >
                  Assign Role
                </AdminButton>
              </div>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!can("system.export")}
                onClick={handleBulkExport}
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </AdminButton>
              <AdminButton
                variant="danger"
                size="xs"
                permissionLocked={!canManage}
                onClick={() => {
                  closeAllPanels();
                  setBulkDeleteOpen(true);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </AdminButton>
            </div>
          </div>
        )}

        {paginated.length === 0 ? (
          <EmptyStateView
            icon={Users}
            title="No operators match your filters"
            description="Try clearing search filters or invite a new platform operator."
            actionLabel={canManage ? "Add Operator" : undefined}
            onAction={canManage ? openCreate : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected;
                      }}
                      onChange={toggleSelectPage}
                      aria-label="Select all operators on this page"
                      className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 w-16 whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Operator <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3 hidden md:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort("department")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Department <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 hidden lg:table-cell">Security &amp; Shift</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Status <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 hidden xl:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort("lastActiveAt")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Last Active <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {paginated.map((op, idx) => {
                  const role = roles.find((r) => r.id === op.roleId);
                  const roleTheme = getOperatorRoleTheme(role?.color);
                  const inheritedCount = role?.permissions.length || 0;
                  const extraCount = (op.customPermissions || []).filter(
                    (p) => !(role?.permissions || []).includes(p)
                  ).length;
                  const serialNumber = (safePage - 1) * pageSize + idx + 1;
                  const isSelected = selectedOpSet.has(op.id);

                  return (
                    <tr
                      key={op.id}
                      className={`hover:bg-[var(--color-hover)] transition-colors ${
                        isSelected ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOp(op.id)}
                          aria-label={`Select ${op.name}`}
                          className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-[11px] shrink-0 ${roleTheme.avatar}`}
                          >
                            {op.name
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                              <span className="truncate">{op.name}</span>
                              {op.id === activeOperatorId && (
                                <span className="rounded bg-blue-500/15 px-1.5 py-0.2 text-[9px] font-bold text-blue-600 dark:text-blue-300">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--color-text-muted)] truncate">
                              {op.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${roleTheme.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${roleTheme.dot}`} />
                            {role?.name || "Unassigned"}
                          </span>
                          {extraCount > 0 && (
                            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-300">
                              +{extraCount} override
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                          {inheritedCount + extraCount} effective permissions
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="space-y-1">
                          {op.accessLevel === "MAIN_PLATFORM_OPERATOR" ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                              <ShieldCheck className="w-3 h-3 text-amber-500" />
                              Main Operator
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] font-medium">
                              Dept Operator
                            </span>
                          )}
                          <div>
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${getDepartmentBadgeClass(
                                op.department
                              )}`}
                            >
                              {op.accessLevel === "MAIN_PLATFORM_OPERATOR" && !op.department ? "All Operational Departments" : op.department}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge
                              label={op.mfaEnabled ? "MFA Active" : "No MFA"}
                              tone={op.mfaEnabled ? "success" : "warning"}
                            />
                            {op.onCall && <StatusBadge label="On-Call" tone="violet" dot />}
                          </div>
                          <div className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[170px]" title={op.shiftName}>
                            {op.shiftName || "Americas Primary (08:00 - 17:00)"}
                          </div>
                          <div className="text-[10px] text-[var(--color-text-secondary)] font-medium">
                            {op.activeSessionsCount ?? (op.status === "ACTIVE" ? 1 : 0)} active session(s)
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={op.status} tone={getStatusTone(op.status)} dot />
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-[var(--color-text-muted)]">
                        {formatDateTime(op.lastActiveAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <AdminButton
                            variant="subtle"
                            size="xs"
                            onClick={() => openPermissionsModal(op)}
                            title="Open permission management drawer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Permissions</span>
                          </AdminButton>
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canManage}
                            onClick={() => openEdit(op)}
                            title="Edit operator details & department"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </AdminButton>
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canManage}
                            onClick={() => handleRevokeSessions(op)}
                            title="Revoke active sessions"
                            className="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </AdminButton>
                          {op.status === "INVITED" ? (
                            <AdminButton
                              variant="ghost"
                              size="xs"
                              permissionLocked={!canManage}
                              onClick={() => {
                                resendOperatorInvite(op.id);
                                toast.success(`Resent invitation to ${op.email}`);
                              }}
                              title="Resend invitation email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </AdminButton>
                          ) : (
                            <AdminButton
                              variant="ghost"
                              size="xs"
                              permissionLocked={!canManage}
                              onClick={() => {
                                const res = toggleOperatorStatus(op.id);
                                if (!res.ok) toast.error(res.error);
                                else toast.success(`Updated status for ${op.name}`);
                              }}
                              title={op.status === "ACTIVE" ? "Deactivate operator" : "Activate operator"}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </AdminButton>
                          )}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canManage}
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                            onClick={() => setDeleteTarget(op)}
                            title="Delete operator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </AdminButton>
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
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </SurfaceCard>

      {/* Add / Edit Operator Modal */}
      <AdminModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingOp ? `Edit Operator: ${editingOp.name}` : "Add Platform Operator"}
        description="Configure operator details, assign a role, and customize extra permissions clearly."
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* 1. Profile & Role */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              1. Operator Profile &amp; Role
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <AdminInput
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Elena Vasquez"
                error={errors.name}
              />
              <AdminInput
                label="Corporate Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="elena@prowise.io"
                error={errors.email}
              />
              <AdminSelect
                label="Assigned Role"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                options={roles.map((r) => ({
                  label: `${r.name} (${r.permissions.length} included)`,
                  value: r.id,
                }))}
              />
              <AdminSelect
                label="Access Level Hierarchy"
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value as OperatorAccessLevel)}
                options={[
                  { label: "Department Operator (Scoped to Assigned Dept)", value: "DEPARTMENT_OPERATOR" },
                  { label: "Main Platform Operator (Global Operational Scope across all 7 Depts)", value: "MAIN_PLATFORM_OPERATOR" },
                ]}
              />
              <AdminSelect
                label="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                options={Array.from(
                  new Set([department, ...DEPARTMENT_OPTIONS].filter(Boolean))
                ).map((d) => ({ label: d, value: d }))}
              />
              <AdminInput
                label="On-Call Shift Assignment"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                placeholder="e.g. Americas Primary (08:00 - 17:00 UTC)"
              />
              <AdminSelect
                label="Account Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as OperatorStatus)}
                options={[
                  { label: "Active", value: "ACTIVE" },
                  { label: "Inactive", value: "INACTIVE" },
                  { label: "Invited", value: "INVITED" },
                  { label: "Suspended", value: "SUSPENDED" },
                ]}
              />
              <div className="grid grid-cols-2 gap-2.5 pt-1 sm:pt-5">
                <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-primary)] cursor-pointer hover:border-blue-500/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={mfaEnabled}
                    onChange={(e) => setMfaEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--color-border)] accent-blue-600 shrink-0"
                  />
                  <span>MFA Required</span>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-primary)] cursor-pointer hover:border-blue-500/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={onCall}
                    onChange={(e) => setOnCall(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--color-border)] accent-blue-600 shrink-0"
                  />
                  <span>On-Call Shift</span>
                </label>
              </div>
            </div>
          </div>

          {/* 2. Permissions & Extra Access (Grouped, Readable, Zero Clipping) */}
          {(() => {
            const selectedRole = roles.find((r) => r.id === roleId);
            const rolePerms = selectedRole?.permissions || [];
            const extraGranted = customPerms.filter((p) => !rolePerms.includes(p));
            const totalGranted = rolePerms.length + extraGranted.length;
            const pq = permSearch.trim().toLowerCase();

            return (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      2. Permissions &amp; Extra Access
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                      Role includes <strong className="text-[var(--color-text-primary)]">{rolePerms.length}</strong> permissions •{" "}
                      <strong className="text-[var(--color-text-primary)]">{extraGranted.length}</strong> extra added ({totalGranted} total)
                    </p>
                  </div>
                  {extraGranted.length > 0 && (
                    <AdminButton
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setCustomPerms([])}
                    >
                      Clear Extra Grants
                    </AdminButton>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    placeholder="Filter permissions by name or category..."
                    className="h-8 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-3 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {PERMISSION_CATEGORIES.map((category) => {
                    const catPerms = PERMISSION_CATALOG.filter(
                      (p) =>
                        p.category === category &&
                        (!pq ||
                          p.label.toLowerCase().includes(pq) ||
                          p.description.toLowerCase().includes(pq) ||
                          p.category.toLowerCase().includes(pq))
                    );
                    if (catPerms.length === 0) return null;

                    return (
                      <div key={category} className="space-y-2">
                        <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] pb-1">
                          {category}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {catPerms.map((perm) => {
                            const inherited = rolePerms.includes(perm.key);
                            const isExtra = !inherited && customPerms.includes(perm.key);
                            const checked = inherited || isExtra;
                            return (
                              <label
                                key={perm.key}
                                className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs transition-colors ${
                                  inherited
                                    ? "border-blue-500/30 bg-blue-500/8 text-[var(--color-text-primary)] cursor-default"
                                    : isExtra
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-[var(--color-text-primary)] cursor-pointer"
                                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-blue-500/35 cursor-pointer"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={inherited}
                                  onChange={(e) => {
                                    if (e.target.checked) setCustomPerms([...customPerms, perm.key]);
                                    else setCustomPerms(customPerms.filter((p) => p !== perm.key));
                                  }}
                                  className="mt-0.5 h-4 w-4 accent-blue-600 shrink-0"
                                />
                                <div className="min-w-0 space-y-0.5 flex-1">
                                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <span className="font-semibold leading-snug text-[var(--color-text-primary)]">
                                      {perm.label}
                                    </span>
                                    <span
                                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${
                                        inherited
                                          ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                          : isExtra
                                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                          : "bg-[var(--color-elevated)] text-[var(--color-text-muted)]"
                                      }`}
                                    >
                                      {inherited ? "From Role" : isExtra ? "Extra Grant" : "Optional"}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                                    {perm.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary">
              {editingOp ? "Save Operator" : "Create Operator"}
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Polished Permission Management Drawer */}
      <OperatorPermissionDrawer
        isOpen={Boolean(permDrawerOp)}
        onClose={() => setPermDrawerOp(null)}
        operator={permDrawerOp}
        role={roles.find((r) => r.id === permDrawerOp?.roleId)}
        onSaveOverrides={(opId, overrides) => {
          const res = updateOperatorPermissions(opId, overrides);
          if (!res.ok) {
            toast.error(res.error || "Failed to update permissions");
          } else {
            toast.success(`Updated permission overrides for ${permDrawerOp?.name}`);
          }
        }}
      />

      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Remove operator ${deleteTarget?.name || ""}?`}
        description="Removing this operator immediately revokes their Super Admin console access."
        confirmLabel="Remove Operator"
        variant="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          const res = deleteOperator(deleteTarget.id);
          if (!res.ok) toast.error(res.error);
          else toast.success(`Removed operator ${deleteTarget.name}`);
        }}
      />

      <ConfirmActionModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Remove ${selectedOpIds.length} selected operator${selectedOpIds.length === 1 ? "" : "s"}?`}
        description="Selected operators will immediately lose console access. Protected accounts (your active session or the last active Super Admin) are safely skipped."
        confirmLabel="Remove Selected"
        variant="danger"
        onConfirm={handleConfirmBulkDelete}
      />
    </div>
  );
}
