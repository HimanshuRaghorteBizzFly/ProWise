"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

export default function OwnerTeamsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  const teams = [
    { name: "Frontend Core", lead: "Alice Johnson", members: 6, projects: 3 },
    { name: "Backend Platforms", lead: "Michael Chang", members: 8, projects: 4 },
    { name: "Mobile & SDKs", lead: "Sarah Connor", members: 4, projects: 2 },
  ];

  return (
    <PanelLayout title="Teams" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Teams" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Organizational Teams</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Cross-functional engineering pods and delivery units</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Create team dialog...")}>
            <Plus className="w-4 h-4 mr-1.5" /> New Team
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {teams.map(t => (
            <Card key={t.name} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-600" />
                <h4 className="font-semibold text-sm">{t.name}</h4>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">Lead: {t.lead}</p>
              <div className="text-[11px] text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border)] flex justify-between">
                <span>{t.members} members</span>
                <span>{t.projects} projects</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
