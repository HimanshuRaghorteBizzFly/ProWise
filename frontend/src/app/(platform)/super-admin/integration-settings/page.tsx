"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Lock, Save, Wifi } from "lucide-react";
import { toast } from "sonner";
import { PlatformIntegration } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { formatDateTime } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  ConfirmActionModal,
  PageHeader,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
} from "../_components/SuperAdminPrimitives";

export default function SuperAdminIntegrationSettingsPage() {
  const integrations = useSuperAdminStore((s) => s.integrations);
  const updateIntegrationSettings = useSuperAdminStore((s) => s.updateIntegrationSettings);
  const testIntegrationConnection = useSuperAdminStore((s) => s.testIntegrationConnection);

  const { can } = useAdminPermissions();
  const canManage = can("integrations.manage");

  const [selectedKey, setSelectedKey] = useState(integrations[0]?.key || "github-app");
  const current = integrations.find((i) => i.key === selectedKey) || integrations[0];

  const [enabled, setEnabled] = useState(current?.enabled ?? true);
  const [environment, setEnvironment] = useState<PlatformIntegration["environment"]>(
    current?.environment || "Simulated Sandbox"
  );
  const [syncFreq, setSyncFreq] = useState(String(current?.syncFrequencyMinutes || 5));
  const [thresholdMs, setThresholdMs] = useState(String(current?.alertThresholdMs || 450));
  const [autoRetry, setAutoRetry] = useState(current?.autoRetryEnabled ?? true);
  const [newSecret, setNewSecret] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const svc = new URLSearchParams(window.location.search).get("service");
    if (svc && integrations.some((i) => i.key === svc)) {
      setSelectedKey(svc);
    }
  }, [integrations]);

  useEffect(() => {
    if (!current) return;
    setEnabled(current.enabled);
    setEnvironment(current.environment);
    setSyncFreq(String(current.syncFrequencyMinutes));
    setThresholdMs(String(current.alertThresholdMs));
    setAutoRetry(current.autoRetryEnabled);
    setNewSecret("");
  }, [current]);

  if (!current) return null;

  const commitSave = () => {
    const rotated = Boolean(newSecret.trim());
    updateIntegrationSettings(
      current.id,
      {
        enabled,
        healthStatus: enabled ? "Healthy" : "Disabled",
        environment,
        syncFrequencyMinutes: Math.max(1, Number(syncFreq) || 5),
        alertThresholdMs: Math.max(50, Number(thresholdMs) || 400),
        autoRetryEnabled: autoRetry,
      },
      rotated
    );
    setNewSecret("");
    toast.success(
      rotated
        ? `Updated ${current.name} settings and rotated credential`
        : `Saved settings for ${current.name}`
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSecret.trim()) {
      setConfirmOpen(true);
    } else {
      commitSave();
    }
  };

  const handleTest = async () => {
    setTesting(true);
    await new Promise((r) => setTimeout(r, 320));
    const res = testIntegrationConnection(current.id);
    setTesting(false);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integration Settings"
        description="Guided provider settings, sync cadence, alert thresholds, and credential rotation."
        simulationLabel="Simulated Provider Testing"
      />

      <SimulationNotice
        title="Protected Credentials"
        description="Existing API keys and signing secrets are never displayed on screen. Use the optional credential field only when rotating to a new secret."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
        {/* Left: Service Selector */}
        <div className="lg:col-span-4 space-y-2.5">
          {integrations.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedKey(item.key)}
              className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                item.key === current.key
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-500/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{item.name}</span>
                <StatusBadge
                  label={item.enabled ? item.healthStatus : "Disabled"}
                  tone={item.enabled ? (item.healthStatus === "Healthy" ? "success" : "warning") : "neutral"}
                  dot
                />
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{item.category}</p>
            </button>
          ))}
        </div>

        {/* Right: Guided Configuration Form */}
        <SurfaceCard className="lg:col-span-8 p-5">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{current.name}</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">{current.description}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <Lock className="w-3.5 h-3.5" /> Secret Stored Securely
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AdminSelect
                label="Operating Mode"
                value={environment}
                disabled={!canManage}
                onChange={(e) => setEnvironment(e.target.value as PlatformIntegration["environment"])}
                options={[
                  { label: "Simulated Sandbox", value: "Simulated Sandbox" },
                  { label: "Production Ready", value: "Production Ready" },
                ]}
              />
              <AdminSelect
                label="Sync Frequency"
                value={syncFreq}
                disabled={!canManage}
                onChange={(e) => setSyncFreq(e.target.value)}
                options={[
                  { label: "Every 1 minute", value: "1" },
                  { label: "Every 5 minutes", value: "5" },
                  { label: "Every 15 minutes", value: "15" },
                  { label: "Hourly", value: "60" },
                ]}
              />
              <AdminInput
                label="Slow Response Alert Threshold (ms)"
                type="number"
                min={50}
                value={thresholdMs}
                disabled={!canManage}
                onChange={(e) => setThresholdMs(e.target.value)}
                helperText="Triggers a monitoring alert if average response exceeds this limit."
              />
              <AdminInput
                label="Rotate API Key / Secret (Optional)"
                type="password"
                value={newSecret}
                disabled={!canManage}
                onChange={(e) => setNewSecret(e.target.value)}
                placeholder="Configured • Enter new secret only to rotate"
                helperText={`Last rotated ${formatDateTime(current.credentialUpdatedAt)}`}
              />
            </div>

            <div className="flex flex-wrap gap-5 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={!canManage}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="accent-blue-600"
                />
                Enable service across platform
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  checked={autoRetry}
                  disabled={!canManage}
                  onChange={(e) => setAutoRetry(e.target.checked)}
                  className="accent-blue-600"
                />
                Automatically retry transient failures
              </label>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs text-[var(--color-text-secondary)]">
              <CheckCircle2 className="w-4 h-4 inline mr-1.5 text-emerald-500" />
              {current.lastTestSummary}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton
                type="button"
                variant="outline"
                isLoading={testing}
                permissionLocked={!canManage}
                onClick={handleTest}
              >
                <Wifi className="w-3.5 h-3.5" />
                Test Connection
              </AdminButton>
              <AdminButton type="submit" variant="primary" permissionLocked={!canManage}>
                <Save className="w-3.5 h-3.5" />
                Save Configuration
              </AdminButton>
            </div>
          </form>
        </SurfaceCard>
      </div>

      <ConfirmActionModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Rotate credential for ${current.name}?`}
        description="Replacing this service credential takes effect immediately and is logged to the administrative audit trail."
        confirmLabel="Save & Rotate"
        variant="primary"
        onConfirm={commitSave}
      />
    </div>
  );
}

