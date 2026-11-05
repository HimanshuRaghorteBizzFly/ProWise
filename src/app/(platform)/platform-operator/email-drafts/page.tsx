"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function OperatorEmailDraftsPage() {
  return (
    <PanelLayout title="Email Drafts" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Drafts" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Draft Communications</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Prepared broadcast notices pending Super Admin sign-off</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">No pending communication drafts.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
