"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminInvoicesPage() {
  const invoices = [
    { number: "INV-2026-089", org: "Acme Health Technologies", amount: "$59,988.00", date: "2026-11-01", status: "Paid" },
    { number: "INV-2026-088", org: "Nova FinTech Global", amount: "$1,299.00", date: "2026-11-01", status: "Paid" },
    { number: "INV-2026-087", org: "Starlight Dynamics", amount: "$499.00", date: "2026-10-15", status: "Past Due" },
  ];

  return (
    <PanelLayout
      title="Payments &amp; Commercial Invoices"
      breadcrumb={[
        { label: "Super Admin", href: "/super-admin" },
        { label: "Invoices" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Invoices Ledger</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Platform billing receipts and payment reconciliation.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Issued Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.number}>
                  <TableCell className="font-mono font-bold text-xs text-blue-600">{inv.number}</TableCell>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{inv.org}</TableCell>
                  <TableCell className="font-bold text-xs">{inv.amount}</TableCell>
                  <TableCell className="text-xs text-app-text-muted">{inv.date}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "Paid" ? "success" : "danger"}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.success(`Receipt for ${inv.number} downloaded`)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PanelLayout>
  );
}

