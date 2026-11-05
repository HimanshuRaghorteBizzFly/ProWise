"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function IndividualDeliveryStatusPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { projects, requestDeliveryReview } = useProjects(orgId);
  const project = projects.find(p => p.id === projectId);

  return (
    <PanelLayout title="Delivery Acceptance Status" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: project?.name || "Project", href: `/org/${orgId}/developer/projects/${projectId}/individual` }, { label: "Delivery" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Delivery Review Workflow</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Request formal customer / QA acceptance review once 100% progress is recorded</p>
        </div>
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
          <div className="text-xs">Current Progress: <strong>{project?.lastProgressPercent}%</strong></div>
          {project?.deliveryReviewRequested ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded text-xs font-semibold">
              Delivery acceptance review has been requested. Pending Project Manager / QA sign-off.
            </div>
          ) : (
            <Button
              disabled={project?.lastProgressPercent !== 100}
              onClick={() => {
                requestDeliveryReview(projectId, "usr-dev");
                toast.success("Delivery acceptance review requested!");
              }}
            >
              Request Delivery Acceptance Review
            </Button>
          )}
        </Card>
      </div>
    </PanelLayout>
  );
}
