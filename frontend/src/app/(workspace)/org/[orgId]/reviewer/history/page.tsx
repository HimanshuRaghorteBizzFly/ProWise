"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { Clock } from "lucide-react";

export default function ReviewerHistoryPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { auditLogs } = useProjectStore();

  const reviews = auditLogs.filter((l) => l.action.includes("WORK_ITEM") || l.action.includes("APPROVED"));

  return (
    <PanelLayout
      title="Review History Ledger"
      breadcrumb={[
        { label: "Reviewer", href: `/org/${orgId}/reviewer` },
        { label: "History" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Historical Inspection Decisions</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Immutable log of all approvals, rework requests, and criteria checks.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Reviewer</TableHead>
                <TableHead>Target Entity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((rev) => (
                <TableRow key={rev.id}>
                  <TableCell className="text-xs text-app-text-muted">
                    {new Date(rev.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{rev.action}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-app-text-primary font-medium">
                    {rev.details}
                  </TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{rev.actorEmail}</TableCell>
                  <TableCell className="font-mono text-xs text-app-text-muted">{rev.targetId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PanelLayout>
  );
}

