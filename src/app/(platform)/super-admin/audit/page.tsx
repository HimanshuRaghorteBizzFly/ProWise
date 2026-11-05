"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/store/project-store";
import { Activity } from "lucide-react";

export default function SuperAdminAuditPage() {
  const { auditLogs } = useProjectStore();

  return (
    <PanelLayout
      title="Platform Immutable Audit Ledger"
      breadcrumb={[
        { label: "Super Admin", href: "/super-admin" },
        { label: "Audit Logs" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Master Audit Stream</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Module M12: Cryptographically verifiable record of administrative, delivery, and security transactions.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-app-text-muted whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-xs font-semibold">{log.actorEmail}</TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{log.actorRole}</TableCell>
                  <TableCell className="text-xs text-app-text-primary">{log.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PanelLayout>
  );
}

