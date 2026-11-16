"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Ban,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BillingCycle, OrgStatus, TenantOrganization } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import {
  exportRowsToCsv,
  formatCurrency,
  formatDateTime,
  formatShortDate,
  isValidEmail,
  isValidSlug,
  slugify,
} from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
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
import { InvoiceModal } from "../_components/InvoiceModal";

type SortKey = "name" | "mrr" | "seatsUsed" | "createdAt";

interface ParsedImportRow {
  name: string;
  slug: string;
  domain: string;
  ownerName: string;
  ownerEmail: string;
  industry: string;
  planCode: string;
  valid: boolean;
  issue?: string;
}

const SAMPLE_IMPORT_ROWS: ParsedImportRow[] = [
  {
    name: "Meridian Aerospace",
    slug: "meridian-aerospace",
    domain: "meridianaero.com",
    ownerName: "Claire Sutton",
    ownerEmail: "claire@meridianaero.com",
    industry: "Aerospace & Defense",
    planCode: "ENTERPRISE",
    valid: true,
  },
  {
    name: "CivicGrid Energy",
    slug: "civicgrid-energy",
    domain: "civicgrid.io",
    ownerName: "Devon Patel",
    ownerEmail: "devon@civicgrid.io",
    industry: "CleanTech & Energy",
    planCode: "PROFESSIONAL",
    valid: true,
  },
];

const INDUSTRY_OPTIONS = [
  "Enterprise Software",
  "HealthTech",
  "Healthcare IT",
  "FinTech & Banking",
  "Logistics & Supply Chain",
  "Biotechnology",
  "E-Commerce & Retail",
  "Mobility & Automotive",
  "Aerospace & Defense",
  "CleanTech & Energy",
  "Cybersecurity",
  "AI & Data Cloud",
  "Education & EdTech",
  "Manufacturing",
  "Media & Telecommunications",
  "Real Estate & PropTech",
  "Professional Services",
  "Government & Public Sector",
];

const COUNTRY_OPTIONS = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Netherlands",
  "Switzerland",
  "Ireland",
  "India",
  "Singapore",
  "Japan",
  "Australia",
  "United Arab Emirates",
  "Sweden",
  "Spain",
  "Italy",
  "Brazil",
  "Mexico",
  "South Korea",
  "Israel",
];

function parseOrganizationCsv(rawCsv: string): ParsedImportRow[] {
  const lines = rawCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const firstLower = lines[0].toLowerCase();
  const dataLines =
    firstLower.includes("name") && firstLower.includes("domain") ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const [rawName = "", rawDomain = "", rawOwnerName = "", rawOwnerEmail = "", rawIndustry = "Enterprise Software", rawPlanCode = "PROFESSIONAL"] =
      cols;
    const cleanSlug = slugify(rawName);
    let issue: string | undefined;
    if (rawName.length < 2) issue = "Organization name required";
    else if (!cleanSlug || !isValidSlug(cleanSlug)) issue = "Invalid name for slug";
    else if (!rawDomain.includes(".")) issue = "Valid domain required";
    else if (!rawOwnerName) issue = "Owner name required";
    else if (!isValidEmail(rawOwnerEmail)) issue = "Valid owner email required";

    return {
      name: rawName,
      slug: cleanSlug,
      domain: rawDomain,
      ownerName: rawOwnerName,
      ownerEmail: rawOwnerEmail,
      industry: rawIndustry || "Enterprise Software",
      planCode: rawPlanCode || "PROFESSIONAL",
      valid: !issue,
      issue,
    };
  });
}

