"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SEEDED_ORGS } from "@/lib/mock-data";
import { Building2 } from "lucide-react";

export default function PlatformOperatorOrgStatusPage() {
  return (
    <PanelLayout
      title="Tenant Organization Status"
      breadcrumb={[
        { label: "Platform Operator", href: "/platform-operator" },
        { label: "Org Status" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Tenant Fleet Health</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Operational status and webhook connectivity across active organizations.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Tenant Key</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sync Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SEEDED_ORGS.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{org.name}</TableCell>
                  <TableCell className="font-mono text-xs text-app-text-muted">{org.slug}</TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{org.timezone}</TableCell>
                  <TableCell>
                    <Badge variant={org.status === "ACTIVE" ? "success" : "warning"}>
                      {org.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                      ● Active Sync
                    </span>
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

