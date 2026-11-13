"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  CheckSquare,
  Code,
  Eye,
  Globe,
  Lock,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminRole, RoleScope } from "../_types";
import {
  ACTION_LABELS,
  ALL_GRANULAR_PERMISSIONS,
  PERMISSION_MODULES,
  getTemplatePermissions,
} from "../_services/permission-matrix";
import { AdminButton } from "./SuperAdminPrimitives";

interface CustomRoleWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRole: (role: Omit<AdminRole, "id" | "createdAt" | "updatedAt" | "isSystem" | "slug">) => void;
  initialRole?: AdminRole | null;
  mode?: "create" | "clone";
  existingRoles?: AdminRole[];
}

const TEMPLATE_PRESETS = [
  { id: "BLANK", name: "Custom (Blank)", desc: "Start with 0 permissions and manually pick capabilities.", icon: Sparkles },
  { id: "SUPER_ADMIN", name: "Super Admin Baseline", desc: "Comprehensive platform administration template.", icon: ShieldAlert },
  { id: "PLATFORM_OPERATOR", name: "Platform Operator Preset", desc: "Operations, support triage, and system monitoring.", icon: UserCog },
  { id: "ORGANIZATION_OWNER", name: "Organization Owner Preset", desc: "Full tenant governance, subscriptions, and billing.", icon: Building2 },
  { id: "ORGANIZATION_ADMIN", name: "Organization Admin Preset", desc: "Workspace governance, member invites, and projects.", icon: ShieldCheck },
  { id: "PROJECT_MANAGER", name: "Project Manager Preset", desc: "Milestones, task planning, and delivery schedules.", icon: Briefcase },
  { id: "TEAM_LEAD", name: "Team Lead Preset", desc: "Code reviews, check-in verification, and task coordination.", icon: Users },
  { id: "DEVELOPER", name: "Developer Preset", desc: "Work items implementation, check-ins, and evidence submission.", icon: Code },
  { id: "QA_REVIEWER", name: "QA / Reviewer Preset", desc: "Test checklists verification, deliverable acceptance.", icon: CheckSquare },
  { id: "VIEWER", name: "Viewer Preset", desc: "Read-only access to dashboards, reports, and delivery status.", icon: Eye },
];

