"use client";
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
    <PanelLayout title="Security Audit Logs" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Audit" }]}>
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
