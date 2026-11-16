"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  GitBranch,
  KeyRound,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Megaphone,
  Plug,
  Receipt,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  UserCog,
  Users,
  Webhook,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SUPER_ADMIN_SECTIONS = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", href: "/super-admin/dashboard", matchPaths: ["/super-admin", "/super-admin/dashboard"], icon: LayoutDashboard },
      { title: "Organizations", href: "/super-admin/organizations", icon: Building2 },
      { title: "Platform Operators", href: "/super-admin/operators", icon: Users },
      { title: "Roles & Permissions", href: "/super-admin/roles-permissions", matchPaths: ["/super-admin/roles-permissions", "/super-admin/roles"], icon: Shield },
    ],
  },
  {
    title: "Billing & Revenue",
    items: [
      { title: "Plans", href: "/super-admin/plans", icon: Layers },
      { title: "Subscriptions", href: "/super-admin/subscriptions", icon: CreditCard },
      { title: "Billing & Payments", href: "/super-admin/payments", icon: Receipt },
      { title: "Invoices", href: "/super-admin/invoices", icon: FileText },
    ],
  },
  {
    title: "Integrations & API",
    items: [
      { title: "Integration Overview", href: "/super-admin/integrations", icon: Plug },
      { title: "GitHub Integration", href: "/super-admin/github-integrations", icon: GitBranch },
      { title: "Webhooks & Events", href: "/super-admin/webhooks", icon: Webhook },
      { title: "API Monitoring", href: "/super-admin/api-monitoring", icon: Activity },
      { title: "Integration Settings", href: "/super-admin/integration-settings", icon: Wrench },
    ],
  },
  {
    title: "Security & Governance",
    items: [
      { title: "Security Center", href: "/super-admin/security", icon: ShieldCheck },
      { title: "Support Access Approvals", href: "/super-admin/access-approvals", icon: KeyRound },
      { title: "Incident Governance", href: "/super-admin/incidents", icon: AlertTriangle },
      { title: "Audit & Compliance", href: "/super-admin/audit", icon: ShieldAlert },
    ],
  },
  {
    title: "Communication",
    items: [
      { title: "SMTP Email", href: "/super-admin/email-settings", matchPaths: ["/super-admin/email-settings", "/super-admin/emails"], icon: Send },
      { title: "Email Templates", href: "/super-admin/email-templates", icon: Mail },
      { title: "Announcements", href: "/super-admin/announcements", icon: Megaphone },
    ],
  },
  {
    title: "Platform Management",
    items: [
      { title: "Platform Configuration", href: "/super-admin/configuration", icon: Sliders },
      { title: "Reports & Analytics", href: "/super-admin/reports", icon: BarChart3 },
      { title: "Settings", href: "/super-admin/settings", icon: Settings },
      { title: "Support Oversight", href: "/super-admin/support", icon: LifeBuoy },
    ],
  },
  {
    title: "Super Admin Settings",
    items: [
      { title: "Account & Security", href: "/super-admin/account", icon: UserCog },
    ],
  },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-sidebar)] flex flex-col h-screen sticky top-0 overflow-hidden">
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-[var(--color-border)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A73E8] text-white font-bold">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <span className="font-bold text-sm tracking-tight text-[var(--color-text-primary)]">
            ProWise
          </span>
          <span className="ml-1.5 rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-300 uppercase">
            Admin
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {SUPER_ADMIN_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-0.5">
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = item.matchPaths
                ? item.matchPaths.includes(pathname)
                : pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-semibold"
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