export function CustomRoleWizardModal({
  isOpen,
  onClose,
  onCreateRole,
  initialRole,
  mode = "create",
  existingRoles = [],
}: CustomRoleWizardModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<AdminRole["color"]>("violet");
  const [scope, setScope] = useState<RoleScope>("ORGANIZATION");
  const [selectedTemplate, setSelectedTemplate] = useState("ORGANIZATION_ADMIN");
  const [customPermissions, setCustomPermissions] = useState<string[]>(
    getTemplatePermissions("ORGANIZATION_ADMIN")
  );
  const [permSearch, setPermSearch] = useState("");
  const [activeModuleTab, setActiveModuleTab] = useState<string>("ALL");

  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      if (initialRole) {
        setName(mode === "clone" ? `${initialRole.name} (Copy)` : initialRole.name);
        setDescription(
          mode === "clone"
            ? `Cloned from ${initialRole.name}. ${initialRole.description}`
            : initialRole.description
        );
        setColor(initialRole.color || "violet");
        setScope(initialRole.scope || "ORGANIZATION");
        setCustomPermissions([...initialRole.permissions]);
        setSelectedTemplate("BLANK");
      } else {
        setName("");
        setDescription("");
        setColor("violet");
        setScope("ORGANIZATION");
        setSelectedTemplate("ORGANIZATION_ADMIN");
        setCustomPermissions(getTemplatePermissions("ORGANIZATION_ADMIN"));
      }
    }
  }, [isOpen, initialRole, mode]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 1) {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length < 2) {
        toast.error("Please enter a role name of at least 2 characters.");
        return;
      }
      // Check duplicate names
      const isDuplicate = existingRoles.some(
        (r) => r.name.toLowerCase() === trimmed.toLowerCase() && r.id !== initialRole?.id
      );
      if (isDuplicate) {
        toast.error(`A role named "${trimmed}" already exists. Please choose a unique name.`);
        return;
      }
    }
    if (step === 3) {
      // Load preset permissions into step 4
      let loadedPerms: string[] = [];
      if (selectedTemplate === "BLANK") {
        loadedPerms = [];
      } else {
        loadedPerms = getTemplatePermissions(selectedTemplate);
      }
      // If scope is ORGANIZATION, enforce privilege boundaries by stripping platform-scoped permissions
      if (scope === "ORGANIZATION") {
        loadedPerms = loadedPerms.filter((p) => !p.startsWith("platform."));
      }
      setCustomPermissions(loadedPerms);
    }
    if (step < 5) {
      setStep((s) => (s + 1) as any);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as any);
    }
  };

  const handleSave = () => {
    onCreateRole({
      name: name.trim(),
      description: description.trim() || "Custom RBAC role.",
      scope,
      color,
      permissions: customPermissions,
      userCount: 0,
      assignedUsers: [],
      isActive: true,
    });
    toast.success(`Successfully created custom role "${name.trim()}"`);
    onClose();
  };

  const togglePerm = (key: string) => {
    setCustomPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-5 sm:p-6 text-[var(--color-text-primary)] max-h-[90vh] flex flex-col justify-between overflow-hidden">
        {/* Wizard Header */}
        <div className="pb-3 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-blue-500/12 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Wand2 className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                Guided Custom Role Wizard
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper progress */}
          <div className="grid grid-cols-5 gap-1 text-[11px] font-semibold text-center">
            {[
              { num: 1, label: "Name" },
              { num: 2, label: "Scope" },
              { num: 3, label: "Template" },
              { num: 4, label: "Customize" },
              { num: 5, label: "Review" },
            ].map((st) => (
              <div
                key={st.num}
                className={`py-1.5 px-1 rounded-md transition-all ${
                  step === st.num
                    ? "bg-blue-600 text-white font-bold shadow-xs"
                    : step > st.num
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                    : "bg-[var(--color-app-bg)] text-[var(--color-text-muted)]"
                }`}
              >
                {st.num}. {st.label}
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Step Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {/* ======================================================== */}
          {/* STEP 1: NAME & DETAILS                                   */}
          {/* ======================================================== */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                  Role Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Security Auditor or Contractor Lead"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--color-text-primary)] mb-1">
                  Description &amp; Purpose
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe responsibilities, boundaries, and who should hold this role..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--color-text-primary)] mb-1.5">
                  Accent Color Theme
                </label>
                <div className="flex items-center gap-2">
                  {(["blue", "emerald", "violet", "amber", "slate"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full flex items-center justify-center transition-transform ${
                        color === c ? "ring-2 ring-blue-500 ring-offset-2 scale-110" : "opacity-80 hover:opacity-100"
                      } ${
                        c === "blue"
                          ? "bg-blue-500"
                          : c === "emerald"
                          ? "bg-emerald-500"
                          : c === "violet"
                          ? "bg-violet-500"
                          : c === "amber"
                          ? "bg-amber-500"
                          : "bg-cyan-500"
                      }`}
                    >
                      {color === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: SCOPE & BOUNDARIES                              */}
          {/* ======================================================== */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-[var(--color-text-secondary)]">
                Select the jurisdictional boundary for this role. Platform roles govern platform infrastructure, whereas Organization roles operate inside tenant customer workspaces.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setScope("ORGANIZATION")}
                  className={`rounded-xl border p-4 cursor-pointer transition-all ${
                    scope === "ORGANIZATION"
                      ? "border-blue-500 bg-blue-500/10 shadow-sm"
                      : "border-[var(--color-border)] bg-[var(--color-app-bg)] hover:border-blue-500/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-sm text-[var(--color-text-primary)]">
                      Organization Scope
                    </span>
                    <Building2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                    Applies inside tenant workspaces: projects, tasks, reviews, and organization configurations.
                  </p>
                </div>

                <div
                  onClick={() => setScope("PLATFORM")}
                  className={`rounded-xl border p-4 cursor-pointer transition-all ${
                    scope === "PLATFORM"
                      ? "border-purple-500 bg-purple-500/10 shadow-sm"
                      : "border-[var(--color-border)] bg-[var(--color-app-bg)] hover:border-purple-500/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-sm text-[var(--color-text-primary)]">
                      Platform Scope
                    </span>
                    <Globe className="w-4 h-4 text-purple-500" />
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                    Platform-wide governance: global API monitoring, security break-glass, support escalation, and tenant provisioning.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 3: PERMISSION TEMPLATE                              */}
          {/* ======================================================== */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-[var(--color-text-secondary)]">
                Choose a baseline template. You can customize individual checkboxes in the next step.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TEMPLATE_PRESETS.map((tpl) => {
                  const Icon = tpl.icon;
                  const isSelected = selectedTemplate === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`rounded-xl border p-3 cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/10 shadow-xs"
                          : "border-[var(--color-border)] bg-[var(--color-app-bg)] hover:border-blue-500/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-blue-500 shrink-0" />
                        <h4 className="font-bold text-xs text-[var(--color-text-primary)]">
                          {tpl.name}
                        </h4>
                      </div>
                      <p className="text-[10px] text-[var(--color-text-secondary)] leading-snug">
                        {tpl.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 4: CUSTOMIZE PERMISSIONS                            */}
          {/* ======================================================== */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[var(--color-text-primary)]">
                    {customPermissions.length} of {ALL_GRANULAR_PERMISSIONS.length} Capabilities Granted
                  </span>
                  {scope === "ORGANIZATION" && (
                    <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                      Organization Scope
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      let all = ALL_GRANULAR_PERMISSIONS.map((p) => p.key);
                      if (scope === "ORGANIZATION") all = all.filter((k) => !k.startsWith("platform."));
                      setCustomPermissions(all);
                    }}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => setCustomPermissions([])}
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Clear All
                  </button>
                  <div className="relative min-w-[170px]">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-8 pr-3 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Module tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveModuleTab("ALL")}
                  className={`rounded-md px-2 py-0.5 font-medium shrink-0 ${
                    activeModuleTab === "ALL"
                      ? "bg-blue-600 text-white"
                      : "bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  All (12)
                </button>
                {PERMISSION_MODULES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveModuleTab(m.id)}
                    className={`rounded-md px-2 py-0.5 font-medium shrink-0 ${
                      activeModuleTab === m.id
                        ? "bg-blue-600 text-white"
                        : "bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>

              {/* Permission Checkboxes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {ALL_GRANULAR_PERMISSIONS.filter((p) => {
                  if (activeModuleTab !== "ALL" && p.moduleId !== activeModuleTab) return false;
                  if (permSearch.trim()) {
                    const q = permSearch.toLowerCase().trim();
                    return p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q);
                  }
                  return true;
                }).map((p) => {
                  const isChecked = customPermissions.includes(p.key);
                  return (
                    <label
                      key={p.key}
                      onClick={() => togglePerm(p.key)}
                      className={`rounded-lg border p-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isChecked
                          ? "border-blue-500/40 bg-blue-500/5 text-[var(--color-text-primary)]"
                          : "border-[var(--color-border)] bg-[var(--color-app-bg)] opacity-75 text-[var(--color-text-secondary)]"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-semibold block truncate">{p.label}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{p.key}</span>
                      </div>
                      <div
                        className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                          isChecked
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-[var(--color-border)] bg-[var(--color-surface)] text-transparent"
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 5: REVIEW & SAVE                                    */}
          {/* ======================================================== */}
          {step === 5 && (
            <div className="space-y-3.5">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
                  <div>
                    <h4 className="text-base font-bold text-[var(--color-text-primary)]">{name}</h4>
                    <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                      slug: {name.toLowerCase().replace(/\s+/g, "-")}
                    </span>
                  </div>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    Custom Role
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[10px] uppercase font-bold">
                      Scope
                    </span>
                    <span className="font-semibold">{scope} Scope</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[10px] uppercase font-bold">
                      Capabilities Granted
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {customPermissions.length} of {ALL_GRANULAR_PERMISSIONS.length} capabilities
                    </span>
                  </div>
                </div>

                {description && (
                  <p className="text-xs text-[var(--color-text-secondary)] pt-1 border-t border-[var(--color-border)]">
                    {description}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
                <p>
                  This custom role will be immediately active and ready to assign to organization members or platform operators. You can modify permissions or delete this role anytime.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between gap-2 shrink-0">
          <AdminButton
            variant="outline"
            size="sm"
            type="button"
            disabled={step === 1}
            onClick={handleBack}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </AdminButton>

          <div className="flex items-center gap-2">
            <AdminButton variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </AdminButton>

            {step < 5 ? (
              <AdminButton variant="primary" size="sm" type="button" onClick={handleNext}>
                Next <ArrowRight className="w-3.5 h-3.5" />
              </AdminButton>
            ) : (
              <AdminButton variant="primary" size="sm" type="button" onClick={handleSave}>
                <Check className="w-3.5 h-3.5" /> Create &amp; Activate Role
              </AdminButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
