"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Plus } from "lucide-react";
import { toast } from "sonner";

export default function OperatorAccessRequestsPage() {
  return (
    <PanelLayout title="Tenant Access Requests" breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Access Requests" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Scoped Tenant Debug Requests</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Submit temporary break-glass access requests with mandatory ticket justification</p>
          </div>
          <Button size="sm" onClick={() => toast.success("Drafting tenant debug request...")}>
            <Plus className="w-4 h-4 mr-1.5" /> Request Access
          </Button>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">All previous break-glass sessions have expired. No active elevated sessions present.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
