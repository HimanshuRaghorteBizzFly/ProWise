"use client";

import React, { useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  FolderPlus,
  Layers,
  User,
  Calendar,
  Clock,
  Globe,
  CheckCircle2,
  Users,
  ArrowLeft,
  Sparkles,
  Info,
  Check,
  Building,
  Flag,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient, ApiError } from "@/lib/api";
import { useDeliveryStore } from "@/store/delivery-store";
import { useProjectStore } from "@/store/project-store";
import { DEMO_TODAY, VIEWERS, type DeliveryMode } from "@/mocks/delivery-dashboards";
import { PageFrame, useDemoLoad, useRoleHref } from "@/components/delivery/DeliveryUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
interface FormState {
  name: string;
  key: string;
  client: string;
  description: string;
  mode: DeliveryMode;
  projectManagerId: string;
  accountableDeveloperId: string;
  teamLeadId: string;
  teamId: string;
  selectedMemberIds: string[];
  startDate: string;
  dueDate: string;
  timezone: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

const IANA_TIMEZONES = [
  { value: "America/New_York", label: "America/New York (EST/EDT, UTC-5)" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT, UTC-6)" },
  { value: "America/Denver", label: "America/Denver (MST/MDT, UTC-7)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (PST/PDT, UTC-8)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST, UTC+0)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST, UTC+1)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST, UTC+5:30)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+9)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT, UTC+10)" },
];

export default function ManagerCreateProjectPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const safeOrgId = orgId || "org-acme";
  const href = useRoleHref("manager");
  const router = useRouter();
  const { status, retry } = useDemoLoad(200);

  const deliveryTeams = useDeliveryStore((s) => s.teams);
  const deliveryPeople = useDeliveryStore((s) => s.people);
  const createProject = useDeliveryStore((s) => s.createProject);

  const [form, setForm] = useState<FormState>({
    name: "",
    key: "",
    client: "",
    description: "",
    mode: "STRUCTURED",
    projectManagerId: VIEWERS.manager.id,
    accountableDeveloperId: "p-alex",
    teamLeadId: VIEWERS.lead.id,
    teamId: "t-platform",
    selectedMemberIds: ["p-alex", "p-aisha", "p-diego"],
    startDate: DEMO_TODAY,
    dueDate: "",
    timezone: "America/New_York",
    priority: "MEDIUM",
  });

