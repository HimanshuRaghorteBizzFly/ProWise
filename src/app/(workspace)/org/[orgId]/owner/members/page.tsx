"use client";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEEDED_USERS } from "@/lib/mock-data";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function OwnerMembersPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const [members] = useState(SEEDED_USERS);

  return (
    <PanelLayout title="Members & Roles" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Members" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Team Roster</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Manage user seats, role grants, and access permissions</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Opening invite dialog...")}>
            <UserPlus className="w-4 h-4 mr-1.5" /> Invite Member
          </Button>
        </div>

        <Card className="overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-sidebar)] border-b border-[var(--color-border)] text-[var(--color-text-secondary)] uppercase font-semibold">
              <tr>
                <th className="p-3">Member</th>
                <th className="p-3">Role</th>
                <th className="p-3">Timezone</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-[var(--color-hover)]">
                  <td className="p-3">
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-[11px] text-[var(--color-text-secondary)]">{m.email}</div>
                  </td>
                  <td className="p-3 font-mono">{m.role}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{m.timezone}</td>
                  <td className="p-3">
                    <Badge variant="default" className="bg-green-600">Active</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </PanelLayout>
  );
}
