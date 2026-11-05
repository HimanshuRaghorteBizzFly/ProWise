"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/ui/health-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  FolderGit2,
  Sparkles,
  Download,
  Filter,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  FileText,
  RotateCcw,
  Check,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { generateCsv, downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import { Project, ProjectLifecycle } from "@/types";

export default function ProjectManagerDashboard() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const {
    projects,
    updateProjectLifecycle,
    approveScopeAddition,
    snapshots,
    acceptanceRequests,
    decideDeliveryAcceptance,
  } = useProjectStore();

  const [modeFilter, setModeFilter] = useState<string>("ALL");
  const [healthFilter, setHealthFilter] = useState<string>("ALL");

  // Scope Approval Dialog state
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("proj-structured-cds");
  const [scopeAdditionTitle, setScopeAdditionTitle] = useState("Automated Compliance Logging Module");
  const [scopeAdditionWeight, setScopeAdditionWeight] = useState(25);
  const [scopeReason, setScopeReason] = useState("Requirement M12 regulatory audit trail");

  // History Snapshots Dialog state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyProjectId, setHistoryProjectId] = useState<string | null>(null);

  // Delivery Acceptance Dialog state
  const [isAcceptanceModalOpen, setIsAcceptanceModalOpen] = useState(false);
  const [selectedAcceptanceReqId, setSelectedAcceptanceReqId] = useState<string | null>(null);

  const filteredProjects = projects.filter((p) => {
    if (modeFilter !== "ALL" && p.mode !== modeFilter) return false;
    if (healthFilter !== "ALL" && p.health !== healthFilter) return false;
    return true;
  });

  const handleToggleLifecycle = (project: Project) => {
    if (project.lifecycle === "ACTIVE") {
      updateProjectLifecycle(project.id, "ON_HOLD", "Paused by Project Manager");
      toast.info(`Project ${project.key} placed ON HOLD.`);
    } else if (project.lifecycle === "ON_HOLD") {
      updateProjectLifecycle(project.id, "ACTIVE", "Resumed by Project Manager");
      toast.success(`Project ${project.key} resumed.`);
    } else if (project.lifecycle === "DELIVERED") {
      updateProjectLifecycle(project.id, "CLOSED", "Formal delivery acceptance confirmed");
      toast.success(`Project ${project.key} closed administratively.`);
    }
  };

  const handleApproveScope = (e: React.FormEvent) => {
    e.preventDefault();
    approveScopeAddition(
      selectedProjectId,
      scopeAdditionTitle,
      scopeAdditionWeight,
      scopeReason,
      "usr-manager"
    );
    setIsScopeModalOpen(false);
    toast.success(
      `Scope approved! Added ${scopeAdditionWeight} points to baseline. Denominator expanded & progress recalculated.`
    );
  };

  const handleExportCsv = () => {
    const headers = [
      "Project Key",
      "Project Name",
      "Mode",
      "Lifecycle",
      "Progress %",
      "Progress Method",
      "Health",
      "Target Date",
      "Health Reasons",
    ];

    const rows = filteredProjects.map((p) => [
      p.key,
      p.name,
      p.mode,
      p.lifecycle,
      p.lastProgressPercent >= 0 ? p.lastProgressPercent : "Not Reported",
      p.lastProgressMethod,
      p.health,
      p.targetDate,
      p.healthReasons.join(" | "),
    ]);

    const csvContent = generateCsv(headers, rows);
    downloadCsv(`prowise-portfolio-${orgId}.csv`, csvContent);
    toast.success("Portfolio CSV generated with OWASP formula-injection protection.");
  };

  return (
    <PanelLayout
      title="Project Delivery Management"
      breadcrumb={[{ label: currentOrg.name }, { label: "Project Manager" }]}
    >
      <div className="space-y-6">
        {/* Header Action Bar */}
        <div className="p-4 rounded-xl bg-app-surface border border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-subtle">
          <div>
            <h2 className="text-base font-bold text-app-text-primary">Portfolio Oversight</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Governing individual and structured delivery lifecycles, baselines, and health signals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsScopeModalOpen(true)}
              className="text-xs"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1 text-blue-600" /> Approve Scope Change
            </Button>
            <Button size="sm" variant="secondary" onClick={handleExportCsv} className="text-xs">
              <Download className="w-3.5 h-3.5 mr-1" /> Export Portfolio CSV
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/org/${orgId}/manager/create-project`)}
              className="text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Create Project Wizard
            </Button>
          </div>
        </div>

        {/* Portfolio KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Total Projects</div>
            <div className="text-2xl font-bold text-app-text-primary mt-1">{projects.length}</div>
            <div className="text-[10px] text-app-text-secondary mt-0.5">
              {projects.filter((p) => p.mode === "INDIVIDUAL").length} Solo /{" "}
              {projects.filter((p) => p.mode === "STRUCTURED").length} Structured
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">On Track</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {projects.filter((p) => p.health === "ON_TRACK").length}
            </div>
            <div className="text-[10px] text-green-600 font-medium mt-0.5">Within commitments</div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Delayed / At Risk</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {projects.filter((p) => p.health === "DELAYED" || p.health === "AT_RISK").length}
            </div>
            <div className="text-[10px] text-red-600 font-medium mt-0.5">Action required</div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-app-text-muted">Awaiting Acceptance</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {acceptanceRequests.filter((r) => r.status === "PENDING").length}
            </div>
            <div className="text-[10px] text-blue-600 font-medium mt-0.5">Signoff checklist</div>
          </Card>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-app-sidebar/60 p-3 rounded-lg border border-app-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-medium text-app-text-secondary">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="bg-app-surface border border-app-border rounded-md px-2.5 py-1 text-xs text-app-text-primary"
            >
              <option value="ALL">All Modes</option>
              <option value="INDIVIDUAL">Individual Mode</option>
              <option value="STRUCTURED">Structured Mode</option>
            </select>

            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="bg-app-surface border border-app-border rounded-md px-2.5 py-1 text-xs text-app-text-primary"
            >
              <option value="ALL">All Health Signals</option>
              <option value="ON_TRACK">On Track</option>
              <option value="AT_RISK">At Risk</option>
              <option value="DELAYED">Delayed</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>

          <div className="text-app-text-muted">
            Showing {filteredProjects.length} of {projects.length} initiatives
          </div>
        </div>

        {/* Projects Master Table */}
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>Progress Calculation</TableHead>
                <TableHead>Health &amp; Reasons</TableHead>
                <TableHead>Target Date</TableHead>
                <TableHead className="text-right">Lifecycle Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-bold text-blue-600 text-xs">
                    {p.key}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-xs text-app-text-primary">{p.name}</div>
                    <div className="text-[11px] text-app-text-muted line-clamp-1">
                      {p.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.mode === "INDIVIDUAL" ? "default" : "secondary"}>
                      {p.mode}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        p.lifecycle === "ACTIVE"
                          ? "success"
                          : p.lifecycle === "ON_HOLD"
                          ? "warning"
                          : p.lifecycle === "DELIVERED"
                          ? "info"
                          : "outline"
                      }
                    >
                      {p.lifecycle}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-app-text-primary">
                        {p.lastProgressPercent >= 0
                          ? `${Math.round(p.lastProgressPercent)}%`
                          : "Not Reported"}
                      </span>
                      <button
                        onClick={() => {
                          setHistoryProjectId(p.id);
                          setIsHistoryModalOpen(true);
                        }}
                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        <Clock className="w-3 h-3" /> History
                      </button>
                    </div>
                    <span className="text-[10px] text-app-text-muted block">
                      Method: {p.lastProgressMethod.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <HealthBadge health={p.health} reasons={p.healthReasons} />
                  </TableCell>
                  <TableCell className="text-xs text-app-text-secondary whitespace-nowrap">
                    {p.targetDate}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.lifecycle === "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleLifecycle(p)}
                          title="Pause project (On Hold)"
                        >
                          <Pause className="w-3 h-3 mr-1 text-amber-500" /> Pause
                        </Button>
                      )}
                      {p.lifecycle === "ON_HOLD" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleToggleLifecycle(p)}
                          title="Resume project"
                        >
                          <Play className="w-3 h-3 mr-1 text-green-500" /> Resume
                        </Button>
                      )}
                      {p.lifecycle === "DELIVERED" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleToggleLifecycle(p)}
                          title="Close delivered project"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1 text-blue-600" /> Close
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={() =>
                          router.push(
                            p.mode === "INDIVIDUAL"
                              ? `/org/${orgId}/developer/projects/${p.id}/individual`
                              : `/org/${orgId}/developer/projects/${p.id}/structured`
                          )
                        }
                      >
                        Open Workspace
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Pending Delivery Acceptance Reviews */}
        {acceptanceRequests.length > 0 && (
          <Card className="p-5 border-blue-200 dark:border-blue-900/60">
            <CardHeader className="px-0 pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                Delivery Acceptance Gate (M11)
              </CardTitle>
              <CardDescription>
                Formal verification required before a 100% completed project can advance to Delivered lifecycle.
              </CardDescription>
            </CardHeader>

            <div className="space-y-3">
              {acceptanceRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl border border-app-border bg-app-sidebar/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-app-text-primary text-sm">
                      {req.projectName} ({req.projectKey})
                    </div>
                    <div className="text-app-text-secondary mt-0.5">
                      Requested by Lead • Baseline Version: {req.scopeBaselineVersion || 1} • Checklist: {req.checklist.filter((c) => c.checked).length}/{req.checklist.length} verified
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {req.status === "PENDING" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            decideDeliveryAcceptance(req.id, "CHANGES_REQUESTED", "usr-manager", "Checklist verification incomplete");
                            toast.error("Changes requested. Delivery returned to development.");
                          }}
                        >
                          Request Changes
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            decideDeliveryAcceptance(req.id, "ACCEPTED", "usr-manager");
                            toast.success("Delivery formally accepted! Project moved to DELIVERED lifecycle.");
                          }}
                        >
                          Accept Delivery
                        </Button>
                      </>
                    ) : (
                      <Badge variant="success">Decision: {req.status}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Scope Approval Dialog */}
      <Dialog
        isOpen={isScopeModalOpen}
        onClose={() => setIsScopeModalOpen(false)}
        title="Approve Scope Change (M04 / D03)"
        description="Approving new leaf work expands the baseline denominator and mathematically recalculates project progress."
      >
        <form onSubmit={handleApproveScope} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-app-text-secondary">
              Target Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary"
            >
              {projects
                .filter((p) => p.mode === "STRUCTURED")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </option>
                ))}
            </select>
          </div>

          <Input
            label="New Approved Work Item / Leaf Title"
            value={scopeAdditionTitle}
            onChange={(e) => setScopeAdditionTitle(e.target.value)}
            required
          />

          <Input
            label="Approved Weight Points (Added to Denominator)"
            type="number"
            min={1}
            max={100}
            value={scopeAdditionWeight}
            onChange={(e) => setScopeAdditionWeight(parseInt(e.target.value) || 25)}
            required
          />

          <Input
            label="Mandatory Reason for Scope Change"
            value={scopeReason}
            onChange={(e) => setScopeReason(e.target.value)}
            required
          />

          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            <strong>Formula Impact:</strong> If CRM-100 currently has 50 accepted points of 100 (50%), approving +25 points expands the denominator to 125, resulting in 50/125 = <strong>40%</strong>.
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsScopeModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Approve Baseline Expansion</Button>
          </div>
        </form>
      </Dialog>

      {/* History Snapshots Dialog */}
      <Dialog
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Historical Progress Snapshots"
        description="Immutable timestamped progress ledger. Prior snapshots retain their original values and baselines."
        maxWidth="lg"
      >
        <div className="space-y-3 pt-2 max-h-96 overflow-y-auto">
          {snapshots
            .filter((s) => !historyProjectId || s.projectId === historyProjectId)
            .map((snap) => (
              <div
                key={snap.id}
                className="p-3 rounded-lg border border-app-border bg-app-sidebar/30 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-blue-600">
                    {snap.value >= 0 ? `${snap.value}%` : "Not Reported"}
                  </span>
                  <span className="text-[10px] text-app-text-muted">
                    {new Date(snap.instant).toLocaleString()}
                  </span>
                </div>
                <p className="text-app-text-primary font-medium">{snap.cause}</p>
                <div className="text-[10px] text-app-text-muted">
                  Method: {snap.method} {snap.denominator ? `• Baseline: ${snap.numerator}/${snap.denominator}` : ""}
                </div>
              </div>
            ))}
        </div>
      </Dialog>
    </PanelLayout>
  );
}

