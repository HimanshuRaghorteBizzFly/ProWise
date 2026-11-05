"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, DollarSign } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminSubscriptionsPage() {
  const subs = [
    { org: "Acme Health Technologies", plan: "Enterprise", mrr: "$4,999", billingCycle: "Annual", status: "Active", renews: "Nov 2027" },
    { org: "Nova FinTech Global", plan: "Professional", mrr: "$1,299", billingCycle: "Monthly", status: "Active", renews: "Dec 2026" },
    { org: "Starlight Dynamics", plan: "Starter", mrr: "$499", billingCycle: "Monthly", status: "Past Due", renews: "Nov 2026" },
  ];

  return (
    <PanelLayout
      title="Platform Subscriptions"
      breadcrumb={[
        { label: "Super Admin", href: "/super-admin" },
        { label: "Subscriptions" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Commercial Subscriptions</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Active recurring SaaS contracts and dunning statuses across tenant organizations.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant Organization</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>MRR</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next Renewal</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((s, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{s.org}</TableCell>
                  <TableCell>
                    <Badge variant={s.plan === "Enterprise" ? "default" : "secondary"}>
                      {s.plan}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-xs">{s.mrr}</TableCell>
                  <TableCell className="text-xs text-app-text-muted">{s.billingCycle}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "Active" ? "success" : "danger"}>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{s.renews}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info(`Managing subscription for ${s.org}`)}
                    >
                      Manage
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

