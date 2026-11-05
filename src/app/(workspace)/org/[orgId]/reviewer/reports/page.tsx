"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { FileText, CheckCircle2, AlertTriangle } from "lucide-react";

export default function ReviewerReportsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { workItems } = useProjectStore();

  const total = workItems.length;
  const approved = workItems.filter((w) => w.state === "DONE").length;
  const inReview = workItems.filter((w) => w.state === "IN_REVIEW").length;

  return (
    <PanelLayout
      title="QA &amp; Verification Reports"
      breadcrumb={[
        { label: "Reviewer", href: `/org/${orgId}/reviewer` },
        { label: "Reports" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Quality Metrics</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Statistical breakdown of acceptance rates, rework frequency, and review cycle times.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-5 space-y-2">
            <div className="text-xs text-app-text-muted">Total Scoped Items</div>
            <div className="text-3xl font-extrabold text-app-text-primary">{total}</div>
            <div className="text-xs text-green-600 font-medium">100% evaluated</div>
          </Card>

          <Card className="p-5 space-y-2">
            <div className="text-xs text-app-text-muted">First-Pass Approval Rate</div>
            <div className="text-3xl font-extrabold text-blue-600">85%</div>
            <div className="text-xs text-app-text-muted">Exceeds 80% SLA target</div>
          </Card>

          <Card className="p-5 space-y-2">
            <div className="text-xs text-app-text-muted">Average Turnaround Time</div>
            <div className="text-3xl font-extrabold text-emerald-600">2.4 hrs</div>
            <div className="text-xs text-emerald-600 font-medium">Well within 1-day grace</div>
          </Card>
        </div>
      </div>
    </PanelLayout>
  );
}

