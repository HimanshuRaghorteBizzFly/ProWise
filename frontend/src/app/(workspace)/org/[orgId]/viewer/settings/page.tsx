"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import {
  Settings,
  User,
  Sun,
  Moon,
  Lock,
  Bell,
  ShieldAlert,
  CheckCircle2,
  Save,
  KeyRound,
  ShieldCheck,
  Monitor,
} from "lucide-react";
import {
  ViewerPageHeader,
  ViewerSurfaceCard,
  ViewerKpiCard,
  ViewerButton,
  ViewerStatusBadge,
} from "../_components/ViewerPrimitives";
import { useViewerStore } from "../_store/useViewerStore";
import { useThemeStore } from "@/store/theme-store";
import { toast } from "sonner";

export default function ViewerSettingsPage() {
  const params = useParams();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const { userSettings, updateUserSettings } = useViewerStore();
  const { theme, setTheme, resolvedTheme } = useThemeStore();

  const [displayName, setDisplayName] = useState(userSettings.displayName);
  const [timezone, setTimezone] = useState(userSettings.timezone);
  const [dateFormat, setDateFormat] = useState(userSettings.dateFormat);
  const [emailDigests, setEmailDigests] = useState(userSettings.emailDigests);
  const [notifyMilestones, setNotifyMilestones] = useState(userSettings.notifyOnMilestones);
  const [notifyHealth, setNotifyHealth] = useState(userSettings.notifyOnHealthChange);
  const [notifyReports, setNotifyReports] = useState(userSettings.notifyOnReports);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserSettings({
      displayName,
      timezone,
      dateFormat,
    });
    toast.success("Profile preferences saved successfully.");
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserSettings({
      emailDigests,
      notifyOnMilestones: notifyMilestones,
      notifyOnHealthChange: notifyHealth,
      notifyOnReports: notifyReports,
    });
    toast.success("Notification preferences updated.");
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    toast.success("Your password has been updated securely.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header */}
      <ViewerPageHeader
        title="Personal Preferences & Account Settings"
        description="Manage your individual stakeholder display preferences, notification frequencies, theme appearance, and security credentials."
        badge={`Account: ${userSettings.email}`}
        simulationLabel="Reactive Demo Data"
      />

      {/* 2. Governance RBAC Boundary Notice */}
      <ViewerSurfaceCard className="p-4 border-amber-500/30 bg-amber-500/10">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <span className="font-bold">Stakeholder RBAC Scope: </span>
            You are editing preferences for your personal account only. Administrative platform configurations, cross-tenant policies, and billing subscriptions are managed exclusively by Platform Operators and Owners.
          </div>
        </div>
      </ViewerSurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* 3. Section: Profile & Display Preferences */}
        <ViewerSurfaceCard className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--color-border,#E2E8F0)]">
              <User className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-sm text-[var(--color-text-primary,#202124)]">
                Profile & Display Preferences
              </h3>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-[var(--color-text-secondary,#5F6368)] mb-1">
                  Full Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-3 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--color-text-secondary,#5F6368)] mb-1">
                  Email Address (Fixed)
                </label>
                <input
                  type="email"
                  disabled
                  value={userSettings.email}
                  className="h-9 w-full rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-3 text-xs text-[var(--color-text-muted,#80868B)] opacity-60 font-mono cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--color-text-secondary,#5F6368)] mb-1">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="America/New_York">America/New York (EST)</option>
                    <option value="America/Chicago">America/Chicago (CST)</option>
                    <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
                    <option value="UTC">UTC (Universal)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[var(--color-text-secondary,#5F6368)] mb-1">
                    Date Format
                  </label>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <ViewerButton variant="primary" size="sm" type="submit">
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Profile</span>
                </ViewerButton>
              </div>
            </form>
          </div>
        </ViewerSurfaceCard>

        {/* 4. Section: Theme & Visual Appearance */}
        <ViewerSurfaceCard className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--color-border,#E2E8F0)]">
              <Sun className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-sm text-[var(--color-text-primary,#202124)]">
                Theme & Interface Appearance
              </h3>
            </div>

            <p className="text-xs text-[var(--color-text-secondary,#5F6368)] mb-4">
              Select your preferred visual mode for the Viewer Workspace.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "light", label: "Light", icon: Sun },
                { id: "dark", label: "Dark", icon: Moon },
                { id: "system", label: "System", icon: Monitor },
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id as any)}
                    className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold shadow-xs"
                        : "border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-secondary,#5F6368)]"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-[var(--color-app-bg,#F8FAFD)] border border-[var(--color-border,#E2E8F0)] text-[11px] text-[var(--color-text-muted,#80868B)]">
              Currently active: <strong className="text-[var(--color-text-primary,#202124)] font-mono capitalize">{resolvedTheme}</strong> mode.
            </div>
          </div>
        </ViewerSurfaceCard>

        {/* 5. Section: Notification Subscriptions */}
        <ViewerSurfaceCard className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--color-border,#E2E8F0)]">
              <Bell className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-sm text-[var(--color-text-primary,#202124)]">
                Email Digests & Notification Subscriptions
              </h3>
            </div>

            <form onSubmit={handleSaveNotifications} className="space-y-3.5 text-xs">
              <div className="space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailDigests !== "OFF"}
                    onChange={(e) => setEmailDigests(e.target.checked ? "WEEKLY" : "OFF")}
                    className="mt-0.5 rounded border-[var(--color-border,#E2E8F0)] text-blue-600 accent-blue-600"
                  />
                  <div>
                    <span className="font-medium text-[var(--color-text-primary,#202124)] block">
                      Weekly Executive Delivery Digest
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted,#80868B)]">
                      Receive weekly summary emails with milestone completion progress.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyMilestones}
                    onChange={(e) => setNotifyMilestones(e.target.checked)}
                    className="mt-0.5 rounded border-[var(--color-border,#E2E8F0)] text-blue-600 accent-blue-600"
                  />
                  <div>
                    <span className="font-medium text-[var(--color-text-primary,#202124)] block">
                      Milestone Phase Delivery Alerts
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted,#80868B)]">
                      Instant alerts when key deliverables transition to shipped.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyHealth}
                    onChange={(e) => setNotifyHealth(e.target.checked)}
                    className="mt-0.5 rounded border-[var(--color-border,#E2E8F0)] text-blue-600 accent-blue-600"
                  />
                  <div>
                    <span className="font-medium text-[var(--color-text-primary,#202124)] block">
                      Project Health Risk Alerts
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted,#80868B)]">
                      Notify immediately if an authorized initiative becomes AT_RISK or DELAYED.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-2">
                <ViewerButton variant="primary" size="sm" type="submit">
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Subscriptions</span>
                </ViewerButton>
              </div>
            </form>
          </div>
        </ViewerSurfaceCard>

        {/* 6. Section: Security & Password Update Simulation */}
        <ViewerSurfaceCard className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--color-border,#E2E8F0)]">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-sm text-[var(--color-text-primary,#202124)]">
                Security & Password Update
              </h3>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-[var(--color-text-secondary,#5F6368)] mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-3 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--color-text-secondary,#5F6368)] mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    placeholder="At least 8 chars"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-3 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[var(--color-text-secondary,#5F6368)] mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-3 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <ViewerButton variant="primary" size="sm" type="submit">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Change Password</span>
                </ViewerButton>
              </div>
            </form>
          </div>
        </ViewerSurfaceCard>
      </div>
    </div>
  );
}
