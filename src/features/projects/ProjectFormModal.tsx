"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import type {
  ProjectDto,
  CreateProjectDto,
  UpdateProjectDto,
  ProjectModeDto,
  ProjectPriorityDto,
  ProjectLifecycleDto,
} from "@/types/api";
import { AlertCircle, Calendar, Clock, Layers, ShieldCheck, User } from "lucide-react";

interface MemberOption {
  id: string;
  name: string;
  email: string;
}

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectDto | UpdateProjectDto) => Promise<void>;
  project?: ProjectDto | null;
  members: MemberOption[];
}

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];

export function ProjectFormModal({
  isOpen,
  onClose,
  onSubmit,
  project,
  members,
}: ProjectFormModalProps) {
  const isEdit = Boolean(project);

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<ProjectModeDto>("STRUCTURED");
  const [priority, setPriority] = useState<ProjectPriorityDto>("MEDIUM");
  const [lifecycle, setLifecycle] = useState<ProjectLifecycleDto>("ACTIVE");
  const [projectManagerId, setProjectManagerId] = useState("");
  const [accountableDeveloperId, setAccountableDeveloperId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetDateReason, setTargetDateReason] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setKey(project.key);
      setDescription(project.description ?? "");
      setMode(project.mode);
      setPriority(project.priority);
      setLifecycle(project.lifecycle);
      setProjectManagerId(project.project_manager?.membership_id ?? "");
      setAccountableDeveloperId(project.accountable?.membership_id ?? "");
      setStartDate(project.start_on ?? "");
      setTargetDate(project.target_on ?? "");
      setTargetDateReason("");
      setTimezone(project.timezone || "America/New_York");
      setSelectedMemberIds(project.members.map((member) => member.membership_id));
    } else {
      setName("");
      setKey("");
      setDescription("");
      setMode("STRUCTURED");
      setPriority("MEDIUM");
      setLifecycle("ACTIVE");
      setProjectManagerId(members[0]?.id ?? "");
      setAccountableDeveloperId(members[0]?.id ?? "");
      const today = new Date().toISOString().split("T")[0];
      setStartDate(today);
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      setTargetDate(nextMonth);
      setTargetDateReason("");
      setTimezone("America/New_York");
      setSelectedMemberIds([]);
    }
    setErrors({});
  }, [project, isOpen, members]);

  const targetDateChanged = Boolean(
    project &&
      project.target_on &&
      targetDate !== project.target_on
  );

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Project name is required.";
    else if (name.trim().length > 200) errs.name = "Name must not exceed 200 characters.";

    if (!isEdit) {
      if (lifecycle === "ON_HOLD") {
        errs.lifecycle = "New projects must start as Planned or Active.";
      }
      const trimmedKey = key.trim().toUpperCase();
      if (!trimmedKey) errs.key = "Project key is required.";
      else if (trimmedKey.length < 2 || trimmedKey.length > 20)
        errs.key = "Key must be between 2 and 20 characters.";
      else if (!/^[A-Z0-9_-]+$/.test(trimmedKey))
        errs.key = "Key can only contain uppercase letters, numbers, hyphens, or underscores.";
    }

    if (mode === "INDIVIDUAL" && !accountableDeveloperId) {
      errs.accountableDeveloperId = "Accountable developer is required for Individual mode.";
    }

    if (startDate && targetDate && targetDate < startDate) {
      errs.targetDate = "Target delivery date cannot be before start date.";
    }

    if (isEdit && targetDateChanged && !targetDateReason.trim()) {
      errs.targetDateReason = "Reason is mandatory when modifying the target delivery date.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (isEdit && project) {
        const updatePayload: UpdateProjectDto = {
          name: name.trim(),
          description: description.trim(),
          mode,
          priority,
          lifecycle,
          project_manager_membership_id: projectManagerId || undefined,
          accountable_membership_id: accountableDeveloperId || undefined,
          start_on: startDate || undefined,
          target_on: targetDate || undefined,
          previous_target_on: targetDateChanged ? project.target_on : undefined,
          target_date_reason: targetDateReason.trim() || undefined,
          timezone,
          member_membership_ids: selectedMemberIds,
          expected_version: project.version,
        };
        await onSubmit(updatePayload);
      } else {
        const createPayload: CreateProjectDto = {
          name: name.trim(),
          key: key.trim().toUpperCase(),
          description: description.trim(),
          mode,
          priority,
          status: lifecycle === "PLANNED" ? "PLANNED" : "ACTIVE",
          project_manager_membership_id: projectManagerId || undefined,
          accountable_membership_id: accountableDeveloperId || undefined,
          start_on: startDate || undefined,
          target_on: targetDate || undefined,
          timezone,
          member_membership_ids: selectedMemberIds,
        };
        await onSubmit(createPayload);
      }
      onClose();
    } catch {
      // errors handled by caller
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Project: ${project?.key}` : "Create New Project"}
      description={
        isEdit
          ? "Update project attributes, deadline, and assignments."
          : "Configure project fundamentals, delivery mode, and team assignments."
      }
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Name and Key */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-app-text-primary mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Identity Architecture Migration"
              className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-primary mb-1">
              Project Key <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={key}
              disabled={isEdit}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="e.g. IAM"
              maxLength={20}
              className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm font-mono uppercase text-app-text-primary placeholder:text-app-text-muted disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-app-accent"
            />
            {errors.key && <p className="text-xs text-red-500 mt-1">{errors.key}</p>}
          </div>
        </div>

        {/* Mode Selector */}
        <div>
          <label className="block text-xs font-semibold text-app-text-primary mb-2">
            Delivery Mode <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("INDIVIDUAL")}
              className={`p-3 rounded-lg border text-left transition-all ${
                mode === "INDIVIDUAL"
                  ? "border-blue-500 bg-blue-50/20 dark:bg-blue-950/30 ring-1 ring-blue-500"
                  : "border-app-border hover:bg-app-hover"
              }`}
            >
              <div className="flex items-center gap-2 font-medium text-sm text-app-text-primary">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Individual Mode (Solo)
              </div>
              <p className="text-xs text-app-text-muted mt-1 leading-relaxed">
                One accountable developer with <strong>zero tasks required</strong>. Progress reported directly via check-ins with strictly no invented percentages.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode("STRUCTURED")}
              className={`p-3 rounded-lg border text-left transition-all ${
                mode === "STRUCTURED"
                  ? "border-blue-500 bg-blue-50/20 dark:bg-blue-950/30 ring-1 ring-blue-500"
                  : "border-app-border hover:bg-app-hover"
              }`}
            >
              <div className="flex items-center gap-2 font-medium text-sm text-app-text-primary">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Structured Mode (Team)
              </div>
              <p className="text-xs text-app-text-muted mt-1 leading-relaxed">
                Multi-member delivery organized through tasks, deliverables, milestones, reviews, and scope baselines.
              </p>
            </button>
          </div>
        </div>

        {/* Accountable Developer & Project Manager */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-app-text-primary mb-1">
              Accountable Developer {mode === "INDIVIDUAL" && <span className="text-red-500">*</span>}
            </label>
            <select
              value={accountableDeveloperId}
              onChange={(e) => setAccountableDeveloperId(e.target.value)}
              className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent"
            >
              <option value="">Select Accountable Developer</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
            {errors.accountableDeveloperId && (
              <p className="text-xs text-red-500 mt-1">{errors.accountableDeveloperId}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-primary mb-1">
              Project Manager
            </label>
            <select
              value={projectManagerId}
              onChange={(e) => setProjectManagerId(e.target.value)}
              className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent"
            >
              <option value="">Select Project Manager</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Priority & Lifecycle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-app-text-primary mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ProjectPriorityDto)}
              className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-primary mb-1">
              Lifecycle Status
            </label>
            <select
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value as ProjectLifecycleDto)}
              className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent"
            >
              <option value="PLANNED">Planned</option>
              <option value="ACTIVE">Active</option>
              {isEdit && <option value="ON_HOLD">On Hold</option>}
            </select>
            {errors.lifecycle && <p className="text-xs text-red-500 mt-1">{errors.lifecycle}</p>}
          </div>
        </div>

        {/* Dates & Timezone */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-app-text-primary mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-app-text-muted" /> Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-primary mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-app-text-muted" /> Target Delivery Date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent"
            />
            {errors.targetDate && (
              <p className="text-xs text-red-500 mt-1">{errors.targetDate}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-primary mb-1">
              Timezone (IANA)
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Target Date Reason (when editing & date changed) */}
        {isEdit && targetDateChanged && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> Reason for Target Date Change <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={targetDateReason}
              onChange={(e) => setTargetDateReason(e.target.value)}
              placeholder="e.g. Scope adjustment requested by stakeholders"
              className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
            />
            {errors.targetDateReason && (
              <p className="text-xs text-red-500 mt-1">{errors.targetDateReason}</p>
            )}
            <p className="text-[11px] text-app-text-muted mt-1">
              Audit requirement: Delivery target revisions are preserved in the project date history.
            </p>
          </div>
        )}

        {/* Description / Scope */}
        <div>
          <label className="block text-xs font-semibold text-app-text-primary mb-1">
            Description & Scope Summary
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Outline project objectives, core deliverables, or constraints..."
            className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-primary placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-app-border">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting}>
            {isEdit ? "Save Changes" : "Create Project"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
