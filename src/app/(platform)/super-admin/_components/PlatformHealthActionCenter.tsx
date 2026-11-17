"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  AlertOctagon,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Flame,
  Info,
  KeyRound,
  LifeBuoy,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useSuperAdminStore } from "../_store/useSuperAdminStore";
import { SurfaceCard } from "./SuperAdminPrimitives";

export function PlatformHealthActionCenter() {
  const incidents = useSuperAdminStore((s) => s.incidents);
  const accessApprovals = useSuperAdminStore((s) => s.accessApprovals);
  const supportTickets = useSuperAdminStore((s) => s.supportTickets);
  const securityAlerts = useSuperAdminStore((s) => s.securityAlerts);
  const payments = useSuperAdminStore((s) => s.payments);
  const invoices = useSuperAdminStore((s) => s.invoices);
  const integrations = useSuperAdminStore((s) => s.integrations);

  const data = useMemo(() => {
    // 1. Platform Status & Uptime
    const degradedIntegrations = integrations.filter(
      (i) => i.enabled && i.healthStatus !== "Healthy"
    ).length;
    const uptimePercent = degradedIntegrations > 0 ? "99.94%" : "99.98%";
    const isDegraded = degradedIntegrations > 0;
    const platformStatusText = isDegraded ? "Degraded" : "Operational";

    // 2. Critical Incidents
    const activeIncidents = incidents.filter((i) => i.status !== "Resolved");
    const criticalIncidents = incidents.filter(
      (i) => i.severity === "Critical" && i.status !== "Resolved"
    );
    const latestIncident = activeIncidents[0];

    // 3. Pending Access Approvals
    const pendingApprovals = accessApprovals.filter((a) => a.status === "PENDING");
    const latestApproval = pendingApprovals[0];

    // 4. Escalated Support Tickets
    const escalatedTickets = supportTickets.filter(
      (t) => t.status === "Escalated" || t.priority === "Critical"
    );
    const breachedSlaCount = escalatedTickets.filter((t) => t.slaState === "Breached").length;

    // 5. Security Alerts
    const openSecurityAlerts = securityAlerts.filter((s) => s.status !== "Resolved");
    const highSecurityAlerts = openSecurityAlerts.filter((s) => s.severity === "High");

    // 6. Pending Administrative Actions
    const failedPayments = payments.filter((p) => p.status === "FAILED");
    const overdueInvoices = invoices.filter((i) => i.status === "OVERDUE");
    const totalPendingActions =
      failedPayments.length + overdueInvoices.length + pendingApprovals.length;

    return {
      uptimePercent,
      isDegraded,
      platformStatusText,
      degradedIntegrations,
      activeIncidentsCount: activeIncidents.length,
      criticalIncidentsCount: criticalIncidents.length,
      latestIncident,
      pendingApprovalsCount: pendingApprovals.length,
      latestApproval,
      escalatedTicketsCount: escalatedTickets.length,
      breachedSlaCount,
      openSecurityAlertsCount: openSecurityAlerts.length,
      highSecurityAlertsCount: highSecurityAlerts.length,
      failedPaymentsCount: failedPayments.length,
      overdueInvoicesCount: overdueInvoices.length,
      totalPendingActions,
    };
  }, [incidents, accessApprovals, supportTickets, securityAlerts, payments, invoices, integrations]);

  // Status Bar Items Configuration
  const statusItems = [
    {
      id: "platform-health",
      label: "Platform Health",
      value: data.isDegraded ? "Degraded" : `${data.uptimePercent}`,
      subtext: data.isDegraded ? `${data.degradedIntegrations} issues` : "All systems go",
      href: "/super-admin/api-monitoring",
      icon: Activity,
      severity: data.isDegraded ? "Degraded" : "Normal",
      severityTone: data.isDegraded ? "amber" : "emerald",
      tooltipTitle: "Platform & API Availability",
      tooltipDetails: [
        `System Status: ${data.isDegraded ? "Degraded Performance" : "Operational (100% Core APIs)"}`,
        `Current Uptime: ${data.uptimePercent}`,
        "Average Latency: 48ms across regions",
      ],
      actionLabel: "View API Telemetry",
    },
    {
      id: "critical-incidents",
      label: "Critical Incidents",
      value:
        data.criticalIncidentsCount > 0
          ? `${data.criticalIncidentsCount} Critical`
          : `${data.activeIncidentsCount} Active`,
      subtext: data.activeIncidentsCount === 0 ? "Zero open" : "Needs attention",
      href: "/super-admin/incidents",
      icon: data.criticalIncidentsCount > 0 ? Flame : AlertOctagon,
      severity:
        data.criticalIncidentsCount > 0
          ? "Critical"
          : data.activeIncidentsCount > 0
          ? "Elevated"
          : "Healthy",
      severityTone:
        data.criticalIncidentsCount > 0
          ? "rose"
          : data.activeIncidentsCount > 0
          ? "amber"
          : "emerald",
      tooltipTitle: "Platform Incident Response",
      tooltipDetails: [
        data.latestIncident
          ? `Latest: ${data.latestIncident.incidentCode} (${data.latestIncident.status})`
          : "Zero uncontained platform outages",
        data.latestIncident?.title || "All regional compute clusters operational",
      ],
      actionLabel: "Open Incident Center",
    },
    {
      id: "pending-approvals",
      label: "Pending Approvals",
      value: `${data.pendingApprovalsCount} Awaiting`,
      subtext: data.pendingApprovalsCount > 0 ? "Sign-off needed" : "Cleared",
      href: "/super-admin/access-approvals?status=PENDING",
      icon: KeyRound,
      severity: data.pendingApprovalsCount > 0 ? "Pending" : "Cleared",
      severityTone: data.pendingApprovalsCount > 0 ? "amber" : "emerald",
      tooltipTitle: "Privileged Access Requests",
      tooltipDetails: [
        data.latestApproval
          ? `Request by ${data.latestApproval.operatorName} for ${data.latestApproval.targetOrgName}`
          : "Zero pending access approval requests",
        data.latestApproval
          ? `Window: ${data.latestApproval.expiresInHours}h • Ticket: ${data.latestApproval.ticketRef}`
          : "All active staff sessions fully authorized",
      ],
      actionLabel: "Review Approvals",
    },
    {
      id: "escalated-support",
      label: "Escalated Support",
      value: `${data.escalatedTicketsCount} Priority`,
      subtext: data.breachedSlaCount > 0 ? `${data.breachedSlaCount} SLA risk` : "Within SLA",
      href: "/super-admin/support?status=Escalated",
      icon: LifeBuoy,
      severity:
        data.breachedSlaCount > 0
          ? "SLA Alert"
          : data.escalatedTicketsCount > 0
          ? "Escalated"
          : "Normal",
      severityTone:
        data.breachedSlaCount > 0
          ? "rose"
          : data.escalatedTicketsCount > 0
          ? "violet"
          : "emerald",
      tooltipTitle: "Customer Support Escalations",
      tooltipDetails: [
        data.breachedSlaCount > 0
          ? `Warning: ${data.breachedSlaCount} ticket(s) breached resolution SLA`
          : "All priority customer tickets within SLA",
        "Tier-2 engineering escalation pool active",
      ],
      actionLabel: "View Escalated Tickets",
    },
    {
      id: "security-alerts",
      label: "Security Alerts",
      value: `${data.openSecurityAlertsCount} Open`,
      subtext: data.highSecurityAlertsCount > 0 ? `${data.highSecurityAlertsCount} high risk` : "Protected",
      href: "/super-admin/security?status=Open",
      icon: data.highSecurityAlertsCount > 0 ? ShieldAlert : ShieldCheck,
      severity:
        data.highSecurityAlertsCount > 0
          ? "High Risk"
          : data.openSecurityAlertsCount > 0
          ? "Attention"
          : "Secure",
      severityTone:
        data.highSecurityAlertsCount > 0
          ? "rose"
          : data.openSecurityAlertsCount > 0
          ? "amber"
          : "emerald",
      tooltipTitle: "Security & Threat Governance",
      tooltipDetails: [
        data.highSecurityAlertsCount > 0
          ? `${data.highSecurityAlertsCount} high-severity anomaly detected`
          : "Zero active security threats detected",
        "Continuous MFA, token, and session monitoring active",
      ],
      actionLabel: "Open Security Center",
    },
    {
      id: "admin-actions",
      label: "Admin Actions",
      value: `${data.totalPendingActions} Queued`,
      subtext: data.totalPendingActions > 0 ? "Requires review" : "All cleared",
      href: "/super-admin/payments?status=FAILED",
      icon: Zap,
      severity: data.totalPendingActions > 0 ? "Attention" : "Cleared",
      severityTone: data.totalPendingActions > 0 ? "amber" : "emerald",
      tooltipTitle: "Pending Administrative Items",
      tooltipDetails: [
        `Failed Payments: ${data.failedPaymentsCount} retries queued`,
        `Overdue Invoices: ${data.overdueInvoicesCount} invoices pending collection`,
        `Access Requests: ${data.pendingApprovalsCount} awaiting approval`,
      ],
      actionLabel: "Resolve Items",
    },
  ];

  const getToneClasses = (tone: string) => {
    switch (tone) {
      case "rose":
        return {
          icon: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
          badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
          dot: "bg-rose-500",
          hoverBorder: "hover:border-rose-500/40",
        };
      case "amber":
        return {
          icon: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
          badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
          dot: "bg-amber-500",
          hoverBorder: "hover:border-amber-500/40",
        };
      case "violet":
        return {
          icon: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
          badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
          dot: "bg-violet-500",
          hoverBorder: "hover:border-violet-500/40",
        };
      case "emerald":
      default:
        return {
          icon: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
          badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
          dot: "bg-emerald-500",
          hoverBorder: "hover:border-emerald-500/40",
        };
    }
  };

  return (
    <SurfaceCard className="p-3.5 sm:p-4 transition-all duration-200 hover:border-blue-500/35">
      {/* Compact Header Bar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 rounded-md bg-emerald-500/12 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 truncate">
            <h3 className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] truncate">
              Platform Health &amp; Action Center
            </h3>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Operational • {data.uptimePercent}
            </span>
          </div>
        </div>

        <Link
          href="/platform-operator"
          className="text-[11px] text-[var(--color-text-muted)] hover:text-blue-600 dark:hover:text-blue-400 font-medium inline-flex items-center gap-1 shrink-0 transition-colors"
        >
          <span className="hidden sm:inline">Platform Operator Telemetry</span>
          <span className="sm:hidden">Operator</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Compact Horizontal Status Bar (Horizontal on Desktop, 2-Column Grid on Mobile) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)]/80 dark:bg-slate-900/60 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border)] overflow-visible">
        {statusItems.map((item, idx) => {
          const tone = getToneClasses(item.severityTone);
          const IconComp = item.icon;

          // Align tooltip for first and last items to prevent horizontal window overflow
          const tooltipAlignClass =
            idx === 0
              ? "left-0 sm:left-1/2 sm:-translate-x-1/2"
              : idx === statusItems.length - 1
              ? "right-0 sm:left-1/2 sm:-translate-x-1/2"
              : "left-1/2 -translate-x-1/2";

          return (
            <Link
              key={item.id}
              href={item.href}
              title={`${item.label}: ${item.value} (${item.severity})`}
              className={`group relative p-2.5 sm:p-3 flex flex-col justify-between gap-2 transition-all duration-150 hover:bg-[var(--color-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                idx === 0
                  ? "rounded-t-xl sm:rounded-tr-none sm:rounded-l-xl"
                  : idx === statusItems.length - 1
                  ? "rounded-b-xl sm:rounded-bl-none sm:rounded-r-xl"
                  : ""
              }`}
            >
              {/* Item Header: Icon + Severity Badge */}
              <div className="flex items-center justify-between gap-1.5">
                <div
                  className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${tone.icon}`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold tracking-wide border uppercase truncate ${tone.badge}`}
                >
                  {item.severity}
                </span>
              </div>

              {/* Item Body: Label + Count/Status */}
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-[var(--color-text-secondary)] truncate">
                  {item.label}
                </div>
                <div className="text-sm sm:text-base font-bold text-[var(--color-text-primary)] tracking-tight leading-tight truncate mt-0.5">
                  {item.value}
                </div>
              </div>

              {/* Item Footer: Subtext & Action arrow on hover */}
              <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]/60 text-[10px] text-[var(--color-text-muted)]">
                <span className="truncate">{item.subtext}</span>
                <ArrowUpRight className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 group-hover:text-blue-500 transition-opacity" />
              </div>

              {/* Rich Floating Tooltip on Hover */}
              <div
                className={`absolute bottom-full mb-2.5 w-60 sm:w-64 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl z-50 pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 text-left ${tooltipAlignClass}`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-2 pb-1.5 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-1.5">
                    <IconComp className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs font-bold text-[var(--color-text-primary)]">
                      {item.tooltipTitle}
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase ${tone.badge}`}
                  >
                    {item.severity}
                  </span>
                </div>

                <div className="space-y-1 mb-2">
                  {item.tooltipDetails.map((detail, dIdx) => (
                    <div
                      key={dIdx}
                      className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed flex items-start gap-1.5"
                    >
                      <span className="text-slate-400 mt-1 text-[8px]">•</span>
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-1.5 border-t border-[var(--color-border)] flex items-center justify-between text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  <span>{item.actionLabel}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
