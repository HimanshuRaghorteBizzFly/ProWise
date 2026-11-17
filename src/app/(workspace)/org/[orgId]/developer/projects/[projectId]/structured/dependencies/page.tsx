"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function StructuredDependenciesPage() {
  return (
    <PanelLayout title="Task Dependencies" breadcrumb={[{ label: "Developer", href: "#" }, { label: "Dependencies" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Finish-to-Start dependencies blocking tasks from entering IN_PROGRESS.</p>
      </Card>
    </PanelLayout>
  );
}
