"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  GitBranch,
  KeyRound,
  Mail,
  Plug,
  Power,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { PlatformIntegration } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { formatDateTime } from "../_services/super-admin-service";
import {
  AdminButton,
  ConfirmActionModal,
  KpiCard,
  PageHeader,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "../_components/SuperAdminPrimitives";

function getIntegrationIcon(category: PlatformIntegration["category"]) {
  switch (category) {
    case "Source Control":
      return GitBranch;
    case "Billing Gateway":
      return CreditCard;
    case "Email Delivery":
      return Mail;
    case "Identity SSO":
      return KeyRound;
    default:
      return Activity;
  }
}

export default function SuperAdminIntegrationsPage() {
  const integrations = useSuperAdminStore((s) => s.integrations);
  const toggleIntegrationEnabled = useSuperAdminStore((s) => s.toggleIntegrationEnabled);
  const testIntegrationConnection = useSuperAdminStore((s) => s.testIntegrationConnection);

  const { can } = useAdminPermissions();
  const canManage = can("integrations.manage");

  const [disableTarget, setDisableTarget] = useState<PlatformIntegration | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const enabledCount = integrations.filter((i) => i.enabled).length;
  const healthyCount = integrations.filter((i) => i.healthStatus === "Healthy").length;
  const degradedCount = integrations.filter((i) => i.healthStatus === "Degraded").length;

  const handleTest = async (item: PlatformIntegration) => {
    setTestingId(item.id);
    await new Promise((r) => setTimeout(r, 320));
    const res = testIntegrationConnection(item.id);
    setTestingId(null);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integration Overview"
        description="High-level governance across connected platform providers. Day-to-day queue diagnostics remain under Platform Operator."
        simulationLabel="Simulated Provider Checks"
        actions={
          <Link href="/super-admin/integration-settings">
            <AdminButton variant="primary" size="sm">
              <Wrench className="w-3.5 h-3.5" />
              Integration Settings
            </AdminButton>
          </Link>
        }
      />

      <SimulationNotice
        title="Governance Oversight Scope"
        description="Super Admins control service enablement, credential rotation, and health policies. Connection tests run simulated checks."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Connected Services" value={integrations.length} sublabel={`${enabledCount} currently active`} icon={Plug} tone="blue" />
        <KpiCard label="Healthy Services" value={healthyCount} sublabel="Passing readiness checks" icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Attention Needed" value={degradedCount} sublabel="Elevated latency or warnings" icon={AlertTriangle} tone={degradedCount > 0 ? "amber" : "slate"} />
        <KpiCard label="Tenant Coverage" value="10 Orgs" sublabel="Protected by isolation boundary" icon={GitBranch} tone="violet" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {integrations.map((item) => {
          const Icon = getIntegrationIcon(item.category);
          return (
            <SurfaceCard key={item.id} className="p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/12 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {item.category} • {item.environment}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    label={item.healthStatus}
                    tone={
                      item.healthStatus === "Healthy"
                        ? "success"
                        : item.healthStatus === "Degraded"
                        ? "warning"
                        : "neutral"
                    }
                    dot
                  />
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {item.description}
                </p>

                <div className="grid grid-cols-2 gap-2 text-[11px] rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                  <div>
                    <span className="text-[var(--color-text-muted)] block">Connected Orgs</span>
                    <strong className="text-[var(--color-text-primary)]">{item.connectedOrgsCount} tenants</strong>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] block">Sync Interval</span>
                    <strong className="text-[var(--color-text-primary)]">Every {item.syncFrequencyMinutes} min</strong>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-[var(--color-border)] text-[var(--color-text-muted)]">
                    Last checked: {formatDateTime(item.lastCheckedAt)}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AdminButton
                    variant="outline"
                    size="xs"
                    isLoading={testingId === item.id}
                    permissionLocked={!canManage}
                    onClick={() => handleTest(item)}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Test
                  </AdminButton>
                  <Link href={`/super-admin/integration-settings?service=${item.key}`}>
                    <AdminButton variant="ghost" size="xs">
                      <Wrench className="w-3 h-3" />
                      Configure
                    </AdminButton>
                  </Link>
                </div>

                <AdminButton
                  variant={item.enabled ? "ghost" : "subtle"}
                  size="xs"
                  permissionLocked={!canManage}
                  className={item.enabled ? "text-amber-600 dark:text-amber-300" : ""}
                  onClick={() => {
                    if (item.enabled) {
                      setDisableTarget(item);
                    } else {
                      toggleIntegrationEnabled(item.id);
                      toast.success(`Enabled ${item.name}`);
                    }
                  }}
                >
                  <Power className="w-3 h-3" />
                  {item.enabled ? "Disable" : "Enable"}
                </AdminButton>
              </div>
            </SurfaceCard>
          );
        })}
      </div>

      <ConfirmActionModal
        isOpen={Boolean(disableTarget)}
        onClose={() => setDisableTarget(null)}
        title={`Disable ${disableTarget?.name || ""}?`}
        description="Disabling this platform service pauses synchronization across all connected tenant organizations until re-enabled."
        confirmLabel="Disable Service"
        variant="danger"
        onConfirm={() => {
          if (!disableTarget) return;
          toggleIntegrationEnabled(disableTarget.id);
          toast.warning(`Disabled ${disableTarget.name}`);
        }}
      />
    </div>
  );
}
