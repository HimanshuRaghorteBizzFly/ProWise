"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { WorkItemReview } from "@/types";

export default function ManagerReviewsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { reviews } = useProjects(orgId);

  return (
    <PanelLayout title="Review Oversight" breadcrumb={[{ label: "Manager", href: `/org/${orgId}/manager` }, { label: "Reviews" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">QA & Lead Review Oversight</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Tracking revision approvals and rejection justifications</p>
        </div>
        <div className="space-y-3">
          {reviews.map((r: WorkItemReview) => (

            <Card key={r.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold">Review ID: {r.id} (rev {r.submittedRevision})</span>
                <span className={r.decision === "APPROVED" ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>{r.decision}</span>
              </div>
              {r.feedbackReason && (
                <p className="text-xs text-[var(--color-text-secondary)] bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                  Feedback: {r.feedbackReason}
                </p>
              )}
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
