"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminEmailsPage() {
  const templates = [
    { key: "TPL-INVITE", name: "Single-Use Workspace Invitation", channel: "Transactional", status: "Active" },
    { key: "TPL-CHECKIN-DUE", name: "Solo Check-In Cadence Reminder", channel: "Scheduled", status: "Active" },
    { key: "TPL-REVIEW-REQUEST", name: "Work Item Inspection Request", channel: "Event-Triggered", status: "Active" },
    { key: "TPL-DELIVERY-ACCEPT", name: "Project Delivery Acceptance Notification", channel: "Formal Gate", status: "Active" },
  ];

  return (
    <PanelLayout
      title="Email Settings &amp; Delivery Templates"
      breadcrumb={[
        { label: "Super Admin", href: "/super-admin" },
        { label: "Emails & Templates" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Notification Templates</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Module M09: Configured email dispatch templates honoring user quiet hours and delivery preferences.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Key</TableHead>
                <TableHead>Template Name</TableHead>
                <TableHead>Trigger Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.key}>
                  <TableCell className="font-mono font-bold text-xs text-blue-600">{t.key}</TableCell>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{t.name}</TableCell>
                  <TableCell className="text-xs text-app-text-secondary">{t.channel}</TableCell>
                  <TableCell>
                    <Badge variant="success">{t.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info(`Previewing email template ${t.key}`)}
                    >
                      Preview HTML
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

