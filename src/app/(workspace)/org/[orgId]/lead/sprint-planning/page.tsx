"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function LeadSprintPlanningPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Sprint Planning" breadcrumb={[{ label: "Team Lead", href: `/org/${orgId}/lead` }, { label: "Sprint Planning" }]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Sprint Iterations</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Manage 2-week delivery cycles and leaf task commitments</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Create iteration...")}>
            <Plus className="w-4 h-4 mr-1.5" /> New Sprint
          </Button>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">Current Sprint: Sprint 14 (Nov 1 - Nov 14) • 82% commitment on track</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
