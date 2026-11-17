"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function StructuredReviewFeedbackPage() {
  return (
    <PanelLayout title="Review Feedback" breadcrumb={[{ label: "Developer", href: "#" }, { label: "Feedback" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Reviewer comments and inspection checklists for structured work items.</p>
      </Card>
    </PanelLayout>
  );
}
