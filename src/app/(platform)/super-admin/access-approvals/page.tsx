"use client";
import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminAccessApprovalsPage() {
  return (
    <PanelLayout title="Access Approvals & Break-Glass" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Approvals" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Privileged Operator Approvals</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Strict dual-custody access grants for platform operators entering customer tenant data</p>
        </div>

        <Card className="p-5 border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Emergency Support Access Request</span>
              <h4 className="text-sm font-semibold">Operator: James Wilson (ID: op-jw)</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Target: Acme Health Technologies (org-1) • Reason: Support Ticket #TICK-1029 baseline sync deadlock investigation
              </p>
              <span className="text-[10px] text-[var(--color-text-muted)] block">Requested 12 minutes ago • Expires in 4 hours</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toast.error("Request rejected.")}>
                <X className="w-3.5 h-3.5 mr-1" /> Deny
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => toast.success("Access approved with audit recording active.")}>
                <Check className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </PanelLayout>
  );
}
