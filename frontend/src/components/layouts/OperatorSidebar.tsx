"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  CreditCard,
  DatabaseBackup,
  FileWarning,
  History,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  MailPlus,
  Megaphone,
  Server,
  Settings,
  ShieldCheck,
  Wrench,
} from "lucide-react";

const OPERATOR_SECTIONS = [
  {
    title: "Operations Overview",
    items: [
      { title: "Operations Dashboard", href: "/platform-operator/dashboard", icon: LayoutDashboard },
      { title: "Organization Service Status", href: "/platform-operator/organization-status", icon: Building2 },
      { title: "System Monitoring", href: "/platform-operator/monitoring", icon: Server },
    ],
  },
  {
    title: "Incidents & Support",
    items: [
      { title: "Incident Management", href: "/platform-operator/incidents", icon: AlertTriangle },
      { title: "Support Tickets", href: "/platform-operator/support-tickets", icon: LifeBuoy },
      { title: "Support Access Requests", href: "/platform-operator/access-requests", icon: KeyRound },
    ],
  },
  {
    title: "Communication Operations",
    items: [
      { title: "Email Delivery & SMTP Health", href: "/platform-operator/email-delivery", icon: Mail },
      { title: "Email Template Drafts", href: "/platform-operator/email-drafts", icon: MailPlus },
      { title: "Announcement Drafts", href: "/platform-operator/announcement-drafts", icon: Megaphone },
    ],
  },
  {
    title: "Billing Operations",
    items: [
      { title: "Subscription Status", href: "/platform-operator/subscription-status", icon: ShieldCheck },
      { title: "Payment Failures", href: "/platform-operator/payment-failures", icon: FileWarning },
      { title: "Invoice Delivery", href: "/platform-operator/invoice-delivery", icon: CreditCard },
    ],
  },
  {
    title: "System Operations",
    items: [
      { title: "Backup Monitoring", href: "/platform-operator/backups", icon: DatabaseBackup },
      { title: "Maintenance Operations", href: "/platform-operator/maintenance", icon: Wrench },
      { title: "Alerts & Notifications", href: "/platform-operator/alerts", icon: Bell },
    ],
  },
  {
    title: "Account & Audit",
    items: [
      { title: "Operational Activity Logs", href: "/platform-operator/activity-logs", icon: History },
      { title: "Operator Settings", href: "/platform-operator/settings", icon: Settings },
    ],
  },
];

export function OperatorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-sidebar)] flex flex-col h-screen sticky top-0 overflow-hidden">
      <div className="flex h-16 items-center gap-2.5 px-6 border-b border-[var(--color-border)] shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D9488] text-white font-bold">
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <span className="font-bold text-sm tracking-tight text-[var(--color-text-primary)]">ProWise</span>
          <span className="ml-1.5 rounded bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
            OPERATOR
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {OPERATOR_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-teal-500/12 text-teal-700 dark:text-teal-300 font-semibold"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
