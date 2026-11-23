"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  History,
  KeyRound,
  Lock,
  Mail,
  Plus,
  Power,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient, SuperAdminUserItem, UserLoginHistoryItem } from "@/lib/api";
import { useSuperAdminStore } from "../_store/useSuperAdminStore";
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
} from "../_components/SuperAdminPrimitives";
import { formatDateTime, isValidEmail } from "../_services/super-admin-service";

const ALL_ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin", color: "purple" },
  { value: "PLATFORM_OPERATOR", label: "Platform Operator", color: "blue" },
  { value: "ORGANIZATION_OWNER", label: "Organization Owner", color: "emerald" },
  { value: "ORGANIZATION_ADMIN", label: "Organization Admin", color: "teal" },
  { value: "PROJECT_MANAGER", label: "Project Manager", color: "indigo" },
  { value: "TEAM_LEAD", label: "Team Lead", color: "cyan" },
  { value: "DEVELOPER", label: "Developer", color: "amber" },
  { value: "QA_REVIEWER", label: "QA Reviewer", color: "orange" },
  { value: "VIEWER", label: "Viewer", color: "slate" },
];

/**
 * Platform roles are never assigned from this page (approved decisions 5 and 6): operators are created
 * through Operator Management and Super Admins only through the controlled bootstrap process.
 */
const NON_ASSIGNABLE_ROLES = new Set(["SUPER_ADMIN", "PLATFORM_OPERATOR"]);
const ASSIGNABLE_ROLES = ALL_ROLES.filter((r) => !NON_ASSIGNABLE_ROLES.has(r.value));

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  DISABLED: "Deactivated",
  PENDING_ACTIVATION: "Pending activation",
};

/** Plain-language label for the latest setup email of a pending account. */
const SETUP_EMAIL_LABELS: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = {
  DELIVERED: { label: "Setup email sent", tone: "ok" },
  FAILED: { label: "Setup email failed", tone: "bad" },
  NOT_SENT: { label: "Email not configured", tone: "warn" },
  NOT_REQUESTED: { label: "No setup email sent", tone: "warn" },
};

type DeliveryAction = "CREATE" | "RESEND" | "RESET";

const DELIVERY_TITLES: Record<DeliveryAction, string> = {
  CREATE: "Account created and waiting for setup",
  RESEND: "Setup link sent",
  RESET: "Password reset link sent",
};

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

