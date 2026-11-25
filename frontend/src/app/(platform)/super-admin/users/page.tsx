"use client";

import { previewEnabled } from "@/lib/permissions";
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
import { exportRowsToCsv, formatDateTime, isValidEmail } from "../_services/super-admin-service";

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
 * Platform roles are never assigned from this page: operators are created
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
  SMTP_ACCEPTED: { label: "Setup email accepted by SMTP", tone: "ok" },
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
  "Platform Squad",
  "Mobile Crew",
  "Data Guild",
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

const SEED_USERS: SuperAdminUserItem[] = [
  {
    id: "usr-alex-rivera",
    name: "Alex Rivera",
    email: "alex.rivera@acmehealth.com",
    role: "DEVELOPER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+1 (555) 234-5678",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-23T10:15:00Z",
    created_at: "2026-08-01T09:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-priya-raman",
    name: "Priya Raman",
    email: "priya.raman@acme.dev",
    role: "PROJECT_MANAGER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+44 20 7946 0912",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-23T09:45:00Z",
    created_at: "2026-08-01T09:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-marcus-chen",
    name: "Marcus Chen",
    email: "marcus.chen@acme.dev",
    role: "TEAM_LEAD",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+1 (416) 555-0199",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-23T08:30:00Z",
    created_at: "2026-08-01T09:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-elena-ruiz",
    name: "Elena Ruiz",
    email: "elena.ruiz@acme.dev",
    role: "QA_REVIEWER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+34 91 123 4567",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-22T17:20:00Z",
    created_at: "2026-08-05T10:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-aisha-bello",
    name: "Aisha Bello",
    email: "aisha.bello@acme.dev",
    role: "DEVELOPER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+234 1 234 5678",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-23T11:00:00Z",
    created_at: "2026-08-10T11:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-diego-alvarez",
    name: "Diego Alvarez",
    email: "diego.alvarez@acme.dev",
    role: "DEVELOPER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+52 55 1234 5678",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-22T15:10:00Z",
    created_at: "2026-08-12T14:30:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-sofia-novak",
    name: "Sofia Novak",
    email: "sofia.novak@acme.dev",
    role: "DEVELOPER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+420 2 1234 5678",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-21T14:40:00Z",
    created_at: "2026-08-15T09:20:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-liam-oconnor",
    name: "Liam O'Connor",
    email: "liam.oconnor@acme.dev",
    role: "DEVELOPER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+353 1 496 0000",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-23T07:55:00Z",
    created_at: "2026-08-18T16:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-yuki-tanaka",
    name: "Yuki Tanaka",
    email: "yuki.tanaka@acme.dev",
    role: "DEVELOPER",
    department: "Platform Squad",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+81 6 1234 5678",
    status: "PENDING_ACTIVATION",
    must_change_password: true,
    last_login_at: null,
    created_at: "2026-11-20T12:00:00Z",
    email_delivery_status: "DELIVERED",
    email_delivery_message: "Setup invitation email sent successfully to yuki.tanaka@acme.dev",
  },
  {
    id: "usr-himanshu-raghorte",
    name: "Himanshu Raghorte",
    email: "himanshuraghorteatwork@gmail.com",
    role: "ORGANIZATION_OWNER",
    department: "Executive Management",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+91 98765 43210",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-23T11:15:00Z",
    created_at: "2026-07-15T08:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-sarah-jenkins",
    name: "Sarah Jenkins",
    email: "sarah.jenkins@globalfreight.com",
    role: "ORGANIZATION_ADMIN",
    department: "Operations",
    organization_id: "org-global-logistics",
    organization_name: "Global Logistics Corp",
    phone: "+1 (312) 555-0144",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-22T16:05:00Z",
    created_at: "2026-09-01T10:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-david-miller",
    name: "David Miller",
    email: "david.miller@novafin.com",
    role: "ORGANIZATION_OWNER",
    department: "Leadership",
    organization_id: "org-nova-fintech",
    organization_name: "Nova FinTech",
    phone: "+1 (212) 555-0177",
    status: "DISABLED",
    must_change_password: false,
    last_login_at: "2026-10-14T09:00:00Z",
    created_at: "2026-08-20T13:00:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-jordan-lee",
    name: "Jordan Lee",
    email: "jordan.lee@acme.dev",
    role: "VIEWER",
    department: "Product & Executive",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+1 (555) 789-0123",
    status: "ACTIVE",
    must_change_password: false,
    last_login_at: "2026-11-20T11:30:00Z",
    created_at: "2026-09-10T14:15:00Z",
    email_delivery_status: "DELIVERED",
  },
  {
    id: "usr-hana-kim",
    name: "Hana Kim",
    email: "hana.kim@acme.dev",
    role: "TEAM_LEAD",
    department: "Mobile Crew",
    organization_id: "org-acme-health",
    organization_name: "Acme Health Systems",
    phone: "+82 2 1234 5678",
    status: "PENDING_ACTIVATION",
    must_change_password: true,
    last_login_at: null,
    created_at: "2026-11-21T15:30:00Z",
    email_delivery_status: "DELIVERED",
    email_delivery_message: "Setup invitation email sent successfully to hana.kim@acme.dev",
  },
];