  const [hasManuallyEditedKey, setHasManuallyEditedKey] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  // Use delivery-store people as the available roster.
  const availableDevelopers = useMemo(() => {
    const devs = deliveryPeople.filter(
      (p) => p.id === "p-alex" || p.name.toLowerCase().includes("alex") || p.title.toLowerCase().includes("engineer")
    );
    if (devs.length > 0) {
      return devs.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.title,
        title: p.title,
      }));
    }
    return [
      {
        id: "p-alex",
        name: "Alex Rivera",
        email: "alex.rivera@acmehealth.com",
        role: "Software Engineer",
        title: "Software Engineer",
      },
    ];
  }, [deliveryPeople]);

  const availableManagers = useMemo(() => {
    return [
      { id: VIEWERS.manager.id, name: VIEWERS.manager.name, email: "priya.raman@example.com", role: "Project Manager", title: VIEWERS.manager.title },
      { id: VIEWERS.lead.id, name: VIEWERS.lead.name, email: "marcus.chen@example.com", role: "Team Lead", title: VIEWERS.lead.title },
    ];
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleNameChange = (newName: string) => {
    set("name", newName);
    if (!hasManuallyEditedKey) {
      const words = newName.trim().split(/\s+/).filter(Boolean);
      if (words.length === 1) {
        const raw = words[0].replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4);
        set("key", raw.length >= 2 ? `${raw}-01` : raw);
      } else if (words.length > 1) {
        const initials = words
          .slice(0, 3)
          .map((w) => w[0]?.toUpperCase() || "")
          .join("");
        set("key", `${initials}-01`);
      }
    }
  };

  const handleKeyChange = (newKey: string) => {
    setHasManuallyEditedKey(true);
    set("key", newKey.toUpperCase().replace(/[^A-Z0-9_-]/g, ""));
  };

  const toggleMemberSelection = (memberId: string) => {
    setForm((f) => {
      const exists = f.selectedMemberIds.includes(memberId);
      const next = exists
        ? f.selectedMemberIds.filter((id) => id !== memberId)
        : [...f.selectedMemberIds, memberId];
      return { ...f, selectedMemberIds: next };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};

    if (!form.name.trim() || form.name.trim().length < 3) {
      nextErrors.name = "Project name must be at least 3 characters.";
    }

    const cleanKey = form.key.trim().toUpperCase();
    if (!cleanKey || cleanKey.length < 2 || cleanKey.length > 20) {
      nextErrors.key = "Project key must be between 2 and 20 uppercase characters.";
    }

    if (!form.client.trim()) {
      nextErrors.client = "Enter client or internal sponsor name.";
    }

    if (!form.startDate) {
      nextErrors.startDate = "Pick a project start date.";
    }

    if (!form.dueDate) {
      nextErrors.dueDate = "Pick an expected delivery date.";
    } else if (form.startDate && form.dueDate < form.startDate) {
      nextErrors.dueDate = "Delivery date must be on or after start date.";
    }

    if (form.mode === "INDIVIDUAL" && !form.accountableDeveloperId) {
      nextErrors.accountableDeveloperId = "Select one accountable developer.";
    }

    if (form.mode === "STRUCTURED" && form.selectedMemberIds.length === 0) {
      nextErrors.selectedMemberIds = "Select at least one delivery team member.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please resolve highlighted validation errors.");
      return;
    }

    setSaving(true);

    let backendProject: any = null;
    try {
      backendProject = await apiClient.createProject(safeOrgId, {
        name: form.name.trim(),
        key: cleanKey,
        description: form.description.trim(),
        mode: form.mode as any,
        priority: form.priority,
        team_id: form.teamId,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        targetDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        timezone: form.timezone,
      });
    } catch (err: any) {
      const status = err?.status;
      if (status === 400 || status === 409 || status === 422) {
        toast.error("Project Creation Failed", { description: err?.message || "Validation error" });
        setSaving(false);
        return;
      }
      // In role preview or mock network offline mode, proceed gracefully with reactive store sync
      console.warn("Backend project creation in role preview/offline mode:", err?.message || err);
    }

    const finalKey = backendProject?.key || cleanKey;
    const finalProjectId = backendProject?.id || `proj-${cleanKey.toLowerCase()}-${Date.now().toString().slice(-4)}`;

    // 1. Sync into Delivery Store (used across Manager & Team Lead workspaces)
    const deliveryProject = createProject(
      {
        name: form.name.trim(),
        code: cleanKey,
        client: form.client.trim(),
        mode: form.mode,
        teamId: form.teamId,
        startDate: form.startDate,
        dueDate: form.dueDate,
        description: form.description.trim(),
        accountableDeveloperId: form.accountableDeveloperId,
        memberIds: form.mode === "INDIVIDUAL" ? [form.accountableDeveloperId] : form.selectedMemberIds,
      },
      form.projectManagerId || VIEWERS.manager.id
    );

    // If Individual mode: seed next check-in schedule without fake tasks
    if (form.mode === "INDIVIDUAL") {
      useDeliveryStore.setState((s) => ({
        checkIns: [
          {
            id: `ci-${Date.now()}`,
            memberId: form.accountableDeveloperId,
            dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            status: "DUE",
            lastSummary: `Initial check-in scheduled for [${finalKey}] ${form.name.trim()}`,
            confidence: 4,
          },
          ...s.checkIns,
        ],
      }));
    } else {
      // Structured mode: initialize first milestone work item
      useDeliveryStore.setState((s) => ({
        tasks: [
          {
            id: `tk-${Date.now()}`,
            key: `${finalKey}-101`,
            title: `Sprint kickoff & scope definition for ${form.name.trim()}`,
            projectId: deliveryProject.id || finalProjectId,
            assigneeId: form.selectedMemberIds[0] || form.teamLeadId,
            teamId: form.teamId,
            status: "TODO",
            priority: form.priority,
            dueDate: form.dueDate,
            estimateHours: 16,
            weight: 10,
            progress: 0,
            description: form.description.trim() || `Deliverable kickoff for ${form.name.trim()}`,
            updatedAt: new Date().toISOString(),
          },
          ...s.tasks,
        ],
      }));
    }

    // 2. Sync into Project Store (used across Developer assigned projects & dashboard)
    useProjectStore.getState().createProject({
      orgId: safeOrgId,
      name: form.name.trim(),
      key: finalKey,
      description: form.description.trim(),
      mode: form.mode,
      lifecycle: "ACTIVE",
      archived: false,
      priority: form.priority,
      projectManagerId: form.projectManagerId,
      accountableOwnerId: form.mode === "INDIVIDUAL" ? form.accountableDeveloperId : "usr-developer",
      teamIds: [form.teamId],
      memberIds: form.mode === "INDIVIDUAL" ? [form.accountableDeveloperId] : form.selectedMemberIds,
      startDate: form.startDate,
      targetDate: form.dueDate,
      timezone: form.timezone,
      cadence: "WEEKLY",
      graceWorkingDays: 1,
      repositoryIds: [],
    });

    toast.success(`Project [${finalKey}] created`, {
      description: `Successfully configured in ${form.mode === "INDIVIDUAL" ? "Individual Solo" : "Structured Team"} mode.`,
    });

    router.push(href(`projects/${deliveryProject.id || finalProjectId}`));
    setSaving(false);
  };

  const selectedTeam = deliveryTeams.find((t) => t.id === form.teamId);

  return (
    <PageFrame
      crumbs={[
        { label: "Manager", href: href() },
        { label: "Portfolio", href: href("projects") },
        { label: "Create Project" },
      ]}
      back={{ href: href("projects"), label: "Back to portfolio" }}
      title="Create Project"
      description="Configure and launch an engineering project across solo check-in or structured sprint delivery modes."
      status={status}
      onRetry={retry}
      skeleton="detail"
    >
      <form onSubmit={submit} noValidate className="max-w-6xl mx-auto pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Fields: Left 2 Columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Project Basics Card */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <FolderPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Project Identity & Scope</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Project Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. FHIR Clinical Decision Support API"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="text-xs h-9 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-lg focus-visible:ring-1 focus-visible:ring-blue-600"
                  />
                  {errors.name && <p className="text-[11px] text-rose-500 mt-0.5">{errors.name}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Project Key <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. CRM-100"
                    value={form.key}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    className="text-xs h-9 font-mono uppercase bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-lg focus-visible:ring-1 focus-visible:ring-blue-600"
                  />
                  {errors.key && <p className="text-[11px] text-rose-500 mt-0.5">{errors.key}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Client / Internal Sponsor <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Acme Health Network"
                    value={form.client}
                    onChange={(e) => set("client", e.target.value)}
                    className="text-xs h-9 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-lg"
                  />
                  {errors.client && <p className="text-[11px] text-rose-500 mt-0.5">{errors.client}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Workspace / Organization
                  </label>
                  <div className="h-9 px-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/80 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium truncate">{safeOrgId}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Goal & Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="What will be delivered, for whom, and how will we know it is done?"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 leading-relaxed"
                />
              </div>
            </div>

            {/* 2. Delivery Mode Selector */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Project Delivery Mode</h2>
                </div>
                <Badge variant="outline" className="text-[10px]">Required</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup">
                {/* Individual Mode Card */}
                <div
                  role="radio"
                  aria-checked={form.mode === "INDIVIDUAL"}
                  onClick={() => set("mode", "INDIVIDUAL")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    form.mode === "INDIVIDUAL"
                      ? "border-blue-600 bg-blue-50/30 dark:bg-blue-950/20 shadow-xs ring-1 ring-blue-600/30"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <User className="w-4 h-4 text-blue-600" /> Individual (Solo Developer)
                    </span>
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${form.mode === "INDIVIDUAL" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 dark:border-slate-600"}`}>
                      {form.mode === "INDIVIDUAL" && <Check className="w-2.5 h-2.5" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    One accountable engineer. Progress reported directly via periodic solo check-ins. Zero mandatory task boards or sprints.
                  </p>
                </div>

                {/* Structured Mode Card */}
                <div
                  role="radio"
                  aria-checked={form.mode === "STRUCTURED"}
                  onClick={() => set("mode", "STRUCTURED")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    form.mode === "STRUCTURED"
                      ? "border-blue-600 bg-blue-50/30 dark:bg-blue-950/20 shadow-xs ring-1 ring-blue-600/30"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <Layers className="w-4 h-4 text-blue-600" /> Structured (Team Delivery)
                    </span>
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${form.mode === "STRUCTURED" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 dark:border-slate-600"}`}>
                      {form.mode === "STRUCTURED" && <Check className="w-2.5 h-2.5" />}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    Multi-developer squad with Team Lead. Weighted sprint backlog, task breakdowns, leaf evidence reviews, and baseline verification.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. People & Ownership Card (Adapts dynamically to Mode) */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {form.mode === "INDIVIDUAL" ? "Individual Ownership & Accountability" : "Team & Member Assignment"}
                </h2>
              </div>

              {form.mode === "INDIVIDUAL" ? (
                /* Individual Mode: Exactly ONE Accountable Developer */
                <div className="space-y-4">
                  <div className="p-3 rounded-lg border border-blue-200/70 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Individual Mode Rule</p>
                      <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mt-0.5">
                        Exactly one accountable developer is assigned. The project starts with 0 tasks and no artificial progress baseline.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Accountable Developer <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={form.accountableDeveloperId}
                        onChange={(e) => set("accountableDeveloperId", e.target.value)}
                        className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      >
                        {availableDevelopers.map((dev) => (
                          <option key={dev.id} value={dev.id}>
                            {dev.name} ({dev.title || dev.role || "Developer"})
                          </option>
                        ))}
                      </select>
                      {errors.accountableDeveloperId && (
                        <p className="text-[11px] text-rose-500 mt-0.5">{errors.accountableDeveloperId}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Project Manager
                      </label>
                      <select
                        value={form.projectManagerId}
                        onChange={(e) => set("projectManagerId", e.target.value)}
                        className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      >
                        {availableManagers.map((pm) => (
                          <option key={pm.id} value={pm.id}>
                            {pm.name} ({pm.title || pm.role || "Project Manager"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                /* Structured Mode: Team Lead, Delivery Squad & Multi-Developer Members */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Delivery Team / Squad
                      </label>
                      <select
                        value={form.teamId}
                        onChange={(e) => set("teamId", e.target.value)}
                        className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      >
                        {deliveryTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Team Lead
                      </label>
                      <select
                        value={form.teamLeadId}
                        onChange={(e) => set("teamLeadId", e.target.value)}
                        className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      >
                        {availableManagers.map((lead) => (
                          <option key={lead.id} value={lead.id}>
                            {lead.name} ({lead.title || lead.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Project Manager
                      </label>
                      <select
                        value={form.projectManagerId}
                        onChange={(e) => set("projectManagerId", e.target.value)}
                        className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      >
                        {availableManagers.map((pm) => (
                          <option key={pm.id} value={pm.id}>
                            {pm.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Multi-member Selection */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Assigned Engineers & Members <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {form.selectedMemberIds.length} members selected
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 max-h-48 overflow-y-auto">
                      {availableDevelopers.map((dev) => {
                        const isSelected = form.selectedMemberIds.includes(dev.id);
                        return (
                          <div
                            key={dev.id}
                            onClick={() => toggleMemberSelection(dev.id)}
                            className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-medium"
                                : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#181B20] text-slate-600 dark:text-slate-400 hover:border-slate-300"
                            }`}
                          >
                            <div className="truncate pr-1">
                              <p className="truncate text-[11px] font-medium">{dev.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{dev.title || dev.role}</p>
                            </div>
                            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 dark:border-slate-700"}`}>
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {errors.selectedMemberIds && (
                      <p className="text-[11px] text-rose-500">{errors.selectedMemberIds}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Timeline & Operational Settings */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Timeline & Operational Settings</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Project Start Date <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => set("startDate", e.target.value)}
                    className="text-xs h-9 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-lg"
                  />
                  {errors.startDate && <p className="text-[11px] text-rose-500 mt-0.5">{errors.startDate}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Target Delivery Date <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="date"
                    min={form.startDate}
                    value={form.dueDate}
                    onChange={(e) => set("dueDate", e.target.value)}
                    className="text-xs h-9 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 rounded-lg"
                  />
                  {errors.dueDate && <p className="text-[11px] text-rose-500 mt-0.5">{errors.dueDate}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Timezone (IANA)
                  </label>
                  <select
                    value={form.timezone}
                    onChange={(e) => set("timezone", e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    {IANA_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => set("priority", e.target.value as any)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium (Default)</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Mode Guidelines, Preview & Action Buttons */}
          <div className="space-y-5">
            {/* Action Buttons Panel */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Ready to Launch?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Review your configuration. Once created, the project will be provisioned in PostgreSQL and synchronized to authorized dashboards.
              </p>

              <div className="pt-2 space-y-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full h-9 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>{saving ? "Creating Project..." : "Create Project"}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(href("projects"))}
                  className="w-full h-9 text-xs border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </Button>
              </div>
            </div>

            {/* Mode Guide Card */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Workflow Summary: {form.mode === "INDIVIDUAL" ? "Individual" : "Structured"}</span>
              </div>

              {form.mode === "INDIVIDUAL" ? (
                <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>One accountable developer reports progress directly.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Zero tasks required on setup; clean backlog.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Developer Solo Check-in enabled immediately.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Team Lead receives future check-ins for verification.</span>
                  </li>
                </ul>
              ) : (
                <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span>Multi-developer team assigned under Team Lead.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span>Sprint board, task breakdown, and milestone hierarchy.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span>Progress calculated only from approved baselines.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span>Full sprint board and task state transitions.</span>
                  </li>
                </ul>
              )}
            </div>

            {/* Selected Roster Card */}
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#181B20] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Key Stakeholders</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {form.key ? `[${form.key}]` : "KEY"}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                  <span className="text-slate-500">Project Manager</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                    {availableManagers.find((m) => m.id === form.projectManagerId)?.name || "Manager"}
                  </span>
                </div>

                {form.mode === "INDIVIDUAL" ? (
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="text-slate-500">Accountable Dev</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[140px]">
                      {availableDevelopers.find((d) => d.id === form.accountableDeveloperId)?.name || "Developer"}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                      <span className="text-slate-500">Team Lead</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400 truncate max-w-[140px]">
                        {availableManagers.find((m) => m.id === form.teamLeadId)?.name || "Lead"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 text-[11px]">
                      <span className="text-slate-500">Delivery Squad</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                        {selectedTeam?.name || "Squad"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </PageFrame>
  );
}
