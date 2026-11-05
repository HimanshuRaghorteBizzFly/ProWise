"use client";

import React, { useState } from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEEDED_ORGS } from "@/lib/mock-data";
import { Building2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminOrganizationsPage() {
  const [search, setSearch] = useState("");
  const filtered = SEEDED_ORGS.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PanelLayout
      title="Platform Organizations"
      breadcrumb={[
        { label: "Super Admin", href: "/super-admin" },
        { label: "Organizations" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-app-text-primary">Tenant Workspaces</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Review and manage provisioned organizations across the multi-tenant fleet.
            </p>
          </div>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-app-text-muted" />
            <input
              type="text"
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none"
            />
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization Name</TableHead>
                <TableHead>Tenant Slug</TableHead>
                <TableHead>Commercial Plan</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-semibold text-xs text-app-text-primary">
                    {org.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-app-text-muted">{org.slug}</TableCell>
                  <TableCell>
                    <Badge variant="default">{org.plan}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{org.timezone}</TableCell>
                  <TableCell>
                    <Badge variant={org.status === "ACTIVE" ? "success" : "warning"}>
                      {org.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-app-text-muted">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info(`Tenant ${org.name} verified.`)}
                    >
                      Audit Scope
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

