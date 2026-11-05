"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function ReviewerAssignedReviewsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { workItems } = useProjects(orgId);
  const inReview = workItems.filter(w => w.state === "IN_REVIEW");

  return (
    <PanelLayout title="Assigned Reviews" breadcrumb={[{ label: "QA Reviewer", href: `/org/${orgId}/reviewer` }, { label: "Assigned" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Assigned Review Items</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Work items and deliverables awaiting QA / peer review verification</p>
        </div>
        <div className="space-y-2">
          {inReview.map(w => (
            <Card key={w.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center text-xs">
              <span className="font-semibold">{w.key}: {w.title}</span>
              <span className="text-amber-600 font-bold">rev {w.currentRevision} (IN_REVIEW)</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
