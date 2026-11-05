"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function LeadDependenciesPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { workItems } = useProjectStore();

  const dependencies = [
    { from: "CRM-101 (Design)", to: "CRM-102 (API Core)", status: "Completed" },
    { from: "CRM-102 (API Core)", to: "CRM-103 (Release & Security)", status: "In Progress" },
  ];

  return (
    <PanelLayout
      title="Finish-to-Start Dependencies"
      breadcrumb={[
        { label: "Team Lead", href: `/org/${orgId}/lead` },
        { label: "Dependencies" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Dependency DAG Graph</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Blueprint Rule M07: Finish-to-Start only inside project. Rejects cycles, self-links, and loops. Moving a predecessor never silently moves dates.
          </p>
        </div>

        <div className="space-y-3">
          {dependencies.map((dep, idx) => (
            <Card key={idx} className="p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-1 rounded">
                  {dep.from}
                </span>
                <ArrowRight className="w-4 h-4 text-app-text-muted" />
                <span className="font-mono font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-1 rounded">
                  {dep.to}
                </span>
              </div>
              <Badge variant={dep.status === "Completed" ? "success" : "warning"}>
                {dep.status}
              </Badge>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}

