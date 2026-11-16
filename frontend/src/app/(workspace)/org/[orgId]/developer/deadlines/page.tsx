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
import { Clock } from "lucide-react";

export default function DeveloperDeadlinesPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { workItems, projects } = useProjectStore();

  const deadlines = [
    { key: "CRM-103", title: "E2E Integration & Security Review", date: "2026-11-15", project: "Clinical Decision Support API", type: "Structured Task" },
    { key: "SOLO-10", title: "FHIR Patient Intake Service Delivery", date: "2026-11-20", project: "FHIR Patient Intake", type: "Solo Project Delivery" },
  ];

  return (
    <PanelLayout
      title="Upcoming Deadlines &amp; Commitments"
      breadcrumb={[
        { label: "Developer", href: `/org/${orgId}/developer` },
        { label: "Deadlines" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Commitment Calendar</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Dates computed using project local timezone (America/New_York) and organization workdays.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work / Project</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Target Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deadlines.map((d) => (
                <TableRow key={d.key}>
                  <TableCell className="font-mono font-bold text-xs text-blue-600">{d.key}</TableCell>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{d.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{d.type}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-xs">{d.date}</TableCell>
                  <TableCell>
                    <Badge variant="success">On Schedule</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(
                          d.key.startsWith("SOLO")
                            ? `/org/${orgId}/developer/projects/proj-individual-solo/individual`
                            : `/org/${orgId}/developer/projects/proj-structured-cds/structured`
                        )
                      }
                    >
                      View
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

