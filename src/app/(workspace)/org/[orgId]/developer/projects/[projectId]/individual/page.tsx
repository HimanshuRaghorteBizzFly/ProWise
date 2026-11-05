"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { HealthBadge } from "@/components/ui/health-badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import {
  FolderGit2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  Send,
  Plus,
  ArrowLeft,
  FileCheck,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { validateIndividualCheckIn } from "@/lib/progress";
import { toast } from "sonner";

export default function IndividualModeWorkspace() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const projectId = (params?.projectId as string) || "proj-individual-solo";

  const { currentOrg, currentUser } = useAuthStore();
  const { projects, checkIns, submitCheckIn, requestDeliveryAcceptance } = useProjectStore();

  const project = projects.find((p) => p.id === projectId) || projects[0];
  const projectCheckIns = checkIns
    .filter((c) => c.projectId === project.id)
    .sort((a, b) => b.version - a.version);

  const latestCheckIn = projectCheckIns[0];

  const [activeTab, setActiveTab] = useState<"overview" | "history" | "evidence" | "delivery">("overview");

  // New Check-in Dialog state
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [percent, setPercent] = useState<number>(latestCheckIn ? latestCheckIn.percent + 10 : 45);
  const [accomplished, setAccomplished] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [blockersText, setBlockersText] = useState("");
  const [projectedFinish, setProjectedFinish] = useState(project.targetDate || "2026-11-20");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [downwardReason, setDownwardReason] = useState("");

  const isDownward = latestCheckIn && percent < latestCheckIn.percent;

  const handleSubmitCheckIn = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateIndividualCheckIn(
      percent,
      latestCheckIn ? latestCheckIn.percent : null,
      downwardReason
    );

    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const blockersList = blockersText
      ? blockersText.split("\n").filter((b) => b.trim().length > 0)
      : [];

    const res = submitCheckIn(
      project.id,
      currentUser.id,
      percent,
      accomplished,
      nextSteps,
      blockersList,
      projectedFinish,
      evidenceUrl,
      downwardReason
    );

    if (res.success) {
      toast.success(`Check-in v${(latestCheckIn?.version || 0) + 1} recorded successfully!`);
      setIsCheckInDialogOpen(false);
      setAccomplished("");
      setNextSteps("");
      setBlockersText("");
      setDownwardReason("");
    } else {
      toast.error(res.error || "Failed to record check-in");
    }
  };

  const handleRequestDeliveryAcceptance = () => {
    requestDeliveryAcceptance(project.id, currentUser.id);
    toast.success("Delivery acceptance review requested from Project Manager.");
  };

  return (
    <PanelLayout
      title={`Individual Workspace — ${project.name}`}
      breadcrumb={[
        { label: "Developer", href: `/org/${orgId}/developer` },
        { label: project.key },
        { label: "Individual Mode" },
      ]}
    >
      <div className="space-y-6">
        {/* Solo Workspace Header */}
        <div className="p-4 rounded-xl bg-app-surface border border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-subtle">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                {project.key}
              </span>
              <h2 className="text-base font-bold text-app-text-primary">{project.name}</h2>
              <Badge variant="default">Mode A: Individual Ownership</Badge>
            </div>
            <p className="text-xs text-app-text-secondary mt-1 max-w-2xl">
              {project.description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setIsCheckInDialogOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Submit New Check-In
            </Button>
          </div>
        </div>

        {/* Current Progress & Cadence Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Progress Card */}
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-app-text-muted">
                <span>Latest Accepted Progress</span>
                <Badge variant="success">Developer Reported</Badge>
              </div>
              <div className="text-3xl font-extrabold text-app-text-primary mt-2">
                {project.lastProgressPercent >= 0 ? `${project.lastProgressPercent}%` : "Not Reported"}
              </div>
            </div>
            <div className="mt-4">
              <ProgressBar
                value={project.lastProgressPercent}
                size="md"
                isNotReported={project.lastProgressPercent < 0}
              />
              <span className="text-[10px] text-app-text-muted mt-1.5 block">
                {latestCheckIn
                  ? `Reported on ${new Date(latestCheckIn.createdAt).toLocaleDateString()} by Alex Rivera`
                  : "No check-ins filed yet"}
              </span>
            </div>
          </Card>

          {/* Schedule & Grace Card */}
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-app-text-muted">
                <span>Schedule &amp; Cadence</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-base font-bold text-app-text-primary mt-2">
                Target: {project.targetDate}
              </div>
              <div className="text-xs text-app-text-secondary mt-1">
                Cadence: {project.cadence} ({project.graceWorkingDays} working day grace)
              </div>
            </div>
            <div className="mt-4 text-[11px] text-app-text-muted pt-2 border-t border-app-border">
              Next Due Date: <strong>Friday 17:00 ({project.timezone})</strong>
            </div>
          </Card>

          {/* Health & Blocker Summary Card */}
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-app-text-muted">
                <span>Health Signal (V1.1)</span>
                <HealthBadge health={project.health} reasons={project.healthReasons} />
              </div>
              <div className="text-sm font-semibold text-app-text-primary mt-2">
                Active Blockers: {latestCheckIn?.blockers.length || 0}
              </div>
              <p className="text-xs text-app-text-secondary mt-1 line-clamp-2">
                {project.healthReasons[0] || "All schedule commitments are on track."}
              </p>
            </div>
            {project.lastProgressPercent === 100 && !project.deliveryAcceptedAt && (
              <div className="mt-3">
                <Button
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-xs"
                  onClick={handleRequestDeliveryAcceptance}
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Request Delivery Acceptance
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-app-border space-x-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Latest Check-in Details
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Append-Only History ({projectCheckIns.length} Revisions)
          </button>
          <button
            onClick={() => setActiveTab("evidence")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "evidence"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Linked Evidence &amp; Repositories
          </button>
        </div>

        {/* Tab 1: Latest Check-in Overview */}
        {activeTab === "overview" && latestCheckIn && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-app-border">
              <div>
                <h3 className="text-sm font-bold text-app-text-primary">
                  Check-in Revision {latestCheckIn.version} ({latestCheckIn.percent}%)
                </h3>
                <span className="text-xs text-app-text-muted">
                  Submitted {new Date(latestCheckIn.createdAt).toLocaleString()}
                </span>
              </div>
              <Badge variant="success">Accepted &amp; Verified</Badge>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="font-semibold text-app-text-primary block mb-1">
                  Work Accomplished:
                </span>
                <p className="p-3 rounded-lg bg-app-sidebar/60 border border-app-border text-app-text-secondary leading-relaxed">
                  {latestCheckIn.accomplished}
                </p>
              </div>

              <div>
                <span className="font-semibold text-app-text-primary block mb-1">
                  Next Planned Steps:
                </span>
                <p className="p-3 rounded-lg bg-app-sidebar/60 border border-app-border text-app-text-secondary leading-relaxed">
                  {latestCheckIn.nextSteps}
                </p>
              </div>

              {latestCheckIn.downwardRevisionReason && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300">
                  <span className="font-bold">Downward Revision Reason:</span>{" "}
                  {latestCheckIn.downwardRevisionReason}
                </div>
              )}

              {latestCheckIn.optionalEvidence && (
                <div>
                  <span className="font-semibold text-app-text-primary block mb-1">
                    Attached Evidence URL:
                  </span>
                  <a
                    href={latestCheckIn.optionalEvidence}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 font-mono"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {latestCheckIn.optionalEvidence}
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Tab 2: Append-Only History */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="text-xs text-app-text-muted">
              Blueprint V1.1 Rule D02: Solo estimates are append-only. Corrections append a linked entry rather than overwriting history.
            </div>

            <div className="space-y-3">
              {projectCheckIns.map((chk) => (
                <Card key={chk.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-blue-600">{chk.percent}%</span>
                      <span className="font-semibold text-xs text-app-text-primary">
                        Revision {chk.version}
                      </span>
                      {chk.revisionOfId && (
                        <span className="text-[10px] text-app-text-muted">(Correction of prior entry)</span>
                      )}
                    </div>
                    <span className="text-[10px] text-app-text-muted">
                      {new Date(chk.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-app-text-secondary">{chk.accomplished}</p>

                  {chk.downwardRevisionReason && (
                    <div className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                      <strong>Downward correction note:</strong> {chk.downwardRevisionReason}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Evidence */}
        {activeTab === "evidence" && (
          <Card className="p-5 space-y-3">
            <CardTitle className="text-sm">Linked Repository &amp; Artifact Evidence</CardTitle>
            <CardDescription>
              Evidence from GitHub is displayed separately from completion. Commits and pull requests do not advance the reported percentage.
            </CardDescription>

            <div className="pt-2 space-y-2 text-xs">
              <div className="p-3 rounded-lg border border-app-border bg-app-sidebar/40 flex items-center justify-between">
                <span className="font-mono font-semibold text-blue-600">
                  acme-health/fhir-intake
                </span>
                <Badge variant="success">Synced</Badge>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* New Check-in Dialog */}
      <Dialog
        isOpen={isCheckInDialogOpen}
        onClose={() => setIsCheckInDialogOpen(false)}
        title="Submit Weekly Solo Check-In"
        description="Report your current delivery progress and forecast without the overhead of task boards."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitCheckIn} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Delivered Work Percentage (0–100)"
              type="number"
              min={0}
              max={100}
              value={percent}
              onChange={(e) => setPercent(parseInt(e.target.value) || 0)}
              required
            />

            <Input
              label="Projected Finish Date"
              type="date"
              value={projectedFinish}
              onChange={(e) => setProjectedFinish(e.target.value)}
              required
            />
          </div>

          {/* Downward Revision Explanation requirement */}
          {isDownward && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs space-y-2">
              <span className="font-bold text-amber-900 dark:text-amber-200">
                Downward Revision Detected ({latestCheckIn.percent}% &rarr; {percent}%):
              </span>
              <p className="text-amber-800 dark:text-amber-300">
                Blueprint V1.1 Rule FR-018: A downward revision requires an explicit, explainable reason.
              </p>
              <Textarea
                placeholder="Explain why progress was revised downward (e.g., unexpected architectural rework)..."
                value={downwardReason}
                onChange={(e) => setDownwardReason(e.target.value)}
                required
              />
            </div>
          )}

          <Textarea
            label="Work Accomplished During This Cadence"
            value={accomplished}
            onChange={(e) => setAccomplished(e.target.value)}
            placeholder="e.g. Lead import and HL7 mapping complete. Test call routing passes 24 unit cases."
            required
          />

          <Textarea
            label="Next Steps"
            value={nextSteps}
            onChange={(e) => setNextSteps(e.target.value)}
            placeholder="e.g. Complete end-to-end integration with sandbox gateway and error recovery."
            required
          />

          <Textarea
            label="Active Blockers (One per line)"
            value={blockersText}
            onChange={(e) => setBlockersText(e.target.value)}
            placeholder="Optional: Enter any impediments delaying progress..."
            rows={2}
          />

          <Input
            label="Optional Evidence Link (Pull Request, Release Tag, or Document)"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://github.com/acme-health/fhir-intake/pull/4"
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsCheckInDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit Check-In</Button>
          </div>
        </form>
      </Dialog>
    </PanelLayout>
  );
}

