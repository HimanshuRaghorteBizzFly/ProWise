"use client";
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
