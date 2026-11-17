"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";
import { toast } from "sonner";

export default function ManagerProjectPlanningPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Project Planning & Roadmaps" breadcrumb={[{ label: "Manager", href: `/org/${orgId}/manager` }, { label: "Planning" }]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Release & Milestone Planning</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Schedule delivery targets, grace working day buffers, and reporting cadences</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Opening planning wizard...")}>
            <Plus className="w-4 h-4 mr-1.5" /> Plan Milestone
          </Button>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">All active projects have defined targets and reporting cadences.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