const ROLE_BADGE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  PLATFORM_OPERATOR: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  ORGANIZATION_OWNER: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  ORGANIZATION_ADMIN: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  PROJECT_MANAGER: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  TEAM_LEAD: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  DEVELOPER: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  QA_REVIEWER: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  VIEWER: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export default function SuperAdminUsersPage() {
  const organizations = useSuperAdminStore((s) => s.organizations);

  // Users state
  const [users, setUsers] = useState<SuperAdminUserItem[]>([]);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(0);
  const [pageSize] = useState<number>(12);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedOrg, setSelectedOrg] = useState<string>("ALL");

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SuperAdminUserItem | null>(null);

  // Delivery result after create, resend or reset. Never holds a credential.
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [credentialDetails, setCredentialDetails] = useState<{
    email: string;
    deliveryStatus: string;
    deliveryMessage?: string;
    actionType: DeliveryAction;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Login History modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState<UserLoginHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Confirm Status Change
  const [confirmStatusModalOpen, setConfirmStatusModalOpen] = useState(false);
  const [statusActionTarget, setStatusActionTarget] = useState<SuperAdminUserItem | null>(null);

  // Form Fields for Create
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    role: "DEVELOPER",
    department: "",
    organizationId: "",
    phone: "",
    sendEmail: true,
  });

  // Form Fields for Edit
  const [editForm, setEditForm] = useState({
    name: "",
    role: "DEVELOPER",
    department: "",
    organizationId: "",
    phone: "",
  });

  // Load users from backend API
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.superAdminUsers.list({
        search: searchTerm.trim() || undefined,
        role: selectedRole !== "ALL" ? selectedRole : undefined,
        status: selectedStatus !== "ALL" ? selectedStatus : undefined,
        organizationId: selectedOrg !== "ALL" ? selectedOrg : undefined,
        page,
        size: pageSize,
      });

      if (res && res.content) {
        setUsers(res.content);
        setTotalElements(res.total_elements);
        setTotalPages(res.total_pages || 1);
      }
      setLoadError(null);
    } catch (error) {
      // No sample fallback: an empty table with the real error is the honest state.
      const message = error instanceof Error ? error.message : "Could not load users.";
      setLoadError(message);
      setUsers([]);
      setTotalElements(0);
      setTotalPages(1);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedRole, selectedStatus, selectedOrg, page, pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Statistics
  const activeCount = useMemo(() => users.filter((u) => u.status === "ACTIVE").length, [users]);
  const pendingActivationCount = useMemo(() => users.filter((u) => u.status === "PENDING_ACTIVATION").length, [users]);
  const disabledCount = useMemo(() => users.filter((u) => u.status === "DISABLED").length, [users]);

  // Handle Create User Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(createForm.email)) {
      toast.error("Please enter a valid Gmail / email address.");
      return;
    }
    if (!createForm.name.trim()) {
      toast.error("User name is required.");
      return;
    }

    try {
      const res = await apiClient.superAdminUsers.create({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        organization_id: createForm.organizationId || undefined,
        phone: createForm.phone.trim() || undefined,
        send_email: createForm.sendEmail,
      });

      toast.success(`Account created for ${res.email}. It stays pending until the owner sets a password.`);
      setCreateModalOpen(false);

      setCredentialDetails({
        email: res.email,
        deliveryStatus: res.email_delivery_status || "NOT_REQUESTED",
        deliveryMessage: res.email_delivery_message || undefined,
        actionType: "CREATE",
      });
      setCredentialsModalOpen(true);

      setCreateForm({
        name: "",
        email: "",
        role: "DEVELOPER",
        department: "",
        organizationId: "",
        phone: "",
        sendEmail: true,
      });

      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user.");
    }
  };

  // Handle Edit User Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      await apiClient.superAdminUsers.update(selectedUser.id, {
        name: editForm.name.trim(),
        // A platform role is shown read-only and never sent back.
        role: NON_ASSIGNABLE_ROLES.has(editForm.role) ? undefined : editForm.role,
        department: editForm.department || undefined,
        organization_id: editForm.organizationId || undefined,
        phone: editForm.phone.trim() || undefined,
      });

      toast.success(`User ${selectedUser.email} updated.`);
      setEditModalOpen(false);
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user.");
    }
  };

  // Send a 30-minute password reset link (active accounts only)
  const handleSendResetLink = async (user: SuperAdminUserItem) => {
    try {
      const res = await apiClient.superAdminUsers.sendResetLink(user.id);
      setCredentialDetails({
        email: user.email,
        deliveryStatus: res.email_delivery_status,
        deliveryMessage: res.email_delivery_message,
        actionType: "RESET",
      });
      setCredentialsModalOpen(true);
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the reset link.");
    }
  };

  // Resend the 72-hour setup link (pending accounts only); earlier links stop working
  const handleResendSetupLink = async (user: SuperAdminUserItem) => {
    try {
      const res = await apiClient.superAdminUsers.resendSetupLink(user.id);
      setCredentialDetails({
        email: user.email,
        deliveryStatus: res.email_delivery_status,
        deliveryMessage: res.email_delivery_message,
        actionType: "RESEND",
      });
      setCredentialsModalOpen(true);
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resend the setup link.");
    }
  };

  // Handle Status Toggle (Activate / Deactivate). A pending account can only be deactivated.
  const handleConfirmStatusToggle = async () => {
    if (!statusActionTarget) return;
    const nextStatus = statusActionTarget.status === "DISABLED" ? "ACTIVE" : "DISABLED";
    try {
      await apiClient.superAdminUsers.updateStatus(statusActionTarget.id, nextStatus as any);
      toast.success(
        nextStatus === "ACTIVE"
          ? `User ${statusActionTarget.email} reactivated.`
          : `User ${statusActionTarget.email} deactivated. Active sessions invalidated.`
      );
      setConfirmStatusModalOpen(false);
      setStatusActionTarget(null);
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change user status.");
    }
  };

  // Handle View Login History
  const handleOpenLoginHistory = async (user: SuperAdminUserItem) => {
    setSelectedUser(user);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const history = await apiClient.superAdminUsers.loginHistory(user.id);
      setHistoryList(history || []);
    } catch {
      setHistoryList([]);
      toast.error("Could not fetch login history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (user: SuperAdminUserItem) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || "",
      role: user.role || "DEVELOPER",
      department: user.department || "",
      organizationId: user.organization_id || "",
      phone: user.phone || "",
    });
    setEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <PageHeader
        title="User Management"
        description="Create accounts and email each owner a single-use link to set their own password. Platform operators are created in Operator Management."
        badge={`${totalElements} Registered`}
        actions={
          <div className="flex items-center gap-2">
            <AdminButton
              variant="secondary"
              onClick={() => fetchUsers()}
              isLoading={isLoading}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </AdminButton>
            <AdminButton
              variant="primary"
              onClick={() => setCreateModalOpen(true)}
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              Create User
            </AdminButton>
          </div>
        }
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Registered Users"
          value={totalElements}
          icon={Users}
          tone="slate"
          sublabel="Across all 9 roles & organizations"
        />
        <KpiCard
          label="Active Accounts"
          value={activeCount}
          icon={UserCheck}
          tone="emerald"
          sublabel="Can sign in and access dashboards"
        />
        <KpiCard
          label="Pending Activation"
          value={pendingActivationCount}
          icon={KeyRound}
          tone="amber"
          sublabel="Waiting for the owner to set a password"
        />
        <KpiCard
          label="Deactivated Users"
          value={disabledCount}
          icon={Lock}
          tone="rose"
          sublabel="Access blocked; sessions revoked"
        />
      </div>

      {/* 3. Search & Filter Bar */}
      <FilterBar
        search={searchTerm}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setPage(0);
        }}
        searchPlaceholder="Search by user name or email..."
        hasActiveFilters={Boolean(searchTerm || selectedRole !== "ALL" || selectedStatus !== "ALL" || selectedOrg !== "ALL")}
        onResetFilters={() => {
          setSearchTerm("");
          setSelectedRole("ALL");
          setSelectedStatus("ALL");
          setSelectedOrg("ALL");
          setPage(0);
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-36">
              <AdminSelect
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value);
                  setPage(0);
                }}
                options={[
                  { value: "ALL", label: "All Roles (9)" },
                  ...ALL_ROLES.map((r) => ({ value: r.value, label: r.label })),
                ]}
              />
            </div>
            <div className="w-32">
              <AdminSelect
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(0);
                }}
                options={[
                  { value: "ALL", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "PENDING_ACTIVATION", label: "Pending activation" },
                  { value: "DISABLED", label: "Deactivated" },
                ]}
              />
            </div>
            <div className="w-40">
              <AdminSelect
                value={selectedOrg}
                onChange={(e) => {
                  setSelectedOrg(e.target.value);
                  setPage(0);
                }}
                options={[
                  { value: "ALL", label: "All Organizations" },
                  ...organizations.map((org) => ({ value: org.id, label: org.name })),
                ]}
              />
            </div>
          </div>
        }
      />

      {/* 4. Users Table */}
      <SurfaceCard className="overflow-hidden">
        {users.length === 0 && !isLoading && loadError ? (
          <EmptyStateView
            icon={AlertCircle}
            title="Could not load users"
            description={loadError}
            actionLabel="Try again"
            onAction={() => fetchUsers()}
          />
        ) : users.length === 0 && !isLoading ? (
          <EmptyStateView
            icon={Users}
            title="No Users Found"
            description="No users matched your search and filter criteria. You can create a new user to grant platform access."
            actionLabel="Create User"
            onAction={() => setCreateModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)] font-medium">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Organization / Department</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Account Setup</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text-primary)]">
                {users.map((user) => {
                  const roleStyle = ROLE_BADGE_STYLES[user.role] || "border-gray-500/30 bg-gray-500/10 text-gray-700";
                  const initial = user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase();

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-[var(--color-elevated)]/60 transition-colors"
                    >
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600/15 border border-blue-600/30 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{user.name || "Unnamed User"}</p>
                            <p className="text-xs text-[var(--color-text-secondary)] truncate flex items-center gap-1">
                              <Mail className="w-3 h-3 shrink-0" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${roleStyle}`}
                        >
                          <Shield className="w-3 h-3 shrink-0" />
                          {user.role}
                        </span>
                      </td>

                      {/* Organization / Department */}
                      <td className="py-3 px-4">
                        {user.organization_name ? (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-primary)]">
                            <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="truncate">{user.organization_name}</span>
                          </div>
                        ) : user.department ? (
                          <span className="inline-flex items-center rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-700 dark:text-cyan-300">
                            {user.department}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)] italic">Global / None</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge
                          label={STATUS_LABELS[user.status] ?? user.status}
                          tone={
                            user.status === "ACTIVE"
                              ? "success"
                              : user.status === "PENDING_ACTIVATION"
                                ? "warning"
                                : "danger"
                          }
                        />
                      </td>

                      {/* Account setup: latest setup email for pending accounts */}
                      <td className="py-3 px-4">
                        {user.status === "PENDING_ACTIVATION" ? (
                          (() => {
                            const setup =
                              SETUP_EMAIL_LABELS[user.email_delivery_status ?? "NOT_REQUESTED"] ??
                              SETUP_EMAIL_LABELS.NOT_REQUESTED;
                            const toneClass =
                              setup.tone === "ok"
                                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                : setup.tone === "bad"
                                  ? "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
                                  : "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20";
                            return (
                              <span
                                title={user.email_delivery_message ?? undefined}
                                className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-md px-2 py-0.5 ${toneClass}`}
                              >
                                <Mail className="w-3 h-3" />
                                {setup.label}
                              </span>
                            );
                          })()
                        ) : user.must_change_password ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5">
                            <KeyRound className="w-3 h-3" />
                            Must change password
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            Password set
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                        {user.last_login_at ? formatDateTime(user.last_login_at) : "Never logged in"}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {user.status === "PENDING_ACTIVATION" && (
                            <button
                              title="Resend setup link"
                              aria-label={`Resend setup link to ${user.email}`}
                              onClick={() => handleResendSetupLink(user)}
                              className="p-1.5 rounded-md hover:bg-[var(--color-elevated)] text-[var(--color-text-secondary)] hover:text-blue-500 transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {user.status === "ACTIVE" && (
                            <button
                              title="Send password reset link"
                              aria-label={`Send password reset link to ${user.email}`}
                              onClick={() => handleSendResetLink(user)}
                              className="p-1.5 rounded-md hover:bg-[var(--color-elevated)] text-[var(--color-text-secondary)] hover:text-amber-500 transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            title="View Login History"
                            onClick={() => handleOpenLoginHistory(user)}
                            className="p-1.5 rounded-md hover:bg-[var(--color-elevated)] text-[var(--color-text-secondary)] hover:text-purple-500 transition-colors"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Edit User"
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 rounded-md hover:bg-[var(--color-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title={user.status === "DISABLED" ? "Activate Account" : "Deactivate Account"}
                            onClick={() => {
                              setStatusActionTarget(user);
                              setConfirmStatusModalOpen(true);
                            }}
                            className={`p-1.5 rounded-md hover:bg-[var(--color-elevated)] transition-colors ${
                              user.status !== "DISABLED"
                                ? "text-rose-500 hover:text-rose-600"
                                : "text-emerald-500 hover:text-emerald-600"
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalElements > 0 && (
          <div className="border-t border-[var(--color-border)] p-3">
            <PaginationBar
              currentPage={page + 1}
              totalItems={totalElements}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p - 1)}
            />
          </div>
        )}
      </SurfaceCard>

      {/* =====================================================================
       * 5. MODALS
       * ===================================================================== */}

      {/* Modal 1: Create User */}
      <AdminModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New User"
        description="The account stays pending until its owner opens the emailed link and chooses a password. No password is set or shown here."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <AdminInput
            label="Full Name"
            placeholder="e.g. Alex Henderson"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            required
          />

          <AdminInput
            label="Gmail / Work Email"
            type="email"
            placeholder="e.g. alex.henderson@gmail.com"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminSelect
              label="Assigned Role"
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
              options={ASSIGNABLE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
            />

            <AdminInput
              label="Phone Number (Optional)"
              placeholder="+1 (555) 000-0000"
              value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
            />
          </div>

          <AdminSelect
            label="Organization Workspace"
            value={createForm.organizationId}
            onChange={(e) => setCreateForm({ ...createForm, organizationId: e.target.value })}
            options={[
              { value: "", label: "No Organization (Viewer / Global)" },
              ...organizations.map((org) => ({ value: org.id, label: org.name })),
            ]}
          />

          {/* Send Email Checkbox */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="sendEmailCheck"
              checked={createForm.sendEmail}
              onChange={(e) => setCreateForm({ ...createForm, sendEmail: e.target.checked })}
              className="rounded border-[var(--color-border)] text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <label
              htmlFor="sendEmailCheck"
              className="text-xs font-medium text-[var(--color-text-primary)] cursor-pointer"
            >
              Email the owner a setup link now (valid 72 hours). You can resend it later.
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <AdminButton variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton variant="primary" type="submit">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              Create account
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Modal 2: Credentials Delivered Popup */}
      <AdminModal
        isOpen={credentialsModalOpen}
        onClose={() => setCredentialsModalOpen(false)}
        title={credentialDetails ? DELIVERY_TITLES[credentialDetails.actionType] : ""}
        description="Only the account owner receives the link. No password is created, stored for you, or shown here."
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] text-xs flex items-start gap-2.5">
            <Mail className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <p>
              Account: <span className="font-semibold">{credentialDetails?.email}</span>
            </p>
          </div>

          {/* Email Delivery Status */}
          <div className="p-3 rounded-lg bg-[var(--color-elevated)] border border-[var(--color-border)] space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--color-text-secondary)]">Email Delivery:</span>
              <span
                className={`font-semibold text-[11px] ${
                  credentialDetails?.deliveryStatus === "DELIVERED"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : credentialDetails?.deliveryStatus === "FAILED"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {credentialDetails?.deliveryStatus === "DELIVERED"
                  ? "Sent"
                  : credentialDetails?.deliveryStatus === "FAILED"
                    ? "Failed"
                    : credentialDetails?.deliveryStatus === "NOT_SENT"
                      ? "Not sent"
                      : "Not requested"}
              </span>
            </div>
            {credentialDetails?.deliveryMessage && (
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {credentialDetails.deliveryMessage}
              </p>
            )}
          </div>

          <div className="flex justify-end pt-3">
            <AdminButton variant="primary" onClick={() => setCredentialsModalOpen(false)}>
              Done
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* Modal 3: Edit User */}
      <AdminModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit User — ${selectedUser?.email}`}
        description="Update role assignment, organization workspace, or contact details."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <AdminInput
            label="Full Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminSelect
              label="Assigned Role"
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              disabled={NON_ASSIGNABLE_ROLES.has(editForm.role)}
              options={
                NON_ASSIGNABLE_ROLES.has(editForm.role)
                  ? ALL_ROLES.filter((r) => r.value === editForm.role).map((r) => ({ value: r.value, label: r.label }))
                  : ASSIGNABLE_ROLES.map((r) => ({ value: r.value, label: r.label }))
              }
            />

            <AdminInput
              label="Phone Number"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>

          {/* Department if PLATFORM_OPERATOR */}
          {editForm.role === "PLATFORM_OPERATOR" && (
            <AdminSelect
              label="Operator Department"
              value={editForm.department}
              onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
              options={[
                { value: "", label: "Select Department..." },
                ...DEPARTMENT_OPTIONS.map((d) => ({ value: d, label: d })),
              ]}
            />
          )}

          {/* Organization if Org Role */}
          {editForm.role !== "SUPER_ADMIN" && editForm.role !== "PLATFORM_OPERATOR" && (
            <AdminSelect
              label="Organization Workspace"
              value={editForm.organizationId}
              onChange={(e) => setEditForm({ ...editForm, organizationId: e.target.value })}
              options={[
                { value: "", label: "No Organization (Viewer / Global)" },
                ...organizations.map((org) => ({ value: org.id, label: org.name })),
              ]}
            />
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <AdminButton variant="secondary" onClick={() => setEditModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton variant="primary" type="submit">
              Save Changes
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Modal 4: Login History */}
      <AdminModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Login History — ${selectedUser?.email}`}
        description="Audit records of recent authentication attempts for this user account."
      >
        <div className="space-y-3">
          {loadingHistory ? (
            <div className="py-8 text-center text-xs text-[var(--color-text-secondary)]">
              Loading authentication audit history...
            </div>
          ) : historyList.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--color-text-secondary)]">
              No login history recorded yet for this user.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {historyList.map((h) => (
                <div
                  key={h.id}
                  className="p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] text-xs flex items-start justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold text-[11px] px-1.5 py-0.5 rounded ${
                          h.status === "SUCCESS"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {h.status}
                      </span>
                      <span className="text-[var(--color-text-primary)] font-medium">
                        IP: {h.ip_address || "127.0.0.1"}
                      </span>
                    </div>
                    {h.user_agent && (
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate max-w-sm">
                        {h.user_agent}
                      </p>
                    )}
                    {h.failure_reason && (
                      <p className="text-[11px] text-rose-500">
                        Reason: {h.failure_reason}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--color-text-secondary)] shrink-0">
                    {formatDateTime(h.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-[var(--color-border)]">
            <AdminButton variant="secondary" onClick={() => setHistoryModalOpen(false)}>
              Close
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* Modal 5: Confirm Status Toggle */}
      <ConfirmActionModal
        isOpen={confirmStatusModalOpen}
        onClose={() => setConfirmStatusModalOpen(false)}
        onConfirm={handleConfirmStatusToggle}
        title={
          statusActionTarget?.status !== "DISABLED"
            ? `Deactivate User Account`
            : `Reactivate User Account`
        }
        description={
          statusActionTarget?.status === "PENDING_ACTIVATION"
            ? `Deactivate ${statusActionTarget?.email}? Its setup link stops working and the account cannot be activated until you re-enable it.`
            : statusActionTarget?.status === "ACTIVE"
              ? `Are you sure you want to deactivate ${statusActionTarget?.email}? The user will immediately be blocked from logging in and all active sessions will be terminated.`
              : `Are you sure you want to reactivate ${statusActionTarget?.email}? The user will once again be able to log in to their dashboard.`
        }
        confirmLabel={statusActionTarget?.status !== "DISABLED" ? "Deactivate" : "Activate"}
        variant={statusActionTarget?.status !== "DISABLED" ? "danger" : "primary"}
      />
    </div>
  );
}
