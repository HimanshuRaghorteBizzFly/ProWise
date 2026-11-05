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
import { LifeBuoy, Plus } from "lucide-react";
import { toast } from "sonner";

export default function PlatformOperatorTicketsPage() {
  const { supportTickets, createSupportTicket, updateTicketStatus } = useProjectStore();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [org, setOrg] = useState("Acme Health Technologies");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createSupportTicket({
      orgId: "org-acme",
      orgName: org,
      title,
      description: desc,
      severity: "MEDIUM",
      status: "OPEN",
      creatorEmail: "operator@prowise.io",
    });
    setIsOpen(false);
    setTitle("");
    setDesc("");
    toast.success("Support ticket opened.");
  };

  return (
    <PanelLayout
      title="Support Tickets Dispatch"
      breadcrumb={[
        { label: "Platform Operator", href: "/platform-operator" },
        { label: "Tickets" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-app-text-primary">Customer &amp; Infrastructure Tickets</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Incident triage queue with tenant audit tracking.
            </p>
          </div>
          <Button size="sm" onClick={() => setIsOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New Ticket
          </Button>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket ID</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supportTickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono font-bold text-xs">{t.id}</TableCell>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{t.orgName}</TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{t.title}</TableCell>
                  <TableCell>
                    <Badge variant={t.severity === "CRITICAL" ? "danger" : "warning"}>
                      {t.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.status === "RESOLVED" ? "success" : "info"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {t.status !== "RESOLVED" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          updateTicketStatus(t.id, "RESOLVED");
                          toast.success(`Ticket ${t.id} marked as resolved.`);
                        }}
                      >
                        Resolve
                      </Button>
                    )}
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
        title="Open Support Ticket"
        description="File a customer issue into the triage queue."
      >
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          <Input label="Organization" value={org} onChange={(e) => setOrg(e.target.value)} required />
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Textarea label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} required />
          <div className="flex justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Open Ticket</Button>
          </div>
        </form>
      </Dialog>
    </PanelLayout>
  );
}

