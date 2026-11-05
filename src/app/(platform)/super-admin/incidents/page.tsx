"use client";

import React, { useState } from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { useProjectStore } from "@/store/project-store";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminIncidentsPage() {
  const { incidents } = useProjectStore();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState<"MINOR" | "MAJOR" | "CRITICAL">("MINOR");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpen(false);
    toast.success(`Platform incident "${title}" opened and broadcast to status page.`);
  };

  return (
    <PanelLayout
      title="Platform Incidents &amp; Service Status"
      breadcrumb={[
        { label: "Super Admin", href: "/super-admin" },
        { label: "Incidents" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-app-text-primary">Incident Command</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Service outages, degraded operations, and post-mortem tracking.
            </p>
          </div>
          <Button size="sm" onClick={() => setIsOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Declare Incident
          </Button>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Affected Services</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((inc) => (
                <TableRow key={inc.id}>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{inc.title}</TableCell>
                  <TableCell>
                    <Badge variant={inc.severity === "CRITICAL" ? "danger" : "warning"}>
                      {inc.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={inc.status === "RESOLVED" ? "success" : "warning"}>
                      {inc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-app-text-muted">
                    {inc.affectedServices.join(", ")}
                  </TableCell>
                  <TableCell className="text-xs text-app-text-secondary">
                    {new Date(inc.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Declare New Platform Incident"
        description="Notify SRE on-call and update public availability dashboard."
      >
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          <Input
            label="Incident Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. S3 Attachment Quarantine Worker Delays"
            required
          />

          <Textarea
            label="Summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Describe symptoms, impacted regions, and initial response..."
            required
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Declare Incident</Button>
          </div>
        </form>
      </Dialog>
    </PanelLayout>
  );
}

