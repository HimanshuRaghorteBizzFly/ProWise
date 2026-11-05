const fs = require('fs');
const path = require('path');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writePage(filePath, content) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, content, 'utf8');
}

// 1. Super Admin Re-exports & Pages
writePage('src/app/(platform)/super-admin/dashboard/page.tsx', `export { default } from "../page";\n`);
writePage('src/app/(platform)/super-admin/roles-permissions/page.tsx', `export { default } from "../roles/page";\n`);
writePage('src/app/(platform)/super-admin/email-settings/page.tsx', `export { default } from "../emails/page";\n`);
writePage('src/app/(platform)/super-admin/configuration/page.tsx', `export { default } from "../settings/page";\n`);

writePage('src/app/(platform)/super-admin/payments/page.tsx', `"use client";
import React, { useState } from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, DollarSign, Download, Filter } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminPaymentsPage() {
  const [payments] = useState([
    { id: "tx-901", org: "Acme Health Technologies", amount: "$5,400.00", status: "SUCCEEDED", date: "2026-11-01", method: "Stripe •••• 4242" },
    { id: "tx-902", org: "Apex Global FinTech", amount: "$12,000.00", status: "SUCCEEDED", date: "2026-11-02", method: "Wire Transfer" },
    { id: "tx-903", org: "Nova Dynamics AI", amount: "$890.00", status: "FAILED", date: "2026-11-03", method: "Stripe •••• 9812" },
  ]);

  return (
    <PanelLayout title="Payments & Transactions" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Payments" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Platform Transactions</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Live processing log across all connected Stripe & ACH accounts</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.success("Exporting transactions CSV...")}>
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Monthly Volume</span>
            <div className="text-2xl font-bold text-green-600 mt-1">$74,290.00</div>
          </Card>
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Successful Transactions</span>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">142</div>
          </Card>
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Dispute / Failure Rate</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">0.7%</div>
          </Card>
        </div>

        <Card className="overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-sidebar)] border-b border-[var(--color-border)] text-[var(--color-text-secondary)] uppercase font-semibold">
              <tr>
                <th className="p-3">Transaction ID</th>
                <th className="p-3">Organization</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Payment Method</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-[var(--color-hover)]">
                  <td className="p-3 font-mono font-semibold">{p.id}</td>
                  <td className="p-3 font-medium">{p.org}</td>
                  <td className="p-3 font-bold">{p.amount}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{p.method}</td>
                  <td className="p-3">
                    <Badge variant={p.status === "SUCCEEDED" ? "default" : "destructive"}>{p.status}</Badge>
                  </td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{p.date}</td>
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

writePage('src/app/(platform)/super-admin/email-templates/page.tsx', `"use client";
import React, { useState } from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Edit3, Send } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminEmailTemplatesPage() {
  const [templates] = useState([
    { id: "tmpl-1", name: "User Invitation", subject: "You've been invited to join {{organization_name}} on ProWise", category: "Auth" },
    { id: "tmpl-2", name: "Delivery Review Required", subject: "Action Required: {{project_name}} reached 100% progress", category: "Delivery" },
    { id: "tmpl-3", name: "Health Threshold Breach", subject: "Warning: Project {{project_key}} flagged as {{project_health}}", category: "Alert" },
    { id: "tmpl-4", name: "Invoice Receipt", subject: "Your ProWise SaaS Invoice for {{billing_period}} is ready", category: "Billing" },
  ]);

  return (
    <PanelLayout title="Email Templates" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Email Templates" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">System Email Templates</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Manage automated transactional emails sent to organizations and users</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <Card key={t.id} className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{t.name}</span>
                <Badge variant="outline">{t.category}</Badge>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] font-mono bg-[var(--color-sidebar)] p-2 rounded border border-[var(--color-border)]">
                Subject: {t.subject}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => toast.info(\`Sending test email for \${t.name}...\`)}>
                  <Send className="w-3.5 h-3.5 mr-1" /> Test
                </Button>
                <Button size="sm" onClick={() => toast.success(\`Editing template \${t.name}\`)}>
                  <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(platform)/super-admin/announcements/page.tsx', `"use client";
import React, { useState } from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([
    { id: "anc-1", title: "Scheduled Maintenance Window", message: "ProWise will undergo scheduled API updates on Sunday, Nov 8 between 02:00 - 04:00 UTC.", active: true, date: "2026-11-04" },
    { id: "anc-2", title: "GitHub Webhook V2 Upgraded", message: "Repository sync throughput has been increased 5x with automated retries.", active: false, date: "2026-10-28" },
  ]);

  return (
    <PanelLayout title="Platform Announcements" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Announcements" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Broadcast Announcements</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Create top-bar banners and alerts shown across all tenant workspaces</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Creating new broadcast announcement...")}>
            <Plus className="w-4 h-4 mr-1.5" /> New Announcement
          </Button>
        </div>

        <div className="space-y-3">
          {announcements.map(a => (
            <Card key={a.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 mt-1">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{a.title}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">{a.message}</p>
                  <span className="text-[10px] text-[var(--color-text-muted)] mt-2 block">{a.date} • {a.active ? "Active" : "Archived"}</span>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => {
                setAnnouncements(announcements.filter(x => x.id !== a.id));
                toast.success("Announcement deleted");
              }}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(platform)/super-admin/integrations/page.tsx', `"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitBranch, CreditCard, Mail, Server, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminIntegrationsPage() {
  const integrations = [
    { name: "GitHub Cloud & Enterprise", icon: GitBranch, status: "OPERATIONAL", version: "v2.4", desc: "Automated commit, PR, and check-run event ingestion" },
    { name: "Stripe Billing Infrastructure", icon: CreditCard, status: "OPERATIONAL", version: "2026-10-15", desc: "SaaS subscriptions, dunning, and invoice generation" },
    { name: "SendGrid Transactional Mail", icon: Mail, status: "OPERATIONAL", version: "API v3", desc: "Multi-tenant email delivery and bounce tracking" },
    { name: "Datadog APM & Metrics", icon: Server, status: "OPERATIONAL", version: "Agent 7", desc: "Latency, distributed traces, and audit telemetry" },
  ];

  return (
    <PanelLayout title="Global Platform Integrations" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Integrations" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Platform-Level Service Providers</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Core external infrastructure powering auth, repository hooks, billing, and telemetry</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map(i => {
            const Icon = i.icon;
            return (
              <Card key={i.name} className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary-100 dark:bg-primary-950/60 text-primary-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">{i.name}</h4>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{i.version}</span>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> {i.status}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">{i.desc}</p>
                <div className="pt-2 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => toast.success("Configuration validated.")}>
                    Configure
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(platform)/super-admin/github-integrations/page.tsx', `"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitBranch, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminGitHubIntegrationsPage() {
  const installations = [
    { id: "gh-app-1", org: "Acme Health Technologies", account: "acme-health-org", repos: 14, rateLimit: "4,950 / 5,000", status: "HEALTHY" },
    { id: "gh-app-2", org: "Apex Global FinTech", account: "apex-fintech-systems", repos: 28, rateLimit: "4,820 / 5,000", status: "HEALTHY" },
    { id: "gh-app-3", org: "Nova Dynamics AI", account: "nova-ai-labs", repos: 6, rateLimit: "4,990 / 5,000", status: "HEALTHY" },
  ];

  return (
    <PanelLayout title="GitHub Integrations" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "GitHub" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">GitHub App Multi-Tenant Ingestion</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Monitor tenant GitHub App installations, repo webhooks, and rate limit budgets</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.success("Syncing GitHub App tokens...")}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Sync App State
          </Button>
        </div>

        <Card className="overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-sidebar)] border-b border-[var(--color-border)] text-[var(--color-text-secondary)] uppercase font-semibold">
              <tr>
                <th className="p-3">Tenant Organization</th>
                <th className="p-3">GitHub Organization Account</th>
                <th className="p-3">Connected Repos</th>
                <th className="p-3">API Rate Limit</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {installations.map(inst => (
                <tr key={inst.id} className="hover:bg-[var(--color-hover)]">
                  <td className="p-3 font-semibold">{inst.org}</td>
                  <td className="p-3 font-mono text-primary-600">{inst.account}</td>
                  <td className="p-3">{inst.repos} repositories</td>
                  <td className="p-3 font-mono">{inst.rateLimit}</td>
                  <td className="p-3">
                    <Badge variant="default" className="bg-green-600">{inst.status}</Badge>
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

writePage('src/app/(platform)/super-admin/webhooks/page.tsx', `"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Webhook, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SuperAdminWebhooksPage() {
  const webhooks = [
    { endpoint: "/api/webhooks/github", source: "GitHub", events: "push, pull_request, check_run", deliveries: "99.98%", status: "HEALTHY" },
    { endpoint: "/api/webhooks/stripe", source: "Stripe", events: "invoice.paid, payment_intent.succeeded", deliveries: "100%", status: "HEALTHY" },
    { endpoint: "/api/webhooks/sendgrid", source: "SendGrid", events: "delivered, bounce, spam_report", deliveries: "99.85%", status: "HEALTHY" },
  ];

  return (
    <PanelLayout title="Global Webhooks" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Webhooks" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Inbound Webhook Handlers</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Platform ingress pipelines and signature verification health</p>
        </div>

        <div className="space-y-3">
          {webhooks.map(w => (
            <Card key={w.endpoint} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-primary-600" />
                  <span className="font-mono text-xs font-bold">{w.endpoint}</span>
                  <Badge variant="outline">{w.source}</Badge>
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] font-mono">Listens for: {w.events}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-green-600">{w.deliveries} success</span>
                <Badge variant="default" className="bg-green-600">{w.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(platform)/super-admin/api-monitoring/page.tsx', `"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Activity, Server } from "lucide-react";

export default function SuperAdminApiMonitoringPage() {
  return (
    <PanelLayout title="API & Gateway Monitoring" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "API Monitoring" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">API Gateway & Request Latency</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Real-time edge performance metrics, latency distribution, and error rates</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Req / sec (RPS)</span>
            <div className="text-2xl font-bold mt-1 text-primary-600">842 req/s</div>
          </Card>
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">p99 Response Latency</span>
            <div className="text-2xl font-bold mt-1 text-green-600">42 ms</div>
          </Card>
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Error Rate (5xx)</span>
            <div className="text-2xl font-bold mt-1 text-green-600">0.002%</div>
          </Card>
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Active Connections</span>
            <div className="text-2xl font-bold mt-1 text-primary-600">1,208</div>
          </Card>
        </div>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(platform)/super-admin/access-approvals/page.tsx', `"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminAccessApprovalsPage() {
  return (
    <PanelLayout title="Access Approvals & Break-Glass" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Approvals" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Privileged Operator Approvals</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Strict dual-custody access grants for platform operators entering customer tenant data</p>
        </div>

        <Card className="p-5 border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Emergency Support Access Request</span>
              <h4 className="text-sm font-semibold">Operator: James Wilson (ID: op-jw)</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Target: Acme Health Technologies (org-1) • Reason: Support Ticket #TICK-1029 baseline sync deadlock investigation
              </p>
              <span className="text-[10px] text-[var(--color-text-muted)] block">Requested 12 minutes ago • Expires in 4 hours</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toast.error("Request rejected.")}>
                <X className="w-3.5 h-3.5 mr-1" /> Deny
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => toast.success("Access approved with audit recording active.")}>
                <Check className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(platform)/super-admin/reports/page.tsx', `"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminReportsPage() {
  return (
    <PanelLayout title="Platform Analytics & Executive Reports" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Reports" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Platform Business & Reliability Metrics</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Cross-tenant ARR, usage trends, and system SLA compliance</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.success("Exporting platform executive report...")}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export PDF
          </Button>
        </div>

        <Card className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)]">
          <h3 className="text-sm font-semibold mb-4">Monthly Recurring Revenue (MRR) Trajectory</h3>
          <RevenueChart height={280} />
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(platform)/super-admin/support/page.tsx', `"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LifeBuoy } from "lucide-react";

export default function SuperAdminSupportPage() {
  return (
    <PanelLayout title="Global Support Queue" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Support" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Enterprise Support Escalations</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Executive escalations, priority SLAs, and tenant inquiries</p>
        </div>

        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">All 8 open customer tickets are currently assigned to active platform operators with green SLA response status.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

console.log('Super Admin pages generated.');

