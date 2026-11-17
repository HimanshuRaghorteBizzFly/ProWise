"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { toast } from "sonner";

export default function LeadBlockersPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { workItems, resolveBlocker } = useProjectStore();

  const blockers = workItems.flatMap((w) =>
    (w.blockers || []).map((b) => ({ ...b, taskKey: w.key, taskTitle: w.title, workItemId: w.id }))
  );

  return (
    <PanelLayout
      title="Squad Blocker Ledger"
      breadcrumb={[
        { label: "Team Lead", href: `/org/${orgId}/lead` },
        { label: "Blockers" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Impediments &amp; Blockers</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Blueprint Rule FR-021: Blocked is an explicit condition with owner and reason, not a replacement for task workflow state.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Blocker Description</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Logged Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockers.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono font-bold text-xs text-blue-600">
                    {b.taskKey}
                  </TableCell>
                  <TableCell className="text-xs text-app-text-primary">{b.reason}</TableCell>
                  <TableCell>
                    <Badge variant={b.severity === "CRITICAL" ? "danger" : "warning"}>
                      {b.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.resolvedAt ? "success" : "danger"}>
                      {b.resolvedAt ? "Resolved" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-app-text-muted">
                    {new Date(b.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {!b.resolvedAt && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          resolveBlocker(b.workItemId, b.id);
                          toast.success("Blocker resolved.");
                        }}
                      >
                        Resolve
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {blockers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-app-text-muted">
                    No active blockers recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PanelLayout>
  );
}

