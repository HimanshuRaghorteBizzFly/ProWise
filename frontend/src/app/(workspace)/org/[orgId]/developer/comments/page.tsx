"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function DeveloperCommentsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Review Comments & Feedback" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Comments" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Discussion & Feedback</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Reviewer change requests and peer discussion</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">No new review feedback threads.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
