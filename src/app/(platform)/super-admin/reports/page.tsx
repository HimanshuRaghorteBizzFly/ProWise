"use client";
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
