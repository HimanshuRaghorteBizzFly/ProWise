"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Shield } from "lucide-react";

export default function SuperAdminRolesPage() {
  const roles = [
    { name: "Super Admin", scope: "Platform", grants: "Multi-tenant billing, commercial plans, platform security" },
    { name: "Platform Operator", scope: "Platform", grants: "Queue monitoring, webhooks, ticket assignment, backups" },
    { name: "Organization Owner", scope: "Tenant Org", grants: "Workspaces, member invites, ownership handover, billing" },
    { name: "Organization Admin", scope: "Tenant Org", grants: "Team leads, GitHub repository linking, member accounts" },
    { name: "Project Manager", scope: "Scoped Project", grants: "Create projects, approve scope baselines, delivery gates" },
    { name: "Team Lead", scope: "Scoped Squad", grants: "Sprint assignments, work item priorities, blockers, capacity" },
    { name: "Developer", scope: "Assigned Work", grants: "Solo check-in submission, Kanban tasks, review requests" },
    { name: "QA / Reviewer", scope: "Assigned Work", grants: "Inspect revisions, approve work items, request changes" },
    { name: "Viewer / Stakeholder", scope: "Tenant Org", grants: "Read-only portfolio inspection, milestones, activity" },
  ];

  return (
    <PanelLayout
      title="System Roles &amp; Permissions Matrix"
      breadcrumb={[
        { label: "Super Admin", href: "/super-admin" },
        { label: "Roles & Permissions" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Role Scope Matrix</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Blueprint V1.1 Security Policy: Permission = identity + active membership + scoped permission + allowed object.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Boundary Scope</TableHead>
                <TableHead>Enforced Permissions &amp; Boundary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-bold text-xs text-app-text-primary">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant={r.scope === "Platform" ? "danger" : "default"}>
                      {r.scope}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{r.grants}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PanelLayout>
  );
}

