"use client";

import React, { useState } from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import {
  Server,
  LifeBuoy,
  AlertTriangle,
  RotateCw,
  Activity,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Filter,
  Plus,
  KeyRound,
} from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { toast } from "sonner";
import { SupportTicket } from "@/types";

export default function PlatformOperatorDashboard() {
  const { supportTickets, incidents, webhookLogs, updateTicketStatus, retryWebhookDelivery, createSupportTicket } =
    useProjectStore();

  const [activeTab, setActiveTab] = useState<"tickets" | "webhooks" | "monitoring" | "access">("tickets");
  const [webhookFilter, setWebhookFilter] = useState<string>("ALL");

  // New Ticket Dialog state
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketOrg, setTicketOrg] = useState("Acme Health Technologies");
  const [ticketSeverity, setTicketSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");

  // Support Access Elevation Dialog state
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [accessReason, setAccessReason] = useState("");
  const [accessScope, setAccessScope] = useState("Diagnostic logs & telemetry only");
  const [accessDurationHours, setAccessDurationHours] = useState(2);

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    createSupportTicket({
      orgId: "org-acme",
      orgName: ticketOrg,
      title: ticketTitle,
      description: ticketDesc,
      severity: ticketSeverity,
      status: "OPEN",
      creatorEmail: "operator@prowise.io",
    });
    setIsTicketDialogOpen(false);
    setTicketTitle("");
    setTicketDesc("");
    toast.success("Support ticket opened and routed to engineering triage.");
  };

  const handleElevationRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAccessDialogOpen(false);
    toast.success(
      `Support access elevation granted for ${accessDurationHours}h. Scope: ${accessScope}. Audit entry recorded.`
    );
  };

  const handleMockRetry = (deliveryId: string) => {
    retryWebhookDelivery(deliveryId);
    toast.info(`Mock retry requested for delivery ID ${deliveryId}. (Simulation: No live third-party network packet dispatched).`);
  };

  const filteredWebhooks = webhookLogs.filter((w) => {
    if (webhookFilter === "ALL") return true;
    return w.status === webhookFilter;
  });

  return (
    <PanelLayout
      title="Platform Operations &amp; Reliability"
      breadcrumb={[{ label: "Platform Operator", href: "/platform-operator" }, { label: "Operations" }]}
    >
      <div className="space-y-6">
        {/* Operator Assurance Banner */}
        <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold">Operator Observability &amp; Tenant Boundary Protocol:</div>
              <p className="text-slate-300 text-[11px] mt-0.5">
                Support access to customer environments requires time-limited elevation, recorded reason, and approval audit.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
              onClick={() => setIsAccessDialogOpen(true)}
            >
              <KeyRound className="w-3.5 h-3.5 mr-1 text-amber-400" /> Request Elevation
            </Button>
            <Button
              size="sm"
              onClick={() => setIsTicketDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New Support Ticket
            </Button>
          </div>
        </div>

        {/* Reliability KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Open Tickets</span>
              <LifeBuoy className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">
              {supportTickets.filter((t) => t.status !== "RESOLVED").length}
            </div>
            <div className="text-[10px] text-blue-600 font-medium mt-0.5">1 Critical</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Webhook Delivery</span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">99.8%</div>
            <div className="text-[10px] text-green-600 font-medium mt-0.5">p95: 140ms</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Sync Job Failures</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">
              {webhookLogs.filter((w) => w.status === "FAILED").length}
            </div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">Retry queued</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between text-app-text-muted text-xs">
              <span>Backup Status</span>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-app-text-primary mt-1.5">Healthy</div>
            <div className="text-[10px] text-app-text-muted mt-0.5">PITR verified 2h ago</div>
          </Card>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-app-border space-x-4">
          <button
            onClick={() => setActiveTab("tickets")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "tickets"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Support Tickets ({supportTickets.length})
          </button>
          <button
            onClick={() => setActiveTab("webhooks")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "webhooks"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Webhook Logs &amp; Replays ({webhookLogs.length})
          </button>
          <button
            onClick={() => setActiveTab("monitoring")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "monitoring"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            System Monitoring &amp; Queues
          </button>
        </div>

        {/* Tab 1: Support Tickets */}
        {activeTab === "tickets" && (
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Issue Summary</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reported At</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supportTickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs font-bold">{t.id}</TableCell>
                    <TableCell className="text-xs font-semibold">{t.orgName}</TableCell>
                    <TableCell>
                      <div className="font-medium text-xs text-app-text-primary">{t.title}</div>
                      <div className="text-[11px] text-app-text-secondary truncate max-w-sm">
                        {t.description}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.severity === "CRITICAL"
                            ? "danger"
                            : t.severity === "HIGH"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {t.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.status === "RESOLVED" ? "success" : "info"}>
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-app-text-muted">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {t.status !== "RESOLVED" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            updateTicketStatus(t.id, "RESOLVED");
                            toast.success(`Ticket ${t.id} resolved.`);
                          }}
                        >
                          Mark Resolved
                        </Button>
                      ) : (
                        <span className="text-xs text-green-600 font-semibold">Resolved</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Tab 2: Webhooks & Event Replays */}
        {activeTab === "webhooks" && (
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-app-border flex items-center justify-between">
              <div>
                <CardTitle>Inbound Webhook Deliveries</CardTitle>
                <CardDescription>
                  Deduplicated by X-GitHub-Delivery receipt ID. Redeliveries do not duplicate work items.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-app-text-muted" />
                <select
                  value={webhookFilter}
                  onChange={(e) => setWebhookFilter(e.target.value)}
                  className="text-xs bg-app-surface border border-app-border rounded-lg px-2 py-1 text-app-text-primary"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Delivery ID</TableHead>
                  <TableHead>Source Provider</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Payload Summary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWebhooks.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.deliveryId}</TableCell>
                    <TableCell className="font-semibold text-xs">{w.source}</TableCell>
                    <TableCell className="font-mono text-xs">{w.event}</TableCell>
                    <TableCell className="text-xs text-app-text-secondary truncate max-w-xs">
                      {w.payloadSummary}
                    </TableCell>
                    <TableCell>
                      <Badge variant={w.status === "DELIVERED" ? "success" : "danger"}>
                        {w.statusCode} {w.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-app-text-muted">{w.attemptCount}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMockRetry(w.deliveryId)}
                        title="Simulate mock retry request"
                      >
                        <RotateCw className="w-3 h-3 mr-1" /> Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Tab 3: System Monitoring */}
        {activeTab === "monitoring" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-5 space-y-4">
              <CardTitle className="text-sm">Job Queue Consumer Metrics</CardTitle>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-app-border">
                  <span className="text-app-text-secondary">BullMQ Redis Worker Status:</span>
                  <Badge variant="success">Active (12 workers)</Badge>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-app-border">
                  <span className="text-app-text-secondary">Webhook Ingestion Backlog:</span>
                  <span className="font-mono font-bold">0 pending</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-app-border">
                  <span className="text-app-text-secondary">Email Notification Outbox:</span>
                  <span className="font-mono font-bold">2 in queue</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-app-text-secondary">PostgreSQL Connection Pool:</span>
                  <span className="font-mono font-bold">14 / 50 active</span>
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <CardTitle className="text-sm">Backup &amp; Disaster Recovery Ledger</CardTitle>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-app-border">
                  <span className="text-app-text-secondary">Latest PITR Snapshot:</span>
                  <span className="font-mono">2026-11-05 08:00 UTC (100% OK)</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-app-border">
                  <span className="text-app-text-secondary">Target RPO / RTO:</span>
                  <span className="font-semibold">&le; 1 hour / 4 hours</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-app-text-secondary">Storage Vault Encryption:</span>
                  <Badge variant="success">AES-256 GCM Active</Badge>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* New Support Ticket Dialog */}
      <Dialog
        isOpen={isTicketDialogOpen}
        onClose={() => setIsTicketDialogOpen(false)}
        title="Open Support Ticket"
        description="Route operational or customer bug reports into the support triage queue."
      >
        <form onSubmit={handleCreateTicket} className="space-y-4 pt-2">
          <Input
            label="Tenant Organization"
            value={ticketOrg}
            onChange={(e) => setTicketOrg(e.target.value)}
            required
          />

          <Input
            label="Issue Summary"
            value={ticketTitle}
            onChange={(e) => setTicketTitle(e.target.value)}
            placeholder="e.g. GitHub webhook HMAC failure on push event"
            required
          />

          <Textarea
            label="Detailed Diagnostic Notes"
            value={ticketDesc}
            onChange={(e) => setTicketDesc(e.target.value)}
            placeholder="Provide observed error code, affected user/repo, and reproduction steps..."
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-app-text-secondary">Severity</label>
            <select
              value={ticketSeverity}
              onChange={(e) => setTicketSeverity(e.target.value as any)}
              className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsTicketDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit Ticket</Button>
          </div>
        </form>
      </Dialog>

      {/* Support Access Elevation Dialog */}
      <Dialog
        isOpen={isAccessDialogOpen}
        onClose={() => setIsAccessDialogOpen(false)}
        title="Request Elevated Support Access"
        description="Blueprint V1.1 Rule: Tenant support access requires explicit purpose, actor, time limit, and immutable audit entry."
      >
        <form onSubmit={handleElevationRequest} className="space-y-4 pt-2">
          <Input
            label="Mandatory Elevation Purpose &amp; Ticket Reference"
            value={accessReason}
            onChange={(e) => setAccessReason(e.target.value)}
            placeholder="e.g. Resolving ticket TKT-001 webhook latency"
            required
          />

          <Input
            label="Restricted Elevation Scope"
            value={accessScope}
            onChange={(e) => setAccessScope(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-app-text-secondary">
              Duration (Hours)
            </label>
            <input
              type="number"
              min={1}
              max={8}
              value={accessDurationHours}
              onChange={(e) => setAccessDurationHours(parseInt(e.target.value) || 2)}
              className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsAccessDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Authorize Time-Limited Access</Button>
          </div>
        </form>
      </Dialog>
    </PanelLayout>
  );
}