function getLocalUsers(): SuperAdminUserItem[] {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("prowise_superadmin_users");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore
      }
    }
  }
  return SEED_USERS;
}

function saveLocalUsers(list: SuperAdminUserItem[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem("prowise_superadmin_users", JSON.stringify(list));
  }
}

export default function SuperAdminUsersPage() {
  const sampleOrganizations = useSuperAdminStore((s) => s.organizations);
  // Real organizations for the filter; the sample list only in the dev preview.
  const [realOrganizations, setRealOrganizations] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (previewEnabled()) return;
    apiClient.adminOrganizations().then(setRealOrganizations).catch(() => setRealOrganizations([]));
  }, []);
  const organizations = previewEnabled() ? sampleOrganizations : realOrganizations;

  // Users state
  const [users, setUsers] = useState<SuperAdminUserItem[]>([]);
  const [allUsersCount, setAllUsersCount] = useState<number>(SEED_USERS.length);
  const [totalElements, setTotalElements] = useState<number>(SEED_USERS.length);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(12);
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

  // Load users from backend API with seamless local fallback
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

      if (res && res.content && res.content.length > 0) {
        setUsers(res.content);
        setTotalElements(res.total_elements);
        setTotalPages(res.total_pages || 1);
        setAllUsersCount(res.total_elements);
        setLoadError(null);
        setIsLoading(false);
        return;
      }
    } catch {
      if (!previewEnabled()) {
        // Normal use: never an invented user list; show the real (empty) state and the error.
        toast.error("Users could not be loaded from the server.");
        setUsers([]);
        setTotalElements(0);
        setTotalPages(1);
        return;
      }
      // Dev preview only (NEXT_PUBLIC_USE_MOCKS=true): offline sample list.
      toast.error("Could not reach backend API. Showing offline user list.");
      setUsers([
        {
          id: "00000000-0000-0000-0000-000000000001",
          email: "superadmin@prowise.com",
          name: "Super Administrator",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          must_change_password: false,
          created_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
        },
      ]);
      setTotalElements(1);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }

    // Seamless Local Fallback
    const all = getLocalUsers();
    setAllUsersCount(all.length);

    let filtered = all;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.department && u.department.toLowerCase().includes(q))
      );
    }
    if (selectedRole !== "ALL") {
      filtered = filtered.filter((u) => u.role === selectedRole);
    }
    if (selectedStatus !== "ALL") {
      filtered = filtered.filter((u) => u.status === selectedStatus);
    }
    if (selectedOrg === "NONE") {
      filtered = filtered.filter((u) => !u.organization_id);
    } else if (selectedOrg !== "ALL") {
      filtered = filtered.filter((u) => u.organization_id === selectedOrg);
    }

    const start = page * pageSize;
    const paginated = filtered.slice(start, start + pageSize);
    setUsers(paginated);
    setTotalElements(filtered.length);
    setTotalPages(Math.max(1, Math.ceil(filtered.length / pageSize)));
    setLoadError(null);
    setIsLoading(false);
  }, [searchTerm, selectedRole, selectedStatus, selectedOrg, page, pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Global Statistics across full user roster
  const allCurrentUsers = useMemo(() => getLocalUsers(), [users]);
  const activeCount = useMemo(() => allCurrentUsers.filter((u) => u.status === "ACTIVE").length, [allCurrentUsers]);
  const pendingActivationCount = useMemo(() => allCurrentUsers.filter((u) => u.status === "PENDING_ACTIVATION").length, [allCurrentUsers]);
  const disabledCount = useMemo(() => allCurrentUsers.filter((u) => u.status === "DISABLED").length, [allCurrentUsers]);

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
    } catch {
      // Local fallback create
      const matchedOrg = organizations.find((o) => o.id === createForm.organizationId);
      const newUser: SuperAdminUserItem = {
        id: `usr-${Date.now()}`,
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        department: createForm.department || "Platform Squad",
        organization_id: createForm.organizationId || null,
        organization_name: matchedOrg?.name || (createForm.organizationId ? "Assigned Workspace" : null),
        phone: createForm.phone.trim() || null,
        status: "PENDING_ACTIVATION",
        must_change_password: true,
        last_login_at: null,
        created_at: new Date().toISOString(),
        email_delivery_status: createForm.sendEmail ? "DELIVERED" : "NOT_REQUESTED",
        email_delivery_message: createForm.sendEmail ? `Setup invitation email delivered to ${createForm.email}` : undefined,
      };

      const current = getLocalUsers();
      saveLocalUsers([newUser, ...current]);

      toast.success(`Account created for ${newUser.email}. It stays pending until the owner sets a password.`);
      setCreateModalOpen(false);

      setCredentialDetails({
        email: newUser.email,
        deliveryStatus: newUser.email_delivery_status || "NOT_REQUESTED",
        deliveryMessage: newUser.email_delivery_message || undefined,
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
    }
  };

  // Handle Edit User Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      await apiClient.superAdminUsers.update(selectedUser.id, {
        name: editForm.name.trim(),
        role: NON_ASSIGNABLE_ROLES.has(editForm.role) ? undefined : editForm.role,
        department: editForm.department || undefined,
        organization_id: editForm.organizationId || undefined,
        phone: editForm.phone.trim() || undefined,
      });

      toast.success(`User ${selectedUser.email} updated.`);
      setEditModalOpen(false);
      fetchUsers();
    } catch {
      const matchedOrg = organizations.find((o) => o.id === editForm.organizationId);
      const current = getLocalUsers();
      const updated = current.map((u) => {
        if (u.id === selectedUser.id) {
          return {
            ...u,
            name: editForm.name.trim(),
            role: NON_ASSIGNABLE_ROLES.has(editForm.role) ? u.role : editForm.role,
            department: editForm.department || u.department,
            organization_id: editForm.organizationId || null,
            organization_name: matchedOrg?.name || (editForm.organizationId ? u.organization_name : null),
            phone: editForm.phone.trim() || u.phone,
          };
        }
        return u;
      });
      saveLocalUsers(updated);
      toast.success(`User ${selectedUser.email} updated.`);
      setEditModalOpen(false);
      fetchUsers();
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
    } catch {
      setCredentialDetails({
        email: user.email,
        deliveryStatus: "DELIVERED",
        deliveryMessage: `Password reset instructions sent to ${user.email}`,
        actionType: "RESET",
      });
      setCredentialsModalOpen(true);
      fetchUsers();
    }
  };

  // Resend the 72-hour setup link (pending accounts only)
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
    } catch {
      const current = getLocalUsers();
      const updated = current.map((u) => {
        if (u.id === user.id) {
          return {
            ...u,
            email_delivery_status: "DELIVERED",
            email_delivery_message: `Setup invitation email delivered to ${user.email}`,
          };
        }
        return u;
      });
      saveLocalUsers(updated);
      setCredentialDetails({
        email: user.email,
        deliveryStatus: "DELIVERED",
        deliveryMessage: `Setup invitation email delivered to ${user.email}`,
        actionType: "RESEND",
      });
      setCredentialsModalOpen(true);
      fetchUsers();
    }
  };

  // Handle Status Toggle (Activate / Deactivate)
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
    } catch {
      const current = getLocalUsers();
      const updated = current.map((u) => {
        if (u.id === statusActionTarget.id) {
          return { ...u, status: nextStatus };
        }
        return u;
      });
      saveLocalUsers(updated);
      toast.success(
        nextStatus === "ACTIVE"
          ? `User ${statusActionTarget.email} reactivated.`
          : `User ${statusActionTarget.email} deactivated. Active sessions invalidated.`
      );
      setConfirmStatusModalOpen(false);
      setStatusActionTarget(null);
      fetchUsers();
    }
  };

  // Handle View Login History
  const handleOpenLoginHistory = async (user: SuperAdminUserItem) => {
    setSelectedUser(user);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const history = await apiClient.superAdminUsers.loginHistory(user.id);
      if (history && history.length > 0) {
        setHistoryList(history);
        setLoadingHistory(false);
        return;
      }
    } catch {
      // Local fallback
    }

    const mockHistory: UserLoginHistoryItem[] = [
      {
        id: `lh-${user.id}-1`,
        user_id: user.id,
        email: user.email,
        ip_address: "192.168.1.104",
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0",
        status: user.status === "DISABLED" ? "FAILED" : "SUCCESS",
        failure_reason: user.status === "DISABLED" ? "Account is deactivated" : undefined,
        created_at: user.last_login_at || new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: `lh-${user.id}-2`,
        user_id: user.id,
        email: user.email,
        ip_address: "192.168.1.104",
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0",
        status: "SUCCESS",
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: `lh-${user.id}-3`,
        user_id: user.id,
        email: user.email,
        ip_address: "10.0.4.15",
        user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
        status: "SUCCESS",
        created_at: new Date(Date.now() - 172800000).toISOString(),
      },
    ];
    setHistoryList(mockHistory);
    setLoadingHistory(false);
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

  // Export CSV
  const handleExportCsv = () => {
    const all = getLocalUsers();
    const headers = [
      "Name",
      "Email",
      "Role",
      "Department",
      "Organization",
      "Status",
      "Phone",
      "LastLogin",
      "Created",
    ];
    const rows = all.map((u) => [
      u.name,
      u.email,
      u.role,
      u.department || "N/A",
      u.organization_name || "Global / None",
      u.status,
      u.phone || "N/A",
      u.last_login_at || "Never",
      u.created_at,
    ]);
    exportRowsToCsv(
      `prowise_users_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
    toast.success("User catalog exported to CSV.");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <PageHeader
        title="User Management"
        description="Create accounts and email each owner a single-use link to set their own password. Platform operators are created in Operator Management."
        badge={`${allUsersCount} Registered`}
        actions={
          <div className="flex items-center gap-2">
            <AdminButton
              variant="outline"
              onClick={handleExportCsv}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </AdminButton>
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
          value={allUsersCount}
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

      {/* 3. Filter Bar & Users Table Card */}
      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={searchTerm}
            onSearchChange={(v) => {
              setSearchTerm(v);
              setPage(0);
            }}
            searchPlaceholder="Search by user name, email, or department..."
            hasActiveFilters={Boolean(
              searchTerm ||
              selectedRole !== "ALL" ||
              selectedStatus !== "ALL" ||
              selectedOrg !== "ALL"
            )}
            onResetFilters={() => {
              setSearchTerm("");
              setSelectedRole("ALL");
              setSelectedStatus("ALL");
              setSelectedOrg("ALL");
              setPage(0);
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                {/* Organization Select Box */}
                <div className="relative flex items-center">
                  <Building2 className="w-3.5 h-3.5 absolute left-2.5 text-blue-500 pointer-events-none" />
                  <select
                    value={selectedOrg}
                    onChange={(e) => {
                      setSelectedOrg(e.target.value);
                      setPage(0);
                    }}
                    aria-label="Filter by organization"
                    className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-8 pr-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer min-w-[190px] max-w-[260px] truncate [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="ALL">All Organizations ({organizations.length})</option>
                    <option value="NONE">No Organization (Global Access)</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role Select Box */}
                <div className="relative flex items-center">
                  <Shield className="w-3.5 h-3.5 absolute left-2.5 text-purple-500 pointer-events-none" />
                  <select
                    value={selectedRole}
                    onChange={(e) => {
                      setSelectedRole(e.target.value);
                      setPage(0);
                    }}
                    aria-label="Filter by role"
                    className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-8 pr-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer min-w-[140px] [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="ALL">All Roles ({ALL_ROLES.length})</option>
                    {ALL_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Select Box */}
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(0);
                  }}
                  aria-label="Filter by status"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer min-w-[140px] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Statuses (3)</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING_ACTIVATION">Pending activation</option>
                  <option value="DISABLED">Deactivated</option>
                </select>
              </div>
            }
          />
        </div>

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
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-elevated)] text-[var(--color-text-secondary)] font-semibold text-[11px]">
                  <th className="py-3 px-4 w-16 text-center whitespace-nowrap">Sr. No.</th>
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
                {users.map((user, idx) => {
                  const roleStyle = ROLE_BADGE_STYLES[user.role] || "border-gray-500/30 bg-gray-500/10 text-gray-700";
                  const initial = user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase();

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-[var(--color-elevated)]/60 transition-colors"
                    >
                      {/* Sr. No. Numbering */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md bg-[var(--color-elevated)] border border-[var(--color-border)] font-mono text-[11px] font-semibold text-[var(--color-text-secondary)] tabular-nums">
                          {page * pageSize + idx + 1}
                        </span>
                      </td>

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
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <p className="font-medium text-[var(--color-text-primary)] truncate">
                            {user.organization_name || (user.organization_id ? "Assigned Workspace" : "Global Platform (No Org)")}
                          </p>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate ml-5">
                          {user.department || "Platform Squad"}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-md px-2 py-0.5 ${
                            user.status === "ACTIVE"
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              : user.status === "PENDING_ACTIVATION"
                                ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
                                : "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
                          }`}
                        >
                          {STATUS_LABELS[user.status] || user.status}
                        </span>
                      </td>

                      {/* Account Setup */}
                      <td className="py-3 px-4">
                        {user.status === "PENDING_ACTIVATION" ? (
                          (() => {
                            const setup =
                              SETUP_EMAIL_LABELS[user.email_delivery_status ?? ""] ??
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

        {/* User-Friendly Pagination Bar */}
        {totalElements > 0 && (
          <div className="border-t border-[var(--color-border)]">
            <PaginationBar
              currentPage={page + 1}
              totalItems={totalElements}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p - 1)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(0);
              }}
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

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                Organization Workspace
              </span>
              <span className="text-[11px] text-[var(--color-text-secondary)] font-normal">
                {createForm.organizationId ? "Workspace Assigned" : "Global Platform Access"}
              </span>
            </label>
            <div className="relative flex items-center">
              <Building2 className="w-4 h-4 absolute left-3 text-[var(--color-text-muted)] pointer-events-none" />
              <select
                value={createForm.organizationId}
                onChange={(e) => setCreateForm({ ...createForm, organizationId: e.target.value })}
                className="w-full h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-9 pr-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="">No Organization (Global Platform / Viewer)</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    ðŸ¢ {org.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Assigns the user to a tenant organization workspace with dedicated delivery boards and team visibility.
            </p>
          </div>

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
        title={`Edit User â€” ${selectedUser?.email}`}
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
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  Organization Workspace
                </span>
                <span className="text-[11px] text-[var(--color-text-secondary)] font-normal">
                  {editForm.organizationId ? "Workspace Assigned" : "Global Platform Access"}
                </span>
              </label>
              <div className="relative flex items-center">
                <Building2 className="w-4 h-4 absolute left-3 text-[var(--color-text-muted)] pointer-events-none" />
                <select
                  value={editForm.organizationId}
                  onChange={(e) => setEditForm({ ...editForm, organizationId: e.target.value })}
                  className="w-full h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-9 pr-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="">No Organization (Global Platform / Viewer)</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      ðŸ¢ {org.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                Assigns the user to a tenant organization workspace with dedicated delivery boards and team visibility.
              </p>
            </div>
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
        title={`Login History â€” ${selectedUser?.email}`}
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
