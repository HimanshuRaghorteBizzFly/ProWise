"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { SEEDED_USERS } from "@/lib/mock-data";
import { Users } from "lucide-react";

export default function LeadTeamPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();

  const squadMembers = [
    { user: SEEDED_USERS[5], role: "Team Lead", status: "Active", tasks: 2 },
    { user: SEEDED_USERS[6], role: "Developer", status: "Active", tasks: 3 },
    { user: SEEDED_USERS[7], role: "QA Reviewer", status: "Active", tasks: 1 },
  ];

  return (
    <PanelLayout
      title="Squad Roster &amp; Allocation"
      breadcrumb={[
        { label: "Team Lead", href: `/org/${orgId}/lead` },
        { label: "My Team" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Core Clinical Engineering Squad</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Module M01: Team members and leads are scoped strictly to their authorized organization and squads.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Squad Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Work Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {squadMembers.map((m, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{m.user.name}</TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{m.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="default">{m.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="success">{m.status}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-xs text-blue-600">{m.tasks} tasks</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PanelLayout>
  );
}

