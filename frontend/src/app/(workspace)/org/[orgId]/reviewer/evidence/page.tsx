"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { ExternalLink, GitPullRequest } from "lucide-react";

export default function ReviewerEvidencePage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { gitEvents } = useProjectStore();

  return (
    <PanelLayout
      title="Evidence Inspector"
      breadcrumb={[
        { label: "Reviewer", href: `/org/${orgId}/reviewer` },
        { label: "Evidence" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Engineering Proof Stream</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Module M08: Verified pull requests, CI runs, and commits linked to measurable task keys.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Linked Task</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Evidence Summary</TableHead>
                <TableHead>Repository</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gitEvents.map((evt) => (
                <TableRow key={evt.id}>
                  <TableCell className="font-mono font-bold text-xs text-blue-600">
                    {evt.linkedTaskKey || "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{evt.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-xs text-app-text-primary">{evt.title}</div>
                    <div className="text-[11px] text-app-text-secondary">{evt.detail}</div>
                  </TableCell>
                  <TableCell className="text-xs text-app-text-muted font-mono">{evt.repoName}</TableCell>
                  <TableCell>
                    <Badge variant={evt.status === "SUCCESS" ? "success" : "secondary"}>
                      {evt.status}
                    </Badge>
                  </TableCell>
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

