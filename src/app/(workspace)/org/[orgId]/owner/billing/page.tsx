"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function OwnerBillingPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Billing & Invoices" breadcrumb={[{ label: "Owner", href: `/org/${orgId}/owner` }, { label: "Billing" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Invoices & Receipts</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Download past billing statements and tax receipts</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center">
          <div>
            <h4 className="text-sm font-semibold">Invoice #INV-2026-11</h4>
            <span className="text-xs text-[var(--color-text-secondary)]">Nov 1, 2026 • $499.00 • Paid via Stripe •••• 4242</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.success("Downloading PDF...")}>
            <Download className="w-3.5 h-3.5 mr-1" /> PDF
          </Button>
        </Card>
      </div>
    </PanelLayout>
  );
}
