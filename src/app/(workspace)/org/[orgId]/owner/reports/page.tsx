"use client";
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
    <PanelLayout title="Executive Reports" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Reports" }]}>
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
