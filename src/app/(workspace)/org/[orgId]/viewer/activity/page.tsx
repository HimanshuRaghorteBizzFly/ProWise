"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";

export default function ViewerActivityPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { gitEvents } = useProjectStore();

  return (
    <PanelLayout
      title="Recent Delivery Activity"
      breadcrumb={[
        { label: "Viewer", href: `/org/${orgId}/viewer` },
        { label: "Activity" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Verified Engineering Stream</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Audit-backed events from connected repositories and CI/CD automation.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Repository</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gitEvents.map((evt) => (
                <TableRow key={evt.id}>
                  <TableCell>
                    <Badge variant="default">{evt.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-app-text-muted">{evt.repoName}</TableCell>
                  <TableCell className="text-xs font-medium text-app-text-primary">{evt.title}</TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{evt.actor}</TableCell>
                  <TableCell className="text-xs text-app-text-muted">
                    {new Date(evt.timestamp).toLocaleString()}
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

