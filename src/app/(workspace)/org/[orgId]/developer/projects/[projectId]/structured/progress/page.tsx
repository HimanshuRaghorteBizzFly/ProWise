"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function StructuredBaselineProgressPage() {
  return (
    <PanelLayout title="Baseline Leaf Progress" breadcrumb={[{ label: "Developer", href: "#" }, { label: "Progress" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Sum(Done Leaf Weights) / Total Approved Baseline Weights formula progress.</p>
      </Card>
    </PanelLayout>
  );
}
