"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { CheckSquare, ArrowRight } from "lucide-react";

export default function DeveloperMyWorkPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { workItems } = useProjectStore();

  const myItems = workItems.filter((w) => w.primaryAssigneeId === "usr-developer");

  return (
    <PanelLayout
      title="My Assigned Work Items"
      breadcrumb={[
        { label: "Developer", href: `/org/${orgId}/developer` },
        { label: "My Work" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Personal Delivery Queue</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Active structured tasks and solo ownership responsibilities assigned to you.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Workflow State</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Current Revision</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-bold text-xs text-blue-600">
                    {item.key}
                  </TableCell>
                  <TableCell className="font-semibold text-xs text-app-text-primary">
                    {item.title}
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
                  <TableCell className="text-xs font-semibold">{item.weight} pts</TableCell>
                  <TableCell className="font-mono text-xs text-app-text-muted">
                    rev {item.currentRevision}
                  </TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{item.dueDate || "N/A"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(`/org/${orgId}/developer/projects/proj-structured-cds/structured`)
                      }
                    >
                      Open on Board
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

