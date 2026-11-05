"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function StructuredBlockersPage() {
  return (
    <PanelLayout title="Task Blockers" breadcrumb={[{ label: "Developer", href: "#" }, { label: "Blockers" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Active work item blockers impeding delivery flow.</p>
      </Card>
    </PanelLayout>
  );
}
