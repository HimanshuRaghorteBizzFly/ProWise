"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Plus } from "lucide-react";
import { toast } from "sonner";

export default function OwnerInvitationsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Invitations" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Invitations" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Pending Invitations</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Manage outstanding invitation links and expiry</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Send invitation...")}>
            <Plus className="w-4 h-4 mr-1.5" /> Send Invite
          </Button>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">No pending invitations. All invited members have joined.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
