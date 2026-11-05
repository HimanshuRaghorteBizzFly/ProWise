"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Check } from "lucide-react";
import { toast } from "sonner";

export default function OwnerSubscriptionsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Subscription & Plan" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Subscriptions" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">ProWise SaaS Subscription</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Manage tier, seat licensing, and invoice billing cycle</p>
        </div>

        <Card className="p-6 border border-primary-200 dark:border-primary-900 bg-primary-50/30 dark:bg-primary-950/20 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <Badge variant="default">CURRENT PLAN</Badge>
              <h3 className="text-2xl font-bold mt-1">Enterprise Tier</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">Unlimited projects, custom grace period calendars, GitHub multi-repo sync</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black">$499</span>
              <span className="text-xs text-[var(--color-text-secondary)]"> / month</span>
            </div>
          </div>
          <div className="pt-4 border-t border-primary-200 dark:border-primary-900 flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={() => toast.info("Opening plan changer...")}>Change Plan</Button>
            <Button size="sm" onClick={() => toast.success("Opening Stripe Customer Portal...")}>Manage Billing in Stripe</Button>
          </div>
        </Card>
      </div>
    </PanelLayout>
  );
}
