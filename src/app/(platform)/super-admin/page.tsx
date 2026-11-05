"use client";

import React, { useState } from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Users,
  CreditCard,
  DollarSign,
  AlertTriangle,
  Activity,
  ShieldCheck,
  Server,
  Plus,
  Search,
  ExternalLink,
  LifeBuoy,
} from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { SEEDED_ORGS, SEEDED_USERS } from "@/lib/mock-data";
import { toast } from "sonner";

export default function SuperAdminDashboard() {
  const { incidents, supportTickets, auditLogs } = useProjectStore();
  const [orgsList, setOrgsList] = useState(SEEDED_ORGS);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgPlan, setNewOrgPlan] = useState<"STARTER" | "PROFESSIONAL" | "ENTERPRISE">("PROFESSIONAL");

  const filteredOrgs = orgsList.filter(
    (o) =>
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    const newOrg = {
      id: `org-${newOrgSlug}`,
      slug: newOrgSlug,
      name: newOrgName,
      ownerId: "usr-owner",
      timezone: "America/New_York",
      workCalendar: {
        workDays: [1, 2, 3, 4, 5],
        dailyHours: 8,
        holidays: [],
      },
      plan: newOrgPlan,
      status: "ACTIVE" as const,
      createdAt: new Date().toISOString(),
    };
    setOrgsList([newOrg, ...orgsList]);
    setIsCreateOrgOpen(false);
    setNewOrgName("");
    setNewOrgSlug("");
    toast.success(`Organization ${newOrgName} created successfully`);
  };

  return (
    <PanelLayout
      title="Platform Super Admin"
      breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Overview" }]}
    >
      <div className="space-y-6">
        {/* Governance banner */}
        <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <span className="font-bold">Super Admin Governance Scope:</span> Multi-tenant billing, platform security controls, organization lifecycle, and audit integrity.
              Tenant private code &amp; proprietary delivery data remain strictly isolated.
            </div>
          </div>
          <Button size="sm" onClick={() => setIsCreateOrgOpen(true)} className="shrink-0">
            <Plus className="w-3.5 h-3.5 mr-1" /> Provision Org
          </Button>
        </div>

        {/* 10 Core Super Admin KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Total Orgs</span>
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">{orgsList.length + 140}</div>
            <div className="text-[10px] text-green-600 font-medium mt-0.5">138 Active</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Platform Users</span>
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">1,842</div>
            <div className="text-[10px] text-app-text-muted mt-0.5">+48 this month</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Active Subscriptions</span>
              <CreditCard className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">128</div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">92% Enterprise</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Monthly Revenue</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">$148.2k</div>
            <div className="text-[10px] text-green-600 font-medium mt-0.5">+14% QoQ</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Incidents</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">
              {incidents.filter((i) => i.status !== "RESOLVED").length}
            </div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">1 Investigating</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Payment Failures</span>
              <CreditCard className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">2</div>
            <div className="text-[10px] text-rose-500 font-medium mt-0.5">Dunning active</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Service Health</span>
              <Server className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">99.98%</div>
            <div className="text-[10px] text-green-600 font-medium mt-0.5">All systems normal</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Support Tickets</span>
              <LifeBuoy className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">
              {supportTickets.filter((t) => t.status !== "RESOLVED").length}
            </div>
            <div className="text-[10px] text-blue-600 font-medium mt-0.5">SLA: 12 min</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Webhook Delivery</span>
              <Activity className="w-4 h-4 text-violet-600" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">99.4%</div>
            <div className="text-[10px] text-app-text-muted mt-0.5">p95 &lt; 420ms</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Active Operators</span>
              <Users className="w-4 h-4 text-slate-600" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">6</div>
            <div className="text-[10px] text-app-text-muted mt-0.5">2 on-call</div>
          </Card>
        </div>

        {/* Organizations Table */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Tenant Organizations</CardTitle>
              <CardDescription>
                Supervise tenant workspaces, commercial plans, and account statuses.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-app-text-muted" />
                <input
                  type="text"
                  placeholder="Filter organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-app-bg border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-semibold">{org.name}</TableCell>
                  <TableCell className="font-mono text-xs text-app-text-muted">{org.slug}</TableCell>
                  <TableCell>
                    <Badge variant={org.plan === "ENTERPRISE" ? "default" : "secondary"}>
                      {org.plan}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{org.timezone}</TableCell>
                  <TableCell>
                    <Badge variant={org.status === "ACTIVE" ? "success" : "warning"}>
                      {org.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-app-text-muted">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info(`Viewing governance details for ${org.name}`)}
                    >
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Incidents & Support Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Platform Incidents */}
          <Card className="p-5">
            <CardHeader className="pb-3 px-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Platform Incident Stream</CardTitle>
                <Badge variant="warning">1 Active</Badge>
              </div>
            </CardHeader>
            <div className="space-y-3">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-3 rounded-lg border border-app-border bg-app-sidebar/50 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-app-text-primary">{inc.title}</span>
                    <Badge variant={inc.status === "RESOLVED" ? "success" : "warning"}>
                      {inc.status}
                    </Badge>
                  </div>
                  <p className="text-app-text-secondary">{inc.summary}</p>
                  <div className="text-[10px] text-app-text-muted pt-1">
                    Affected: {inc.affectedServices.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Super Admin Audit Logs */}
          <Card className="p-5">
            <CardHeader className="pb-3 px-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Security &amp; Administrative Audit</CardTitle>
                <span className="text-[10px] text-app-text-muted">Immutable Ledger</span>
              </div>
            </CardHeader>
            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg border border-app-border text-xs flex items-start justify-between"
                >
                  <div>
                    <div className="font-semibold text-app-text-primary">{log.action}</div>
                    <div className="text-app-text-secondary text-[11px] mt-0.5">{log.details}</div>
                    <div className="text-[10px] text-app-text-muted mt-1">
                      By {log.actorEmail} ({log.actorRole})
                    </div>
                  </div>
                  <span className="text-[10px] text-app-text-muted shrink-0 ml-2">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Provision Org Dialog */}
      <Dialog
        isOpen={isCreateOrgOpen}
        onClose={() => setIsCreateOrgOpen(false)}
        title="Provision New Tenant Organization"
        description="Creates an isolated tenant boundary with its own work calendar and encryption context."
      >
        <form onSubmit={handleCreateOrg} className="space-y-4 pt-2">
          <Input
            label="Organization Name"
            value={newOrgName}
            onChange={(e) => {
              setNewOrgName(e.target.value);
              setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
            }}
            placeholder="e.g. Apex BioTech Systems"
            required
          />

          <Input
            label="Organization Slug (Tenant Key)"
            value={newOrgSlug}
            onChange={(e) => setNewOrgSlug(e.target.value)}
            placeholder="e.g. apex-biotech"
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-app-text-secondary">
              Commercial Subscription Tier
            </label>
            <select
              value={newOrgPlan}
              onChange={(e) => setNewOrgPlan(e.target.value as any)}
              className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="STARTER">Starter ($499/mo)</option>
              <option value="PROFESSIONAL">Professional ($1,299/mo)</option>
              <option value="ENTERPRISE">Enterprise Custom ($4,999/mo)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsCreateOrgOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Provision Organization</Button>
          </div>
        </form>
      </Dialog>
    </PanelLayout>
  );
}

