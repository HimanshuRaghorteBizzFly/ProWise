"use client";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function OwnerSettingsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const [transferEmail, setTransferEmail] = useState("");

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferEmail) return;
    toast.error("Ownership transfer requires second owner verification or Platform Operator sign-off (Blueprint Rule).");
  };

  return (
    <PanelLayout title="Organization Settings & Danger Zone" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Settings" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Ownership Governance & Danger Zone</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Transfer tenant ownership, manage archive policies, and data export</p>
        </div>

        <Card className="p-6 border border-red-200 dark:border-red-900 bg-red-50/20 dark:bg-red-950/20 space-y-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold text-sm">Transfer Organization Ownership</h3>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Transfers complete operational and billing responsibility to another user. Cannot be undone without consent.
          </p>
          <form onSubmit={handleTransfer} className="flex gap-2">
            <Input
              type="email"
              value={transferEmail}
              onChange={e => setTransferEmail(e.target.value)}
              placeholder="new.owner@example.com"
              className="max-w-xs"
              required
            />
            <Button variant="danger" type="submit">Transfer Ownership</Button>

          </form>
        </Card>
      </div>
    </PanelLayout>
  );
}
