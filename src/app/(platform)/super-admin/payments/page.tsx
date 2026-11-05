"use client";
import React, { useState } from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, DollarSign, Download, Filter } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminPaymentsPage() {
  const [payments] = useState([
    { id: "tx-901", org: "Acme Health Technologies", amount: "$5,400.00", status: "SUCCEEDED", date: "2026-11-01", method: "Stripe •••• 4242" },
    { id: "tx-902", org: "Apex Global FinTech", amount: "$12,000.00", status: "SUCCEEDED", date: "2026-11-02", method: "Wire Transfer" },
    { id: "tx-903", org: "Nova Dynamics AI", amount: "$890.00", status: "FAILED", date: "2026-11-03", method: "Stripe •••• 9812" },
  ]);

  return (
    <PanelLayout title="Payments & Transactions" breadcrumb={[{ label: "Super Admin", href: "/super-admin" }, { label: "Payments" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Platform Transactions</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Live processing log across all connected Stripe & ACH accounts</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.success("Exporting transactions CSV...")}>
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Monthly Volume</span>
            <div className="text-2xl font-bold text-green-600 mt-1">$74,290.00</div>
          </Card>
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Successful Transactions</span>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">142</div>
          </Card>
          <Card className="p-4 bg-[var(--color-surface)]">
            <span className="text-xs text-[var(--color-text-secondary)]">Dispute / Failure Rate</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">0.7%</div>
          </Card>
        </div>

        <Card className="overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-sidebar)] border-b border-[var(--color-border)] text-[var(--color-text-secondary)] uppercase font-semibold">
              <tr>
                <th className="p-3">Transaction ID</th>
                <th className="p-3">Organization</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Payment Method</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-[var(--color-hover)]">
                  <td className="p-3 font-mono font-semibold">{p.id}</td>
                  <td className="p-3 font-medium">{p.org}</td>
                  <td className="p-3 font-bold">{p.amount}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{p.method}</td>
                  <td className="p-3">
                    <Badge variant={p.status === "SUCCEEDED" ? "default" : "danger"}>{p.status}</Badge>

                  </td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{p.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </PanelLayout>
  );
}
