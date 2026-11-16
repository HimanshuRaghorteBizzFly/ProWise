"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/ui/health-badge";
import { ProgressBar } from "@/components/ui/progress";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  FolderGit2,
  Calendar,
  Clock,
  Eye,
  ShieldCheck,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";

export default function ViewerDashboard() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { projects, workItems, gitEvents } = useProjectStore();

  const [activeTab, setActiveTab] = useState<"portfolio" | "milestones" | "activity">("portfolio");

  return (
    <PanelLayout
      title="Stakeholder Portfolio View"
      breadcrumb={[{ label: currentOrg.name }, { label: "Jordan Lee (Viewer)" }]}
    >
      <div className="space-y-6">
        {/* Read-Only Banner */}
        <div className="p-3.5 rounded-xl bg-app-surface border border-app-border flex items-center justify-between text-xs shadow-subtle">
          <div className="flex items-center gap-2 text-app-text-secondary">
            <Lock className="w-4 h-4 text-app-text-muted" />
            <span>
              <strong>Read-Only Governance Access:</strong> You possess viewing authority for portfolio health and delivery milestones. Mutation controls and data export are restricted.
            </span>
          </div>
          <Badge variant="outline">Read Only</Badge>
        </div>

        {/* Portfolio Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Total Initiatives</div>
            <div className="text-2xl font-bold text-app-text-primary mt-1">{projects.length}</div>
            <div className="text-[10px] text-app-text-muted mt-0.5">Across organization</div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">On Track Delivery</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {projects.filter((p) => p.health === "ON_TRACK").length}
            </div>
            <div className="text-[10px] text-green-600 font-medium mt-0.5">Meeting commitments</div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">At Risk / Delayed</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {projects.filter((p) => p.health === "DELAYED" || p.health === "AT_RISK").length}
            </div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">Monitored by PM</div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Delivered Work</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {projects.filter((p) => p.lifecycle === "DELIVERED").length}
            </div>
            <div className="text-[10px] text-blue-600 font-medium mt-0.5">Acceptance approved</div>
          </Card>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-app-border space-x-4">
          <button
            onClick={() => setActiveTab("portfolio")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "portfolio"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Portfolio Status &amp; Progress
          </button>
          <button
            onClick={() => setActiveTab("milestones")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "milestones"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Key Milestones ({workItems.filter((w) => w.type === "MILESTONE").length})
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "activity"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Recent Delivery Events
          </button>
        </div>

        {/* Tab 1: Portfolio Table */}
        {activeTab === "portfolio" && (
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Lifecycle</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Target Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-bold text-xs text-blue-600">
                      {p.key}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs text-app-text-primary">{p.name}</div>
                      <div className="text-[11px] text-app-text-muted">{p.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.mode}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.lifecycle === "ACTIVE"
                            ? "success"
                            : p.lifecycle === "DELIVERED"
                            ? "info"
                            : "outline"
                        }
                      >
                        {p.lifecycle}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="w-32">
                        <ProgressBar
                          value={p.lastProgressPercent}
                          size="sm"
                          showLabel
                          isNotReported={p.lastProgressPercent < 0}
                        />
                      </div>
                      <span className="text-[10px] text-app-text-muted">
                        {p.lastProgressMethod.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <HealthBadge health={p.health} reasons={p.healthReasons} />
                    </TableCell>
                    <TableCell className="text-xs text-app-text-secondary whitespace-nowrap">
                      {p.targetDate}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Tab 2: Milestones */}
        {activeTab === "milestones" && (
          <div className="space-y-4">
            {workItems
              .filter((w) => w.type === "MILESTONE")
              .map((m) => (
                <Card key={m.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-blue-600">{m.key}</span>
                      <h4 className="font-bold text-xs text-app-text-primary">{m.title}</h4>
                    </div>
                    <Badge variant={m.state === "DONE" ? "success" : "warning"}>
                      {m.state}
                    </Badge>
                  </div>
                  <p className="text-xs text-app-text-secondary">{m.description}</p>
                  <div className="text-[11px] text-app-text-muted pt-1 border-t border-app-border">
                    Criteria: {m.criteria}
                  </div>
                </Card>
              ))}
          </div>
        )}

        {/* Tab 3: Recent Activity */}
        {activeTab === "activity" && (
          <Card className="p-5 space-y-3">
            <CardTitle className="text-sm">Verified Project Activity Stream</CardTitle>
            <div className="space-y-3 pt-2">
              {gitEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-lg border border-app-border bg-app-sidebar/40 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-app-text-primary">{evt.title}</span>
                    <p className="text-app-text-secondary mt-0.5">{evt.detail}</p>
                    <span className="text-[10px] text-app-text-muted mt-1 block">
                      Repo: {evt.repoName} • By {evt.actor}
                    </span>
                  </div>
                  <span className="text-[10px] text-app-text-muted shrink-0 ml-4">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PanelLayout>
  );
}

