"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { ROLE_PERMISSIONS } from "@/config/permissions";
import { Shield } from "lucide-react";

export default function OwnerRolesPermissionsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Roles & Permissions Matrix" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Roles" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Tenant Role Capabilities</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">V1.1 Role boundaries and permission grants</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(ROLE_PERMISSIONS).map(([role, actions]) => (
            <Card key={role} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary-600" />
                <h4 className="font-semibold text-xs font-mono">{role}</h4>
              </div>
              <div className="flex flex-wrap gap-1">
                {actions.map(act => (
                  <span key={act} className="text-[10px] font-mono bg-[var(--color-sidebar)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
                    {act}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