const ORG_PLAN_THEMES = {
  amber: {
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    avatar: "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  violet: {
    badge: "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    avatar: "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  emerald: {
    badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    avatar: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  sky: {
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    avatar: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  rose: {
    badge: "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    avatar: "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  blue: {
    badge: "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
    avatar: "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
};

function getOrgPlanTheme(plan?: { code?: string; name?: string; brandColor?: string } | null) {
  const brand = plan?.brandColor as keyof typeof ORG_PLAN_THEMES | undefined;
  if (brand && ORG_PLAN_THEMES[brand]) return ORG_PLAN_THEMES[brand];

  const key = `${plan?.code || ""} ${plan?.name || ""}`.toLowerCase();
  if (key.includes("enterprise")) return ORG_PLAN_THEMES.amber;
  if (key.includes("pro")) return ORG_PLAN_THEMES.violet;
  if (key.includes("growth")) return ORG_PLAN_THEMES.emerald;
  if (key.includes("starter") || key.includes("free")) return ORG_PLAN_THEMES.sky;
  return ORG_PLAN_THEMES.blue;
}

function getPlanBadgeClass(
  plan?: { code?: string; name?: string; brandColor?: string } | null
): string {
  return getOrgPlanTheme(plan).badge;
}

function getIndustryBadgeClass(industry: string): string {
  const key = industry.toLowerCase();
  if (key.includes("health") || key.includes("bio")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (key.includes("fin") || key.includes("bank")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  }
  if (key.includes("cyber") || key.includes("aerospace") || key.includes("defense")) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  if (key.includes("clean") || key.includes("energy") || key.includes("logistics")) {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";
  }
  if (key.includes("commerce") || key.includes("retail") || key.includes("media")) {
    return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  }
  return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
}

function getInitials(label: string): string {
  return label
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function SuperAdminOrganizationsPage() {
  const organizations = useSuperAdminStore((s) => s.organizations);
  const plans = useSuperAdminStore((s) => s.plans);
  const subscriptions = useSuperAdminStore((s) => s.subscriptions);
  const invoices = useSuperAdminStore((s) => s.invoices);
  const payments = useSuperAdminStore((s) => s.payments);

  const createOrganization = useSuperAdminStore((s) => s.createOrganization);
  const updateOrganization = useSuperAdminStore((s) => s.updateOrganization);
  const suspendOrganization = useSuperAdminStore((s) => s.suspendOrganization);
  const reactivateOrganization = useSuperAdminStore((s) => s.reactivateOrganization);
  const deleteOrganization = useSuperAdminStore((s) => s.deleteOrganization);
  const generateInvoice = useSuperAdminStore((s) => s.generateInvoice);
  const changeSubscriptionPlan = useSuperAdminStore((s) => s.changeSubscriptionPlan);
  const assignSubscription = useSuperAdminStore((s) => s.assignSubscription);

  const { can } = useAdminPermissions();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrgStatus>("ALL");
  const [planFilter, setPlanFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("mrr");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Mutually exclusive panel states (never allow View Details and Edit or other modals to overlap)
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<TenantOrganization | null>(null);
  const [inspectOrgId, setInspectOrgId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<TenantOrganization | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TenantOrganization | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Multi-select bulk action states
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [bulkSuspendOpen, setBulkSuspendOpen] = useState(false);
  const [bulkSuspendReason, setBulkSuspendReason] = useState("");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // New Organizations dropdown state
  const [newOrgMenuOpen, setNewOrgMenuOpen] = useState(false);
  const newOrgMenuRef = useRef<HTMLDivElement | null>(null);

  // Import state
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("Enterprise Software");
  const [country, setCountry] = useState("United States");
  const [timezone, setTimezone] = useState("America/New_York");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [planId, setPlanId] = useState(plans[2]?.id || plans[0]?.id || "plan-pro");
  const [status, setStatus] = useState<"ACTIVE" | "TRIAL">("ACTIVE");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [seatsLimitOverride, setSeatsLimitOverride] = useState("100");
  const [notes, setNotes] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const closeAllPanels = () => {
    setInspectOrgId(null);
    setFormOpen(false);
    setImportOpen(false);
    setSuspendTarget(null);
    setDeleteTarget(null);
    setSelectedInvoiceId(null);
    setBulkSuspendOpen(false);
    setBulkDeleteOpen(false);
  };

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (newOrgMenuRef.current && !newOrgMenuRef.current.contains(e.target as Node)) {
        setNewOrgMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNewOrgMenuOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") {
      openCreateModal();
    } else if (params.get("import") === "1") {
      openImportModal();
    } else if (params.get("recent") === "1") {
      handleViewRecent();
    } else {
      const inspectId = params.get("inspect");
      if (inspectId) openInspectPanel(inspectId);
    }
    const q = params.get("q");
    if (q) setSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openInspectPanel = (orgId: string) => {
    closeAllPanels();
    setInspectOrgId(orgId);
  };

  const openCreateModal = () => {
    closeAllPanels();
    setEditingOrg(null);
    setName("");
    setSlug("");
    setDomain("");
    setIndustry("Enterprise Software");
    setCountry("United States");
    setTimezone("America/New_York");
    setOwnerName("");
    setOwnerEmail("");
    setPlanId(plans.find((p) => p.code === "PROFESSIONAL")?.id || plans[0]?.id || "");
    setStatus("ACTIVE");
    setBillingCycle("MONTHLY");
    setNotes("");
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditModal = (org: TenantOrganization) => {
    closeAllPanels();
    const linkedSub = subscriptions.find((s) => s.orgId === org.id);
    setEditingOrg(org);
    setName(org.name);
    setSlug(org.slug);
    setDomain(org.domain);
    setIndustry(org.industry);
    setCountry(org.country);
    setTimezone(org.timezone);
    setOwnerName(org.ownerName);
    setOwnerEmail(org.ownerEmail);
    setPlanId(org.planId);
    setBillingCycle(linkedSub?.billingCycle || "MONTHLY");
    setSeatsLimitOverride(String(org.seatsLimit));
    setNotes(org.notes || "");
    setFormErrors({});
    setFormOpen(true);
  };

  const openImportModal = () => {
    closeAllPanels();
    setImportRows([]);
    setImportError(null);
    setImportOpen(true);
  };

  const openSuspendModal = (org: TenantOrganization) => {
    closeAllPanels();
    setSuspendTarget(org);
    setSuspendReason("");
  };

  const openDeleteModal = (org: TenantOrganization) => {
    closeAllPanels();
    setDeleteTarget(org);
  };

  const openInvoicePanel = (invoiceId: string) => {
    closeAllPanels();
    setSelectedInvoiceId(invoiceId);
  };

  const handleViewRecent = () => {
    closeAllPanels();
    setSearch("");
    setStatusFilter("ALL");
    setPlanFilter("ALL");
    setSortBy("createdAt");
    setSortDir("desc");
    setPage(1);
    toast.info("Sorted organizations by newest created first");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const text = await file.text();
    const parsed = parseOrganizationCsv(text);
    if (parsed.length === 0) {
      setImportError("No rows detected in the uploaded CSV file.");
      setImportRows([]);
      return;
    }
    setImportRows(parsed);
  };

  const handleDownloadSampleCsv = () => {
    exportRowsToCsv(
      "prowise-organizations-import-template.csv",
      ["Name", "Domain", "OwnerName", "OwnerEmail", "Industry", "PlanCode"],
      [
        ["Meridian Aerospace", "meridianaero.com", "Claire Sutton", "claire@meridianaero.com", "Aerospace Systems", "ENTERPRISE"],
        ["CivicGrid Energy", "civicgrid.io", "Devon Patel", "devon@civicgrid.io", "CleanTech", "PROFESSIONAL"],
      ]
    );
    toast.success("Downloaded sample CSV import template");
  };

  const handleCommitImport = () => {
    if (!can("orgs.create")) {
      toast.error("Your active role does not allow provisioning organizations.");
      return;
    }
    const validRows = importRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      setImportError("Load or upload at least one valid organization row to import.");
      return;
    }

    let createdCount = 0;
    let skippedCount = 0;

    validRows.forEach((row) => {
      const matchedPlan =
        plans.find((p) => p.code.toLowerCase() === row.planCode.toLowerCase()) ||
        plans.find((p) => p.code === "PROFESSIONAL") ||
        plans[0];
      const res = createOrganization({
        name: row.name,
        slug: row.slug,
        domain: row.domain,
        industry: row.industry,
        country: "United States",
        timezone: "America/New_York",
        ownerName: row.ownerName,
        ownerEmail: row.ownerEmail,
        planId: matchedPlan?.id || "plan-pro",
        status: "ACTIVE",
        billingCycle: "MONTHLY",
        notes: "Provisioned via guided CSV import.",
      });
      if (res.ok) createdCount += 1;
      else skippedCount += 1;
    });

    if (createdCount > 0) {
      setSortBy("createdAt");
      setSortDir("desc");
      setPage(1);
      toast.success(
        `Imported ${createdCount} organization(s)${skippedCount > 0 ? ` (${skippedCount} skipped due to duplicate slug)` : ""}.`
      );
      setImportOpen(false);
    } else {
      setImportError("All selected organizations already exist (duplicate tenant slugs).");
    }
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = "Organization name must be at least 2 characters.";
    const cleanSlug = slugify(slug);
    if (!cleanSlug || !isValidSlug(cleanSlug)) errs.slug = "Use lowercase letters, numbers, and hyphens only.";
    if (!domain.trim() || !domain.includes(".")) errs.domain = "Enter a valid company domain (e.g. company.com).";
    if (!ownerName.trim()) errs.ownerName = "Owner full name is required.";
    if (!isValidEmail(ownerEmail)) errs.ownerEmail = "Enter a valid owner email address.";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (editingOrg) {
      const parsedSeats = Math.max(editingOrg.seatsUsed, Number(seatsLimitOverride) || editingOrg.seatsLimit);
      const linkedSub = subscriptions.find((s) => s.orgId === editingOrg.id);
      const planOrCycleChanged =
        planId !== editingOrg.planId || (linkedSub && billingCycle !== linkedSub.billingCycle);

      const res = updateOrganization(editingOrg.id, {
        name: name.trim(),
        slug: slugify(slug),
        domain: domain.trim(),
        industry: industry.trim(),
        country: country.trim(),
        timezone,
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        seatsLimit: parsedSeats,
        notes: notes.trim(),
      });
      if (!res.ok) {
        setFormErrors({ slug: res.error || "Update failed" });
        return;
      }

      if (planOrCycleChanged || !linkedSub) {
        if (linkedSub) {
          changeSubscriptionPlan(linkedSub.id, planId, billingCycle);
        } else if (planId) {
          assignSubscription({
            orgId: editingOrg.id,
            planId,
            billingCycle,
            seats: parsedSeats,
            autoRenew: true,
            paymentMethodLabel: "Corporate Invoice",
          });
        }
        updateOrganization(editingOrg.id, { seatsLimit: parsedSeats });
      }

      toast.success(`Saved changes for "${name.trim()}"`);
      setFormOpen(false);
    } else {
      const res = createOrganization({
        name: name.trim(),
        slug: slugify(slug),
        domain: domain.trim(),
        industry: industry.trim(),
        country: country.trim(),
        timezone,
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        planId,
        status,
        billingCycle,
        notes: notes.trim(),
      });
      if (!res.ok) {
        setFormErrors({ slug: res.error || "Creation failed" });
        return;
      }
      toast.success(`Provisioned organization "${name.trim()}" with linked subscription`);
      setFormOpen(false);
    }
  };

  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return organizations
      .filter((org) => {
        if (statusFilter !== "ALL" && org.status !== statusFilter) return false;
        if (planFilter !== "ALL" && org.planId !== planFilter) return false;
        if (q) {
          const hit =
            org.name.toLowerCase().includes(q) ||
            org.slug.toLowerCase().includes(q) ||
            org.domain.toLowerCase().includes(q) ||
            org.ownerEmail.toLowerCase().includes(q) ||
            org.industry.toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortBy === "name") return a.name.localeCompare(b.name) * dir;
        if (sortBy === "mrr") return (a.mrr - b.mrr) * dir;
        if (sortBy === "seatsUsed") return (a.seatsUsed - b.seatsUsed) * dir;
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      });
  }, [organizations, search, statusFilter, planFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredOrgs.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedOrgs = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredOrgs.slice(start, start + pageSize);
  }, [filteredOrgs, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, planFilter, pageSize]);

  useEffect(() => {
    const validIds = new Set(organizations.map((o) => o.id));
    setSelectedOrgIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [organizations]);

  const selectedOrgSet = useMemo(() => new Set(selectedOrgIds), [selectedOrgIds]);

  const allPageSelected =
    paginatedOrgs.length > 0 && paginatedOrgs.every((o) => selectedOrgSet.has(o.id));
  const somePageSelected =
    paginatedOrgs.some((o) => selectedOrgSet.has(o.id)) && !allPageSelected;

  const toggleSelectPage = () => {
    const pageIds = paginatedOrgs.map((o) => o.id);
    if (allPageSelected) {
      setSelectedOrgIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedOrgIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectOrg = (id: string) => {
    setSelectedOrgIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkActivate = () => {
    if (!can("orgs.suspend")) {
      toast.error("Missing orgs.suspend permission");
      return;
    }
    const targets = organizations.filter((o) => selectedOrgSet.has(o.id));
    let activatedCount = 0;
    for (const org of targets) {
      if (org.status === "SUSPENDED") {
        reactivateOrganization(org.id);
        activatedCount++;
      }
    }
    if (activatedCount === 0) {
      toast.info("None of the selected organizations are suspended.");
    } else {
      toast.success(`Reactivated ${activatedCount} organization${activatedCount === 1 ? "" : "s"}`);
      setSelectedOrgIds([]);
    }
  };

  const handleBulkExport = () => {
    if (!can("system.export")) {
      toast.error("Missing system.export permission");
      return;
    }
    const targets = organizations.filter((o) => selectedOrgSet.has(o.id));
    exportRowsToCsv(
      "prowise-organizations-selected.csv",
      ["Name", "Slug", "Domain", "Owner Email", "Plan", "Status", "Seats", "MRR ($)", "Created"],
      targets.map((o) => [
        o.name,
        o.slug,
        o.domain,
        o.ownerEmail,
        plans.find((p) => p.id === o.planId)?.name || o.planId,
        o.status,
        `${o.seatsUsed}/${o.seatsLimit}`,
        o.mrr,
        o.createdAt,
      ])
    );
    toast.success(`Exported ${targets.length} selected organization${targets.length === 1 ? "" : "s"}`);
  };

  const handleConfirmBulkSuspend = () => {
    const reason = bulkSuspendReason.trim();
    if (reason.length < 5) return;
    const targets = organizations.filter((o) => selectedOrgSet.has(o.id));
    let count = 0;
    for (const org of targets) {
      if (org.status !== "SUSPENDED") {
        suspendOrganization(org.id, reason);
        count++;
      }
    }
    toast.warning(`Suspended ${count} organization${count === 1 ? "" : "s"}`);
    setBulkSuspendOpen(false);
    setBulkSuspendReason("");
    setSelectedOrgIds([]);
  };

  const handleConfirmBulkDelete = () => {
    const targets = organizations.filter((o) => selectedOrgSet.has(o.id));
    for (const org of targets) {
      deleteOrganization(org.id);
      if (inspectOrgId === org.id) setInspectOrgId(null);
    }
    toast.success(`Deleted ${targets.length} organization${targets.length === 1 ? "" : "s"}`);
    setSelectedOrgIds([]);
    setBulkDeleteOpen(false);
  };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const inspectedOrg = inspectOrgId ? organizations.find((o) => o.id === inspectOrgId) : null;
  const inspectedPlan = inspectedOrg ? plans.find((p) => p.id === inspectedOrg.planId) : undefined;
  const inspectedSub = inspectedOrg ? subscriptions.find((s) => s.orgId === inspectedOrg.id) : undefined;
  const inspectedInvoices = inspectedOrg ? invoices.filter((i) => i.orgId === inspectedOrg.id) : [];
  const inspectedPayments = inspectedOrg ? payments.filter((p) => p.orgId === inspectedOrg.id) : [];

  // Guard so only one panel is ever visible at a time
  const isInspectVisible =
    Boolean(inspectedOrg) &&
    !formOpen &&
    !importOpen &&
    !suspendTarget &&
    !deleteTarget &&
    !selectedInvoiceId;

  const totalMrr = organizations.reduce((s, o) => s + o.mrr, 0);
  const activeCount = organizations.filter((o) => o.status === "ACTIVE").length;
  const trialCount = organizations.filter((o) => o.status === "TRIAL").length;
  const suspendedCount = organizations.filter((o) => o.status === "SUSPENDED").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organizations"
        description="Provision, inspect, edit, suspend, or decommission multi-tenant workspaces linked directly to commercial plans and billing."
        actions={
          <div className="relative" ref={newOrgMenuRef}>
            <AdminButton
              variant="primary"
              size="sm"
              aria-haspopup="menu"
              aria-expanded={newOrgMenuOpen}
              onClick={() => setNewOrgMenuOpen((v) => !v)}
            >
              <Plus className="w-3.5 h-3.5" />
              New Organizations
              <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-85" />
            </AdminButton>

            {newOrgMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl z-40"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={!can("orgs.create")}
                  onClick={() => {
                    setNewOrgMenuOpen(false);
                    openCreateModal();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--color-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  <Plus className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--color-text-primary)] block">
                      Create Organization
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      Provision a new customer workspace
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setNewOrgMenuOpen(false);
                    handleViewRecent();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--color-hover)] transition-colors"
                >
                  <Clock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--color-text-primary)] block">
                      View Recent
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      Show newest organizations first
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={!can("orgs.create")}
                  onClick={() => {
                    setNewOrgMenuOpen(false);
                    openImportModal();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--color-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[var(--color-text-primary)] block">
                      Import Organizations
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      Upload CSV to add multiple tenants
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Total Tenants" value={organizations.length} sublabel="Multi-tenant fleet" icon={Building2} tone="blue" />
        <KpiCard label="Active Tenants" value={activeCount} sublabel={`${trialCount} in evaluation trial`} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Suspended" value={suspendedCount} sublabel="Access frozen" icon={Ban} tone="rose" />
        <KpiCard label="Combined MRR" value={formatCurrency(totalMrr)} sublabel="Across active plans" icon={FileText} tone="violet" />
      </div>

      {/* Filters & Table Card */}
      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search org name, slug, domain, or owner..."
            hasActiveFilters={Boolean(search || statusFilter !== "ALL" || planFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setStatusFilter("ALL");
              setPlanFilter("ALL");
              setPage(1);
            }}
            onExportCsv={() => {
              if (!can("system.export")) {
                toast.error("Missing system.export permission");
                return;
              }
              exportRowsToCsv(
                "prowise-organizations.csv",
                ["Sr. No.", "Name", "Slug", "Domain", "Owner", "Plan", "Status", "Seats", "MRR", "Created"],
                filteredOrgs.map((o, idx) => [
                  idx + 1,
                  o.name,
                  o.slug,
                  o.domain,
                  o.ownerEmail,
                  plans.find((p) => p.id === o.planId)?.name || o.planId,
                  o.status,
                  `${o.seatsUsed}/${o.seatsLimit}`,
                  o.mrr,
                  o.createdAt,
                ])
              );
              toast.success(`Exported ${filteredOrgs.length} organizations`);
            }}
            exportDisabled={!can("system.export") || filteredOrgs.length === 0}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "ALL" | OrgStatus)}
                  aria-label="Filter by status"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="TRIAL">Trial</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>

                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  aria-label="Filter by plan"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Plans</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
        </div>

        {selectedOrgIds.length > 0 && (
          <div className="border-b border-[var(--color-border)] bg-blue-500/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-0.5 font-semibold text-blue-700 dark:text-blue-300">
                {selectedOrgIds.length} selected
              </span>
              {filteredOrgs.length > selectedOrgIds.length && (
                <button
                  type="button"
                  onClick={() => setSelectedOrgIds(filteredOrgs.map((o) => o.id))}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Select all {filteredOrgs.length} matching
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedOrgIds([])}
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
                permissionLocked={!can("orgs.suspend")}
                onClick={handleBulkActivate}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Activate
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!can("orgs.suspend")}
                onClick={() => {
                  closeAllPanels();
                  setBulkSuspendReason("");
                  setBulkSuspendOpen(true);
                }}
              >
                <Ban className="w-3.5 h-3.5" />
                Suspend
              </AdminButton>
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
                permissionLocked={!can("orgs.delete")}
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

        {paginatedOrgs.length === 0 ? (
          <EmptyStateView
            icon={Building2}
            title="No matching organizations"
            description="Adjust your search or filter criteria, or provision a new organization."
            actionLabel={can("orgs.create") ? "Create Organization" : undefined}
            onAction={can("orgs.create") ? openCreateModal : undefined}
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
                      aria-label="Select all organizations on this page"
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
                      Organization <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 hidden md:table-cell">Owner</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3 hidden sm:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort("seatsUsed")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Seats <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("mrr")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      MRR <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {paginatedOrgs.map((org, idx) => {
                  const plan = plans.find((p) => p.id === org.planId);
                  const planTheme = getOrgPlanTheme(plan);
                  const seatPct =
                    org.seatsLimit > 0
                      ? Math.min(100, Math.round((org.seatsUsed / org.seatsLimit) * 100))
                      : 0;
                  const seatBarColor =
                    seatPct >= 90
                      ? "bg-rose-500"
                      : seatPct >= 75
                        ? "bg-amber-500"
                        : "bg-emerald-500";
                  const serialNumber = (safePage - 1) * pageSize + idx + 1;
                  const isSelected = selectedOrgSet.has(org.id);
                  return (
                    <tr
                      key={org.id}
                      className={`hover:bg-[var(--color-hover)] transition-colors ${
                        isSelected ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrg(org.id)}
                          aria-label={`Select ${org.name}`}
                          className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openInspectPanel(org.id)}
                          className="flex items-center gap-2.5 text-left group"
                        >
                          <div
                            className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-[11px] shrink-0 ${planTheme.avatar}`}
                          >
                            {getInitials(org.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--color-text-primary)] group-hover:text-blue-500 transition-colors flex flex-wrap items-center gap-1.5">
                              <span className="truncate">{org.name}</span>
                              <span
                                className={`inline-flex items-center rounded-md border px-1.5 py-0.2 text-[9px] font-medium whitespace-nowrap ${getIndustryBadgeClass(
                                  org.industry
                                )}`}
                              >
                                {org.industry}
                              </span>
                            </div>
                            <div className="font-mono text-[11px] text-[var(--color-text-muted)] truncate">
                              {org.slug} • {org.domain}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-[var(--color-text-primary)] font-medium">{org.ownerName}</div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">{org.ownerEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${planTheme.badge}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${planTheme.dot}`} />
                          {plan?.name || "Custom"}
                        </span>
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                          {org.projectsCount} projects • {org.storageUsedGb} GB
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-[var(--color-text-secondary)]">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span>
                            <span className="font-semibold text-[var(--color-text-primary)]">{org.seatsUsed}</span> / {org.seatsLimit}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">{seatPct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-20 rounded-full bg-[var(--color-border)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${seatBarColor}`}
                            style={{ width: `${seatPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={org.status} tone={getStatusTone(org.status)} dot />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-bold tabular-nums ${
                            org.mrr > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-[var(--color-text-muted)]"
                          }`}
                        >
                          {formatCurrency(org.mrr)}
                        </span>
                        <span className="block text-[10px] text-[var(--color-text-muted)]">/mo</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            onClick={() => openInspectPanel(org.id)}
                            title="View organization details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Details</span>
                          </AdminButton>
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!can("orgs.edit")}
                            onClick={() => openEditModal(org)}
                            title="Edit organization"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </AdminButton>
                          {org.status === "SUSPENDED" ? (
                            <AdminButton
                              variant="subtle"
                              size="xs"
                              permissionLocked={!can("orgs.suspend")}
                              onClick={() => {
                                reactivateOrganization(org.id);
                                toast.success(`Reactivated ${org.name}`);
                              }}
                            >
                              Reactivate
                            </AdminButton>
                          ) : (
                            <AdminButton
                              variant="ghost"
                              size="xs"
                              permissionLocked={!can("orgs.suspend")}
                              className="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                              onClick={() => openSuspendModal(org)}
                              title="Suspend organization"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </AdminButton>
                          )}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!can("orgs.delete")}
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                            onClick={() => openDeleteModal(org)}
                            title="Delete organization"
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
          totalItems={filteredOrgs.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </SurfaceCard>

      {/* Import Organizations Modal */}
      <AdminModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Organizations from CSV"
        description="Upload a simple comma-separated spreadsheet or load a sample batch to onboard multiple customer workspaces."
        maxWidth="xl"
      >
        <div className="space-y-4">
          {importError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {importError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-blue-600 dark:text-blue-400 hover:underline">
              <Upload className="w-4 h-4" />
              <span>Choose CSV File</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportFile}
                className="sr-only"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setImportError(null);
                  setImportRows(SAMPLE_IMPORT_ROWS);
                }}
              >
                Load Sample Batch
              </AdminButton>
              <AdminButton
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleDownloadSampleCsv}
              >
                <Download className="w-3.5 h-3.5" />
                Sample CSV
              </AdminButton>
            </div>
          </div>

          {importRows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-elevated)] text-[10px] font-semibold uppercase text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2">Sr. No.</th>
                    <th className="px-3 py-2">Organization</th>
                    <th className="px-3 py-2">Owner</th>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {importRows.map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">{i + 1}</td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-[var(--color-text-primary)]">{row.name}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">{row.domain}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-[var(--color-text-primary)]">{row.ownerName}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">{row.ownerEmail}</p>
                      </td>
                      <td className="px-3 py-2">{row.planCode}</td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          label={row.valid ? "Ready" : row.issue || "Invalid"}
                          tone={row.valid ? "success" : "danger"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setImportOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton
              type="button"
              variant="primary"
              size="sm"
              disabled={importRows.filter((r) => r.valid).length === 0}
              onClick={handleCommitImport}
            >
              Import {importRows.filter((r) => r.valid).length} Organization(s)
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* Create / Edit Organization Card (Centered, Grouped & Non-Technical Friendly) */}
      <AdminModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingOrg ? `Edit ${editingOrg.name}` : "Create New Organization"}
        description={
          editingOrg
            ? "Update company profile, primary contact, country, and business plan."
            : "Set up a customer workspace, assign a business plan, and link billing automatically."
        }
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveOrg} className="space-y-4">
          {/* 1. Company Details */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              1. Company Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <AdminInput
                label="Organization Name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingOrg) setSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Horizon Health Labs"
                error={formErrors.name}
              />
              <AdminInput
                label="Workspace Web ID (Slug)"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. horizon-health"
                helperText="Used in the organization workspace URL."
                error={formErrors.slug}
              />
              <AdminInput
                label="Company Website Domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. horizonlabs.io"
                error={formErrors.domain}
              />
              <AdminSelect
                label="Industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                options={Array.from(new Set([industry, ...INDUSTRY_OPTIONS].filter(Boolean))).map(
                  (ind) => ({ label: ind, value: ind })
                )}
              />
              <AdminSelect
                label="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                options={Array.from(new Set([country, ...COUNTRY_OPTIONS].filter(Boolean))).map(
                  (c) => ({ label: c, value: c })
                )}
              />
              <AdminSelect
                label="Timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                options={[
                  { label: "America/New_York (EST)", value: "America/New_York" },
                  { label: "America/Los_Angeles (PST)", value: "America/Los_Angeles" },
                  { label: "Europe/London (GMT)", value: "Europe/London" },
                  { label: "Europe/Berlin (CET)", value: "Europe/Berlin" },
                  { label: "Asia/Tokyo (JST)", value: "Asia/Tokyo" },
                  { label: "Asia/Kolkata (IST)", value: "Asia/Kolkata" },
                  { label: "UTC", value: "UTC" },
                ]}
              />
            </div>
          </div>

          {/* 2. Primary Contact */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              2. Primary Owner Contact
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <AdminInput
                label="Owner Full Name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Jordan Blake"
                error={formErrors.ownerName}
              />
              <AdminInput
                label="Owner Email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@company.com"
                error={formErrors.ownerEmail}
              />
            </div>
          </div>

          {/* 3. Business Plan & Capacity */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              3. Business Plan &amp; Seats
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <AdminSelect
                label="Business Plan"
                value={planId}
                onChange={(e) => {
                  const nextPlanId = e.target.value;
                  setPlanId(nextPlanId);
                  const matchedPlan = plans.find((p) => p.id === nextPlanId);
                  if (matchedPlan && editingOrg) {
                    setSeatsLimitOverride(
                      String(Math.max(editingOrg.seatsUsed, matchedPlan.limits.maxSeats))
                    );
                  }
                }}
                options={plans
                  .filter((p) => p.status === "ACTIVE" || p.id === planId)
                  .map((p) => ({
                    label: `${p.name} ($${p.monthlyPrice}/mo)`,
                    value: p.id,
                  }))}
              />
              <AdminSelect
                label="Billing Cycle"
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                options={[
                  { label: "Monthly", value: "MONTHLY" },
                  { label: "Annual (Save ~17%)", value: "ANNUAL" },
                ]}
              />
              {!editingOrg ? (
                <AdminSelect
                  label="Account Status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "ACTIVE" | "TRIAL")}
                  options={[
                    { label: "Active (Billed)", value: "ACTIVE" },
                    { label: "Evaluation Trial", value: "TRIAL" },
                  ]}
                />
              ) : (
                <AdminInput
                  label="Seat Limit"
                  type="number"
                  min={editingOrg.seatsUsed}
                  value={seatsLimitOverride}
                  onChange={(e) => setSeatsLimitOverride(e.target.value)}
                  helperText={`${editingOrg.seatsUsed} seats in use`}
                />
              )}
            </div>
          </div>

          <AdminTextarea
            label="Account Notes (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Billing notes, onboarding contacts, or special agreements..."
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary">
              {editingOrg ? "Save Changes" : "Create Organization"}
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Organization Details Modal (Centered, Friendly Overview Card — Never Overlaps Edit) */}
      <AdminModal
        isOpen={isInspectVisible}
        onClose={() => setInspectOrgId(null)}
        title={inspectedOrg?.name || ""}
        description={
          inspectedOrg
            ? `${inspectedOrg.domain} • Workspace ID: ${inspectedOrg.slug}`
            : undefined
        }
        maxWidth="2xl"
      >
        {inspectedOrg && (
          <div className="space-y-4">
            {/* Top Status & Quick Actions Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${
                    getOrgPlanTheme(inspectedPlan).avatar
                  }`}
                >
                  {getInitials(inspectedOrg.name)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={inspectedOrg.status} tone={getStatusTone(inspectedOrg.status)} dot />
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                      getOrgPlanTheme(inspectedPlan).badge
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${getOrgPlanTheme(inspectedPlan).dot}`} />
                    {inspectedPlan?.name || "Custom"}
                  </span>
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  Joined {formatShortDate(inspectedOrg.createdAt)} •{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(inspectedOrg.mrr)}/mo
                  </strong>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AdminButton
                  variant="primary"
                  size="xs"
                  permissionLocked={!can("orgs.edit")}
                  onClick={() => openEditModal(inspectedOrg)}
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Details
                </AdminButton>
                {inspectedOrg.status === "SUSPENDED" ? (
                  <AdminButton
                    variant="subtle"
                    size="xs"
                    permissionLocked={!can("orgs.suspend")}
                    onClick={() => {
                      reactivateOrganization(inspectedOrg.id);
                      toast.success(`Reactivated ${inspectedOrg.name}`);
                    }}
                  >
                    Reactivate
                  </AdminButton>
                ) : (
                  <AdminButton
                    variant="danger"
                    size="xs"
                    permissionLocked={!can("orgs.suspend")}
                    onClick={() => openSuspendModal(inspectedOrg)}
                  >
                    Suspend
                  </AdminButton>
                )}
              </div>
            </div>

            {inspectedOrg.suspendedReason && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                <strong>Suspension Reason: </strong>
                {inspectedOrg.suspendedReason}
              </div>
            )}

            {/* Primary Contact & Company Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-3.5 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Primary Contact
                </p>
                <p className="font-semibold text-sm text-[var(--color-text-primary)]">
                  {inspectedOrg.ownerName}
                </p>
                <p className="text-[var(--color-text-secondary)] truncate">{inspectedOrg.ownerEmail}</p>
              </div>
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3.5 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  Industry &amp; Location
                </p>
                <div className="pt-0.5">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getIndustryBadgeClass(
                      inspectedOrg.industry
                    )}`}
                  >
                    {inspectedOrg.industry}
                  </span>
                </div>
                <p className="text-[var(--color-text-secondary)] pt-0.5">
                  {inspectedOrg.country} • {inspectedOrg.timezone}
                </p>
              </div>
            </div>

            {/* Plan, Subscription & Usage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3 text-xs">
                <p className="font-semibold text-[var(--color-text-primary)]">Usage &amp; Limits</p>
                {[
                  { label: "Seats Used", used: inspectedOrg.seatsUsed, limit: inspectedOrg.seatsLimit, unit: "" },
                  { label: "Projects", used: inspectedOrg.projectsCount, limit: inspectedPlan?.limits.maxProjects || 50, unit: "" },
                  { label: "Storage", used: inspectedOrg.storageUsedGb, limit: inspectedPlan?.limits.storageGb || 250, unit: " GB" },
                ].map((q) => {
                  const pct = Math.min(100, Math.round((q.used / Math.max(1, q.limit)) * 100));
                  return (
                    <div key={q.label} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[var(--color-text-secondary)]">{q.label}</span>
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {q.used}{q.unit} / {q.limit}{q.unit} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-elevated)] overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-2.5 text-xs flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--color-text-primary)]">Business Plan</span>
                    <Link href="/super-admin/subscriptions" className="text-blue-500 hover:underline text-[11px]">
                      Subscriptions
                    </Link>
                  </div>
                  {inspectedSub ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getPlanBadgeClass(
                              inspectedPlan
                            )}`}
                          >
                            {inspectedPlan?.name || "Custom"}
                          </span>
                          <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                            ({inspectedSub.billingCycle})
                          </span>
                        </div>
                        <StatusBadge label={inspectedSub.status} tone={getStatusTone(inspectedSub.status)} />
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        Renews {inspectedSub.currentPeriodEnd}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Method: {inspectedSub.paymentMethodLabel}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[var(--color-text-muted)]">No active subscription linked.</p>
                  )}
                </div>

                {inspectedOrg.notes && (
                  <div className="pt-2 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)]">
                    <span className="font-medium text-[var(--color-text-primary)]">Notes: </span>
                    {inspectedOrg.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Invoices */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--color-text-primary)]">
                  Invoices ({inspectedInvoices.length}) &amp; Payments ({inspectedPayments.length})
                </span>
                <AdminButton
                  variant="outline"
                  size="xs"
                  permissionLocked={!can("invoices.manage")}
                  onClick={() => {
                    const inv = generateInvoice({
                      orgId: inspectedOrg.id,
                      subscriptionId: inspectedSub?.id,
                      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
                      taxRate: 0,
                      lineItems: [
                        {
                          description: `${inspectedPlan?.name || "Platform"} Ad-Hoc Billing Charge`,
                          quantity: 1,
                          unitPrice: inspectedPlan?.monthlyPrice || 499,
                        },
                      ],
                      notes: "Generated from Organization Details.",
                    });
                    openInvoicePanel(inv.id);
                    toast.success(`Generated ${inv.invoiceNumber}`);
                  }}
                >
                  <Plus className="w-3 h-3" /> Generate Invoice
                </AdminButton>
              </div>

              {inspectedInvoices.length === 0 ? (
                <p className="text-[var(--color-text-muted)]">No invoices issued yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {inspectedInvoices.map((inv) => (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => openInvoicePanel(inv.id)}
                      className="w-full flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 hover:bg-[var(--color-hover)] transition-colors"
                    >
                      <div className="text-left">
                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {inv.invoiceNumber}
                        </span>
                        <span className="block text-[10px] text-[var(--color-text-muted)]">
                          Issued {inv.issueDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {formatCurrency(inv.total)}
                        </span>
                        <StatusBadge label={inv.status} tone={getStatusTone(inv.status)} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--color-border)]">
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Last activity: {formatDateTime(inspectedOrg.lastActivityAt)}
              </span>
              <div className="flex items-center gap-2">
                <AdminButton variant="outline" size="sm" onClick={() => setInspectOrgId(null)}>
                  Close
                </AdminButton>
                <AdminButton
                  variant="primary"
                  size="sm"
                  permissionLocked={!can("orgs.edit")}
                  onClick={() => openEditModal(inspectedOrg)}
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Organization
                </AdminButton>
              </div>
            </div>
          </div>
        )}
      </AdminModal>

      {/* Suspend Reason Modal */}
      <AdminModal
        isOpen={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        title={`Suspend ${suspendTarget?.name || ""}?`}
        description="Suspending freezes workspace access and pauses automatic recurring billing."
        maxWidth="md"
      >
        <div className="space-y-4">
          <AdminTextarea
            label="Suspension Reason (Required)"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="e.g. Repeated payment delinquency past 30-day grace window..."
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <AdminButton variant="outline" size="sm" onClick={() => setSuspendTarget(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="danger"
              size="sm"
              disabled={suspendReason.trim().length < 5}
              onClick={() => {
                if (!suspendTarget) return;
                suspendOrganization(suspendTarget.id, suspendReason.trim());
                toast.warning(`Suspended ${suspendTarget.name}`);
                setSuspendTarget(null);
              }}
            >
              Confirm Suspension
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* Delete Confirmation */}
      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Decommission ${deleteTarget?.name || ""}?`}
        description="This permanently removes the organization record along with its linked subscriptions, payments, and invoices from the local console."
        confirmLabel="Delete Permanently"
        variant="danger"
        requireMatchText={deleteTarget?.slug}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteOrganization(deleteTarget.id);
          if (inspectOrgId === deleteTarget.id) setInspectOrgId(null);
          toast.success(`Deleted ${deleteTarget.name}`);
        }}
      />

      {/* Bulk Suspend Modal */}
      <AdminModal
        isOpen={bulkSuspendOpen}
        onClose={() => setBulkSuspendOpen(false)}
        title={`Suspend ${selectedOrgIds.length} Selected Organization${selectedOrgIds.length === 1 ? "" : "s"}`}
        description="Selected workspaces will be frozen for tenant members until reactivated."
        maxWidth="md"
      >
        <div className="space-y-4">
          <AdminTextarea
            label="Suspension Reason (Required)"
            value={bulkSuspendReason}
            onChange={(e) => setBulkSuspendReason(e.target.value)}
            placeholder="e.g. Bulk compliance freeze or overdue enterprise billing."
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <AdminButton variant="outline" size="sm" onClick={() => setBulkSuspendOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="danger"
              size="sm"
              disabled={bulkSuspendReason.trim().length < 5}
              onClick={handleConfirmBulkSuspend}
            >
              Confirm Bulk Suspension
            </AdminButton>
          </div>
        </div>
      </AdminModal>

      {/* Bulk Delete Confirmation */}
      <ConfirmActionModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selectedOrgIds.length} selected organization${selectedOrgIds.length === 1 ? "" : "s"}?`}
        description="This permanently removes the selected organizations along with their linked subscriptions, payments, and invoices from the local console."
        confirmLabel="Delete Selected"
        variant="danger"
        onConfirm={handleConfirmBulkDelete}
      />

      <InvoiceModal invoiceId={selectedInvoiceId} onClose={() => setSelectedInvoiceId(null)} />
    </div>
  );
}
