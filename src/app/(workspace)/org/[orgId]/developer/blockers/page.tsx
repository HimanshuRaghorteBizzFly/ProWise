"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function DeveloperBlockersPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="My Blockers" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Blockers" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Active Delivery Impediments</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Reported blockers automatically escalate project health to AT_RISK or DELAYED</p>
        </div>
        <Card className="p-5 border border-red-200 dark:border-red-900 bg-red-50/20 dark:bg-red-950/20 space-y-2">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <h4 className="font-semibold text-xs">CRM-101: Third-party SSO certificate pending corporate renewal</h4>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">Assigned to DevOps escalation queue • Severity: HIGH</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
