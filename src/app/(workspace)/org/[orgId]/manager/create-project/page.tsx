"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { SEEDED_USERS } from "@/lib/mock-data";
import { ProjectMode, Priority, ReportingCadence } from "@/types";
import { toast } from "sonner";
import { Check, ArrowRight, ArrowLeft, Sparkles, User, Calendar, Layers, ShieldCheck } from "lucide-react";

export default function CreateProjectWizard() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg, currentUser } = useAuthStore();
  const { createProject } = useProjectStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Basic
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("HIGH");

  // Step 2: Mode
  const [mode, setMode] = useState<ProjectMode>("STRUCTURED");

  // Step 3: Ownership
  const [pmId, setPmId] = useState("usr-manager");
  const [accountableOwnerId, setAccountableOwnerId] = useState("usr-developer");

  // Step 4: Schedule
  const [startDate, setStartDate] = useState("2026-11-01");
  const [targetDate, setTargetDate] = useState("2026-12-31");
  const [cadence, setCadence] = useState<ReportingCadence>("WEEKLY");
  const [timezone, setTimezone] = useState(currentOrg.timezone || "America/New_York");

  const handleNext = () => {
    if (step === 1) {
      if (!name || !key) {
        toast.error("Please enter a project name and unique project key.");
        return;
      }
    }
    if (step < 5) setStep((step + 1) as any);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as any);
  };

  const handleCreate = () => {
    const project = createProject({
      orgId,
      key: key.toUpperCase(),
      name,
      description,
      mode,
      lifecycle: "ACTIVE",
      archived: false,
      priority,
      projectManagerId: pmId,
      accountableOwnerId,
      teamIds: ["team-eng-core"],
      memberIds: [pmId, accountableOwnerId],
      startDate,
      targetDate,
      timezone,
      cadence,
      graceWorkingDays: 1,
      repositoryIds: ["repo-1"],
    });

    toast.success(`Project ${project.name} (${project.key}) created in ${mode} mode!`);
    router.push(`/org/${orgId}/manager`);
  };

  return (
    <PanelLayout
      title="Create New Project"
      breadcrumb={[
        { label: "Project Manager", href: `/org/${orgId}/manager` },
        { label: "Create Project Wizard" },
      ]}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between pb-4 border-b border-app-border text-xs">
          {[
            { num: 1, label: "Basics" },
            { num: 2, label: "Mode" },
            { num: 3, label: "Ownership" },
            { num: 4, label: "Schedule" },
            { num: 5, label: "Review" },
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-1.5 font-medium ${
                step === s.num
                  ? "text-blue-600 dark:text-blue-400 font-bold"
                  : step > s.num
                  ? "text-green-600"
                  : "text-app-text-muted"
              }`}
            >
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                  step === s.num
                    ? "bg-blue-600 text-white font-bold"
                    : step > s.num
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-slate-100 dark:bg-slate-800 text-app-text-muted"
                }`}
              >
                {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Wizard Form Card */}
        <Card className="p-6">
          {/* Step 1: Basic project details */}
          {step === 1 && (
            <div className="space-y-4">
              <CardTitle>Step 1: Project Details</CardTitle>
              <CardDescription>
                Provide the high-level identity and priority for this software delivery initiative.
              </CardDescription>

              <Input
                label="Project Name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!key) {
                    setKey(e.target.value.slice(0, 4).toUpperCase());
                  }
                }}
                placeholder="e.g. Telehealth Video Gateway"
                required
              />

              <Input
                label="Project Key (Unique identifier)"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="e.g. TELE"
                helperText="Keys are immutable across tasks and git event linkages (e.g. TELE-101)."
                required
              />

              <Textarea
                label="Scope Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe business outcomes, target deliverables, and acceptance standards..."
                rows={3}
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-app-text-secondary">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Choose project mode */}
          {step === 2 && (
            <div className="space-y-4">
              <CardTitle>Step 2: Choose Delivery Mode</CardTitle>
              <CardDescription>
                Select the tracking philosophy that matches your engineering structure.
              </CardDescription>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div
                  onClick={() => setMode("INDIVIDUAL")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    mode === "INDIVIDUAL"
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                      : "border-app-border hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-app-text-primary">
                      Mode A: Individual Ownership
                    </span>
                    {mode === "INDIVIDUAL" && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-xs text-app-text-secondary leading-relaxed">
                    Designed for one accountable developer. <strong>No compulsory tasks required</strong>.
                    Weekly check-in reports progress percentage (0–100) with history.
                  </p>
                </div>

                <div
                  onClick={() => setMode("STRUCTURED")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    mode === "STRUCTURED"
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
                      : "border-app-border hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-app-text-primary">
                      Mode B: Structured Delivery
                    </span>
                    {mode === "STRUCTURED" && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-xs text-app-text-secondary leading-relaxed">
                    Designed for teams. Approved baseline scope with weighted leaves. Progress = Sum(Done Leaves) / Total Baseline.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Ownership */}
          {step === 3 && (
            <div className="space-y-4">
              <CardTitle>Step 3: Ownership &amp; Accountability</CardTitle>
              <CardDescription>
                Appoint the Project Manager and the Accountable Developer or Lead.
              </CardDescription>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-app-text-secondary">
                  Project Manager
                </label>
                <select
                  value={pmId}
                  onChange={(e) => setPmId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary"
                >
                  <option value="usr-manager">Elena Rostova (Project Manager)</option>
                  <option value="usr-admin">Marcus Vance (Org Admin)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-app-text-secondary">
                  {mode === "INDIVIDUAL" ? "Accountable Solo Developer" : "Accountable Lead"}
                </label>
                <select
                  value={accountableOwnerId}
                  onChange={(e) => setAccountableOwnerId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary"
                >
                  <option value="usr-developer">Alex Rivera (Developer)</option>
                  <option value="usr-lead">David Kim (Team Lead)</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Schedule */}
          {step === 4 && (
            <div className="space-y-4">
              <CardTitle>Step 4: Schedule &amp; Cadence</CardTitle>
              <CardDescription>
                Configure target dates, working calendar, and check-in reporting frequency.
              </CardDescription>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />

                <Input
                  label="Target Delivery Date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-app-text-secondary">
                    Reporting Cadence
                  </label>
                  <select
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value as any)}
                    className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary"
                  >
                    <option value="WEEKLY">Weekly (Default, 1 day grace)</option>
                    <option value="DAILY">Daily</option>
                    <option value="FORTNIGHTLY">Fortnightly</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-app-text-secondary">
                    Project Timezone
                  </label>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review & Create */}
          {step === 5 && (
            <div className="space-y-4">
              <CardTitle>Step 5: Review &amp; Launch</CardTitle>
              <CardDescription>
                Confirm your project parameters before activating the delivery workspace.
              </CardDescription>

              <div className="p-4 rounded-xl border border-app-border bg-app-sidebar/50 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-app-border">
                  <span className="text-app-text-secondary">Project Name &amp; Key:</span>
                  <span className="font-bold text-app-text-primary">
                    {name} ({key})
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-app-border">
                  <span className="text-app-text-secondary">Delivery Mode:</span>
                  <Badge variant="default">{mode}</Badge>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-app-border">
                  <span className="text-app-text-secondary">Accountable Owner:</span>
                  <span className="font-semibold text-blue-600">
                    {SEEDED_USERS.find((u) => u.id === accountableOwnerId)?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-app-border">
                  <span className="text-app-text-secondary">Schedule:</span>
                  <span>
                    {startDate} &rarr; {targetDate} ({cadence} Cadence)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-app-text-secondary">Baseline Starting Tasks:</span>
                  <span>
                    {mode === "INDIVIDUAL"
                      ? "Zero tasks required (Solo Check-in enabled)"
                      : "Ready for baseline leaf creation"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-app-border mt-6">
            {step > 1 ? (
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <Button size="sm" onClick={handleNext}>
                Next <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleCreate} className="bg-green-600 hover:bg-green-700">
                Launch Project Workspace
              </Button>
            )}
          </div>
        </Card>
      </div>
    </PanelLayout>
  );
}

