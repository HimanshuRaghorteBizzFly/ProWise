"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/project-store";
import { RotateCw, Activity } from "lucide-react";
import { toast } from "sonner";

export default function PlatformOperatorWebhooksPage() {
  const { webhookLogs, retryWebhookDelivery } = useProjectStore();

  return (
    <PanelLayout
      title="Webhook Ingestion &amp; Replay Logs"
      breadcrumb={[
        { label: "Platform Operator", href: "/platform-operator" },
        { label: "Webhook Logs" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-app-text-primary">Webhook Delivery Receipts</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">
            Blueprint Rule M08 / AS-06: Deduplicated by X-GitHub-Delivery ID. Replayed events do not duplicate work items.
          </p>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delivery ID</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Payload Summary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhookLogs.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono text-xs font-bold">{w.deliveryId}</TableCell>
                  <TableCell className="font-semibold text-xs text-app-text-primary">{w.source}</TableCell>
                  <TableCell className="font-mono text-xs">{w.event}</TableCell>
                  <TableCell className="text-xs text-app-text-secondary truncate max-w-sm">
                    {w.payloadSummary}
                  </TableCell>
                  <TableCell>
                    <Badge variant={w.status === "DELIVERED" ? "success" : "danger"}>
                      {w.statusCode} {w.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-app-text-muted">
                    {new Date(w.receivedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        retryWebhookDelivery(w.deliveryId);
                        toast.info(`Mock retry requested for ${w.deliveryId}.`);
                      }}
                    >
                      <RotateCw className="w-3 h-3 mr-1" /> Retry
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

