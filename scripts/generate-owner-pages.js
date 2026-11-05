const fs = require('fs');
const path = require('path');

function writePage(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// 1. Dashboard re-export
writePage('src/app/(workspace)/org/[orgId]/owner/dashboard/page.tsx', `export { default } from "../page";\n`);

// 2. Organization Profile & Work Calendar
writePage('src/app/(workspace)/org/[orgId]/owner/organization/page.tsx', `"use client";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Calendar, Clock, Globe } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function OwnerOrganizationPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { currentOrg, updateOrganization } = useWorkspaceStore();

  const [name, setName] = useState(currentOrg.name);
  const [timezone, setTimezone] = useState(currentOrg.timezone || "America/New_York");
  const [dailyHours, setDailyHours] = useState(currentOrg.workCalendar?.dailyHours || 8);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrganization(orgId, {
      name,
      timezone,
      workCalendar: {
        ...currentOrg.workCalendar,
        dailyHours,
      },
    });
    toast.success("Organization profile and calendar updated.");
  };

  return (
    <PanelLayout title="Organization Profile & Calendar" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Organization" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Tenant Profile & Delivery Calendar</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Define corporate working days, daily hours, and default timezone used for grace period calculations.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary-600" /> General Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium block mb-1">Organization Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Tenant ID</label>
                <Input value={orgId} disabled className="opacity-60" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-600" /> Work Calendar & Grace Days
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium block mb-1">Default Timezone</label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs"
                >
                  <option value="America/New_York">America/New_York (UTC-5)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                  <option value="Europe/London">Europe/London (UTC+0)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Standard Daily Working Hours</label>
                <Input type="number" min={1} max={24} value={dailyHours} onChange={e => setDailyHours(Number(e.target.value))} required />
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              ProWise health calculations exclude weekends and declared holidays when calculating grace periods.
            </p>
          </Card>

          <Button type="submit">Save Changes</Button>
        </form>
      </div>
    </PanelLayout>
  );
}
`);

// 3. Workspaces
writePage('src/app/(workspace)/org/[orgId]/owner/workspaces/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Layers } from "lucide-react";
import { toast } from "sonner";

export default function OwnerWorkspacesPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Workspaces" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Workspaces" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Organization Workspaces</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Segment portfolio units, engineering divisions, and subsidiaries</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Create workspace modal...")}>
            <Plus className="w-4 h-4 mr-1.5" /> New Workspace
          </Button>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary-100 dark:bg-primary-950 text-primary-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Primary Delivery Hub</h4>
              <span className="text-[11px] text-[var(--color-text-secondary)]">Default workspace • 12 active projects</span>
            </div>
          </div>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// 4. Members
writePage('src/app/(workspace)/org/[orgId]/owner/members/page.tsx', `"use client";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEEDED_USERS } from "@/lib/mock-data";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function OwnerMembersPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const [members] = useState(SEEDED_USERS);

  return (
    <PanelLayout title="Members & Roles" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Members" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Team Roster</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Manage user seats, role grants, and access permissions</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Opening invite dialog...")}>
            <UserPlus className="w-4 h-4 mr-1.5" /> Invite Member
          </Button>
        </div>

        <Card className="overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-sidebar)] border-b border-[var(--color-border)] text-[var(--color-text-secondary)] uppercase font-semibold">
              <tr>
                <th className="p-3">Member</th>
                <th className="p-3">Role</th>
                <th className="p-3">Timezone</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-[var(--color-hover)]">
                  <td className="p-3">
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-[11px] text-[var(--color-text-secondary)]">{m.email}</div>
                  </td>
                  <td className="p-3 font-mono">{m.role}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{m.timezone}</td>
                  <td className="p-3">
                    <Badge variant="default" className="bg-green-600">Active</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// 5. Teams
writePage('src/app/(workspace)/org/[orgId]/owner/teams/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

export default function OwnerTeamsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  const teams = [
    { name: "Frontend Core", lead: "Alice Johnson", members: 6, projects: 3 },
    { name: "Backend Platforms", lead: "Michael Chang", members: 8, projects: 4 },
    { name: "Mobile & SDKs", lead: "Sarah Connor", members: 4, projects: 2 },
  ];

  return (
    <PanelLayout title="Teams" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Teams" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Organizational Teams</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Cross-functional engineering pods and delivery units</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Create team dialog...")}>
            <Plus className="w-4 h-4 mr-1.5" /> New Team
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {teams.map(t => (
            <Card key={t.name} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-600" />
                <h4 className="font-semibold text-sm">{t.name}</h4>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">Lead: {t.lead}</p>
              <div className="text-[11px] text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border)] flex justify-between">
                <span>{t.members} members</span>
                <span>{t.projects} projects</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// 6. Invitations
writePage('src/app/(workspace)/org/[orgId]/owner/invitations/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Plus } from "lucide-react";
import { toast } from "sonner";

export default function OwnerInvitationsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Invitations" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Invitations" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Pending Invitations</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Manage outstanding invitation links and expiry</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Send invitation...")}>
            <Plus className="w-4 h-4 mr-1.5" /> Send Invite
          </Button>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">No pending invitations. All invited members have joined.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// 7. Roles & Permissions
writePage('src/app/(workspace)/org/[orgId]/owner/roles-permissions/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { ROLE_PERMISSIONS } from "@/config/permissions";
import { Shield } from "lucide-react";

export default function OwnerRolesPermissionsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Roles & Permissions Matrix" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Roles" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Tenant Role Capabilities</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">V1.1 Role boundaries and permission grants</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(ROLE_PERMISSIONS).map(([role, actions]) => (
            <Card key={role} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary-600" />
                <h4 className="font-semibold text-xs font-mono">{role}</h4>
              </div>
              <div className="flex flex-wrap gap-1">
                {actions.map(act => (
                  <span key={act} className="text-[10px] font-mono bg-[var(--color-sidebar)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
                    {act}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// 8. Projects
writePage('src/app/(workspace)/org/[orgId]/owner/projects/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { HealthBadge } from "@/components/ui/health-badge";
import Link from "next/link";

export default function OwnerProjectsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { projects } = useProjects(orgId);

  return (
    <PanelLayout title="Project Portfolio" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Projects" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Organization Projects</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Complete tenant portfolio across Individual and Structured modes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(p => (
            <Card key={p.id} className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary-600">{p.key}</span>
                    <span className="text-xs font-semibold">{p.name}</span>
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{p.mode} MODE</span>
                </div>
                <HealthBadge health={p.health} />
              </div>
              <div className="flex justify-between items-center text-xs pt-2 border-t border-[var(--color-border)]">
                <span>Progress: <strong>{p.lastProgressPercent}%</strong></span>
                <span className="text-[var(--color-text-secondary)]">Target: {p.targetDate}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// 9. Subscriptions
writePage('src/app/(workspace)/org/[orgId]/owner/subscriptions/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Check } from "lucide-react";
import { toast } from "sonner";

export default function OwnerSubscriptionsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Subscription & Plan" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Subscriptions" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">ProWise SaaS Subscription</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Manage tier, seat licensing, and invoice billing cycle</p>
        </div>

        <Card className="p-6 border border-primary-200 dark:border-primary-900 bg-primary-50/30 dark:bg-primary-950/20 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <Badge variant="default">CURRENT PLAN</Badge>
              <h3 className="text-2xl font-bold mt-1">Enterprise Tier</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">Unlimited projects, custom grace period calendars, GitHub multi-repo sync</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black">$499</span>
              <span className="text-xs text-[var(--color-text-secondary)]"> / month</span>
            </div>
          </div>
          <div className="pt-4 border-t border-primary-200 dark:border-primary-900 flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={() => toast.info("Opening plan changer...")}>Change Plan</Button>
            <Button size="sm" onClick={() => toast.success("Opening Stripe Customer Portal...")}>Manage Billing in Stripe</Button>
          </div>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// 10. Billing
writePage('src/app/(workspace)/org/[orgId]/owner/billing/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function OwnerBillingPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Billing & Invoices" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Billing" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Invoices & Receipts</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Download past billing statements and tax receipts</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center">
          <div>
            <h4 className="text-sm font-semibold">Invoice #INV-2026-11</h4>
            <span className="text-xs text-[var(--color-text-secondary)]">Nov 1, 2026 • $499.00 • Paid via Stripe •••• 4242</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.success("Downloading PDF...")}>
            <Download className="w-3.5 h-3.5 mr-1" /> PDF
          </Button>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// 11. Integrations
writePage('src/app/(workspace)/org/[orgId]/owner/integrations/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitBranch, Webhook } from "lucide-react";
import { toast } from "sonner";

export default function OwnerIntegrationsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Integrations" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Integrations" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Connected Developer Tools</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">GitHub App connections, repository sync, and outgoing webhooks</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-primary-600" />
            <div>
              <h4 className="text-sm font-semibold">GitHub Organization App</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">Installed on 4 repositories • Sync active</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.success("Configuring GitHub App...")}>Configure</Button>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// 12. Reports
writePage('src/app/(workspace)/org/[orgId]/owner/reports/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function OwnerReportsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Executive Reports" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Reports" }]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Delivery Portfolio Analytics</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Velocity, delivery on-time rate, and health distributions</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.success("Exporting report...")}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
          </Button>
        </div>
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <h3 className="text-sm font-semibold mb-4">Cumulative Org Delivery Velocity</h3>
          <ProgressChart height={280} />
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// 13. Audit Logs
writePage('src/app/(workspace)/org/[orgId]/owner/audit-logs/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { exportToSafeCSV } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function OwnerAuditLogsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  const logs = [
    { id: "aud-1", timestamp: "2026-11-05 09:20", actor: "sarah.chen@acmehealth.com", action: "BASELINE_APPROVED", target: "CRM-v2", details: "Baseline approved at 100 pts" },
    { id: "aud-2", timestamp: "2026-11-04 14:10", actor: "sarah.chen@acmehealth.com", action: "MEMBER_INVITED", target: "john.doe@example.com", details: "Role: DEVELOPER" },
  ];

  const handleExport = () => {
    const csv = exportToSafeCSV(logs, ["id", "timestamp", "actor", "action", "target", "details"]);
    toast.success("Audit trail safely exported (OWASP formula sanitized).");
  };

  return (
    <PanelLayout title="Security Audit Logs" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Audit" }]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Tenant Audit Trail</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Immutable log of security and administrative operations</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
          </Button>
        </div>

        <Card className="overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-sidebar)] border-b border-[var(--color-border)] uppercase text-[var(--color-text-secondary)] font-semibold">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-[var(--color-hover)]">
                  <td className="p-3 font-mono">{l.timestamp}</td>
                  <td className="p-3 font-medium">{l.actor}</td>
                  <td className="p-3 font-mono text-primary-600 font-bold">{l.action}</td>
                  <td className="p-3 font-mono">{l.target}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// 14. Settings & Ownership Transfer
writePage('src/app/(workspace)/org/[orgId]/owner/settings/page.tsx', `"use client";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function OwnerSettingsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const [transferEmail, setTransferEmail] = useState("");

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferEmail) return;
    toast.error("Ownership transfer requires second owner verification or Platform Operator sign-off (Blueprint Rule).");
  };

  return (
    <PanelLayout title="Organization Settings & Danger Zone" breadcrumb={[{ label: "Owner", href: \`/org/\${orgId}/owner\` }, { label: "Settings" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Ownership Governance & Danger Zone</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Transfer tenant ownership, manage archive policies, and data export</p>
        </div>

        <Card className="p-6 border border-red-200 dark:border-red-900 bg-red-50/20 dark:bg-red-950/20 space-y-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold text-sm">Transfer Organization Ownership</h3>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Transfers complete operational and billing responsibility to another user. Cannot be undone without consent.
          </p>
          <form onSubmit={handleTransfer} className="flex gap-2">
            <Input
              type="email"
              value={transferEmail}
              onChange={e => setTransferEmail(e.target.value)}
              placeholder="new.owner@example.com"
              className="max-w-xs"
              required
            />
            <Button variant="destructive" type="submit">Transfer Ownership</Button>
          </form>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

console.log('Owner pages generated.');

