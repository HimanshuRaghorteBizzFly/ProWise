"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEEDED_USERS } from "@/lib/mock-data";
import { Users, ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminOperatorsPage() {
  const operators = [
    { name: "DevOps Jordan", email: "operator@prowise.io", role: "Platform Operator", status: "Active", onCall: true },
    { name: "Arthur Pendelton", email: "superadmin@prowise.io", role: "Super Admin", status: "Active", onCall: false },
    { name: "SRE Morgan", email: "sre.morgan@prowise.io", role: "Site Reliability Operator", status: "Standby", onCall: true },
  ];

  return (
    <PanelLayout
      title="Platform Operators &amp; SRE Roster"
      breadcrumb={[
        { label: "Super Admin", href: "/super-admin" },
        { label: "Platform Operators" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Operational Personnel</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Engineers authorized to manage background queues, webhook deliveries, and tenant support incidents.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operator</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Privileged Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>On-Call</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operators.map((op, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{op.name}</TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{op.email}</TableCell>
                  <TableCell>
                    <Badge variant="default">{op.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="success">{op.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {op.onCall ? (
                      <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                        ● Primary On-Call
                      </span>
                    ) : (
                      <span className="text-xs text-app-text-muted">Off-Duty</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info(`Reviewing audit logs for ${op.email}`)}
                    >
                      Audit Activity
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

