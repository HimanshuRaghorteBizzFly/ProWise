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
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

export default function LeadWorkItemsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { workItems, reopenWorkItem } = useProjectStore();

  return (
    <PanelLayout
      title="Squad Work Items"
      breadcrumb={[
        { label: "Team Lead", href: `/org/${orgId}/lead` },
        { label: "Work Items" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Squad Work Items &amp; Hierarchy</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Module M04: Manage priorities, reassignments, and state transitions.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Revision</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-bold text-xs text-blue-600">{item.key}</TableCell>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{item.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.state === "DONE"
                          ? "success"
                          : item.state === "IN_REVIEW"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {item.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-xs">{item.weight} pts</TableCell>
                  <TableCell className="font-mono text-xs text-app-text-muted">rev {item.currentRevision}</TableCell>
                  <TableCell className="text-right">
                    {item.state === "DONE" && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          reopenWorkItem(item.id, "Lead inspection found regression", "usr-lead");
                          toast.warning(`Reopened ${item.key}. Completion credit revoked.`);
                        }}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" /> Reopen
                      </Button>
                    )}
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

