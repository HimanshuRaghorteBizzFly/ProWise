"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export default function ReviewerChecklistsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();

  const standards = [
    { title: "Standard Code Review Checklist", items: ["Unit tests passed with >=80% coverage", "No hardcoded credentials or secrets", "Code style and formatting compliance"] },
    { title: "Clinical Security & OWASP ASVS Gate", items: ["Input validation on all patient FHIR endpoints", "Formula injection defense on CSV export handlers", "Role-based authorization re-check on object IDs"] },
    { title: "Production Canary Release Gate", items: ["Canary deployment latency within p95 SLA", "Zero active Sev-1 / Sev-2 defect tickets", "Signed approval from QA and Architecture Lead"] },
  ];

  return (
    <PanelLayout
      title="Test Checklists &amp; Standards"
      breadcrumb={[
        { label: "Reviewer", href: `/org/${orgId}/reviewer` },
        { label: "Checklists" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Verification Standards Library</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Governing rules and criteria applied to every revision inspection.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {standards.map((s, idx) => (
            <Card key={idx} className="p-5 space-y-3">
              <CardTitle className="text-sm font-bold">{s.title}</CardTitle>
              <div className="space-y-2 pt-2">
                {s.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-app-text-secondary">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}

