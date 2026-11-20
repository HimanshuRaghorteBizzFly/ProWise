"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  Clock,
  Download,
  Layers,
  Sparkles,
  Info,
  Calendar,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
  FileCode,
  User,
} from "lucide-react";
import { ProgressBar } from "@/components/ui/progress";
import {
  ProgressTrajectoryChart,
  MilestoneProgressBarChart,
} from "../_components/ViewerCharts";
import {
  ViewerPageHeader,
  ViewerSurfaceCard,
  ViewerKpiCard,
  ViewerPaginationBar,
  ViewerStatusBadge,
  ViewerButton,
  ViewerSerialBadge,
  SimulatedMetricBadge,
  ReadOnlyBadge,
} from "../_components/ViewerPrimitives";
import { useViewerStore } from "../_store/useViewerStore";
import {
  getViewerProjects,
  getViewerMilestones,
} from "../_services/viewer-service";

export default function ViewerProgressPage() {
  const params = useParams();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const { exportProgressReport, exportMilestoneAudit } = useViewerStore();
  const [activeTab, setActiveTab] = useState<"structured" | "individual">("structured");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const projects = getViewerProjects(orgId);
  const milestones = getViewerMilestones(orgId);

  // Structured Mode initiative (CRM-100)
  const structuredProj = projects.find((p) => p.mode === "STRUCTURED" && p.key === "CRM-100");
  // Individual Mode initiative (SOLO-10)
  const individualProj = projects.find((p) => p.mode === "INDIVIDUAL" && p.key === "SOLO-10");

  const completedMilestones = milestones.filter((m) => m.state === "DONE").length;
  const totalWeight = milestones.reduce((sum, m) => sum + m.totalPoints, 0);

  // Sample verified individual check-ins
  const individualCheckins = useMemo(() => {
    return [
      {
        id: "chk-01",
        timestamp: "2026-11-16 17:45",
        engineer: "Elena Rostova",
        role: "Senior Lead Engineer",
        project: "SOLO-10 (Solo Micro-SaaS Engine)",
        task: "SOLO-11: Core Event Bus & Webhook Dispatch",
        submittedPercent: 80,
        priorPercent: 65,
        status: "APPROVED_PROGRESS",
        explanation: "Completed unit test coverage and Kafka consumer group failover handling.",
      },
      {
        id: "chk-02",
        timestamp: "2026-11-15 14:20",
        engineer: "Liam Chen",
        role: "Full-Stack Engineer",
        project: "CRM-100 (Enterprise Cloud CRM)",
        task: "CRM-103: Multi-tenant JWT RBAC",
        submittedPercent: 90,
        priorPercent: 75,
        status: "APPROVED_PROGRESS",
        explanation: "Implemented claim validation and organization boundary checks in Spring Security.",
      },
      {
        id: "chk-03",
        timestamp: "2026-11-14 11:30",
        engineer: "Elena Rostova",
        role: "Senior Lead Engineer",
        project: "SOLO-10 (Solo Micro-SaaS Engine)",
        task: "SOLO-12: Stripe Webhook Idempotency",
        submittedPercent: 55,
        priorPercent: 65,
        status: "REVISED_DOWNWARD",
        explanation: "Discovered edge case in webhook duplicate retries requiring redis lock refinement.",
      },
      {
        id: "chk-04",
        timestamp: "2026-11-13 16:15",
        engineer: "Marcus Vance",
        role: "DevOps & Infrastructure Lead",
        project: "EMR-200 (Clinical Records Vault)",
        task: "EMR-201: HIPAA Encryption at Rest",
        submittedPercent: 60,
        priorPercent: 40,
        status: "APPROVED_PROGRESS",
        explanation: "Provisioned KMS keys and configured PostgreSQL column-level encryption.",
      },
      {
        id: "chk-05",
        timestamp: "2026-11-12 09:40",
        engineer: "Sofia Reyes",
        role: "Product & QA Lead",
        project: "BILL-300 (Subscription Billing Core)",
        task: "BILL-302: Proration Calculation Engine",
        submittedPercent: 35,
        priorPercent: 20,
        status: "APPROVED_PROGRESS",
        explanation: "Verified monthly to annual plan migration proration math across 12 test matrices.",
      },
    ];
  }, []);

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header */}
      <ViewerPageHeader
        title="Progress & Delivery Auditing"
        description="Audit-backed progress calculation comparing Individual (developer check-in logs) and Structured (weighted baseline deliverables) mathematical models."
        badge={`Org: ${orgId}`}
        simulationLabel="Reactive Demo Data"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewerButton
              variant="outline"
              size="sm"
              onClick={exportProgressReport}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Progress (CSV)</span>
            </ViewerButton>
            <ViewerButton
              variant="primary"
              size="sm"
              onClick={exportMilestoneAudit}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Export Milestones (JSON)</span>
            </ViewerButton>
          </div>
        }
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ViewerKpiCard
          label="Structured Baseline Velocity"
          value={`${structuredProj ? structuredProj.lastProgressPercent : 68}%`}
          sublabel="Weighted mathematically by deliverables"
          icon={Layers}
          tone="blue"
        />
        <ViewerKpiCard
          label="Individual Check-in Average"
          value={`${individualProj ? individualProj.lastProgressPercent : 80}%`}
          sublabel="Subject to mandatory downward revision logs"
          icon={Activity}
          tone="violet"
        />
        <ViewerKpiCard
          label="Milestones Shipped"
          value={`${completedMilestones} / ${milestones.length}`}
          sublabel={`${totalWeight} total baseline points assigned`}
          trend={{ value: `${Math.round((completedMilestones / Math.max(1, milestones.length)) * 100)}% complete`, positive: true }}
          icon={CheckCircle2}
          tone="emerald"
        />
        <ViewerKpiCard
          label="Formula Verification"
          value="OWASP Validated"
          sublabel="Defense against CSV injection active"
          icon={ShieldCheck}
          tone="emerald"
        />
      </div>

      {/* 3. Trajectory Trend Chart in Surface Card */}
      <ViewerSurfaceCard className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
              Multi-Week Delivery Trajectory
            </h3>
            <p className="text-xs text-[var(--color-text-muted,#80868B)] mt-0.5">
              Historical progress trends for CRM-100 (Structured) and SOLO-10 (Individual)
            </p>
          </div>
          <SimulatedMetricBadge />
        </div>
        <ProgressTrajectoryChart />
      </ViewerSurfaceCard>

      {/* 4. Table Page Format: Structured Milestones or Individual Check-ins */}
      <ViewerSurfaceCard className="overflow-hidden">
        {/* Tab Headers */}
        <div className="p-4 border-b border-[var(--color-border,#E2E8F0)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 border-b sm:border-b-0 border-[var(--color-border,#E2E8F0)] pb-2 sm:pb-0">
            <button
              onClick={() => {
                setActiveTab("structured");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "structured"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-[var(--color-text-secondary,#5F6368)] hover:bg-[var(--color-hover,#EEF3FB)]"
              }`}
            >
              Structured Baseline Deliverables ({milestones.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("individual");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "individual"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-[var(--color-text-secondary,#5F6368)] hover:bg-[var(--color-hover,#EEF3FB)]"
              }`}
            >
              Individual Check-in Audit Logs ({individualCheckins.length})
            </button>
          </div>

          <div className="text-[11px] text-[var(--color-text-muted,#80868B)] flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>
              {activeTab === "structured"
                ? "Weight points enforce exact mathematical contribution."
                : "Downward revisions enforce documented explanations."}
            </span>
          </div>
        </div>

        {/* Tab 1: Structured Milestones Table */}
        {activeTab === "structured" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                <tr>
                  <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3">Milestone / Deliverable</th>
                  <th className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">Project</th>
                  <th className="px-4 py-3 hidden md:table-cell whitespace-nowrap">Phase</th>
                  <th className="px-4 py-3 whitespace-nowrap">Weight</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 w-32 whitespace-nowrap">Completion</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell whitespace-nowrap">Target Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
                {milestones.map((m, idx) => (
                  <tr
                    key={m.id}
                    className="border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)]"
                  >
                    {/* 1. Sr. No. (Modern SaaS interactive badge without hash) */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <ViewerSerialBadge num={idx + 1} />
                    </td>

                    {/* 2. Title */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[var(--color-text-primary,#202124)]">
                        {m.title}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted,#80868B)]">
                        {m.description}
                      </div>
                    </td>

                    {/* 3. Project */}
                    <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold text-blue-600">
                        {m.projectName}
                      </span>
                    </td>

                    {/* 4. Phase */}
                    <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                      {m.key}
                    </td>

                    {/* 5. Weight Points */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-[11px] text-[var(--color-text-primary,#202124)]">
                        {m.totalPoints} pts
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted,#80868B)] ml-1">
                        ({Math.round((m.totalPoints / Math.max(1, totalWeight)) * 100)}%)
                      </span>
                    </td>

                    {/* 6. Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ViewerStatusBadge
                        label={m.state}
                        tone={m.state === "DONE" ? "success" : m.state === "IN_PROGRESS" || m.state === "IN_REVIEW" ? "info" : "neutral"}
                        dot
                      />
                    </td>

                    {/* 7. Completion Bar */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(() => {
                        const pct = m.totalPoints > 0 ? Math.round((m.completedPoints / m.totalPoints) * 100) : 0;
                        return (
                          <div className="flex items-center gap-2">
                            <div className="w-16">
                              <ProgressBar value={pct} size="sm" />
                            </div>
                            <span className="font-mono font-bold text-[11px]">
                              {pct}%
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* 8. Target Date */}
                    <td className="px-4 py-3 text-right hidden sm:table-cell whitespace-nowrap font-mono text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                      {m.dueDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Tab 2: Individual Check-in Audit Logs Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                <tr>
                  <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3 whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-3">Engineer / Submitter</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Initiative & Task</th>
                  <th className="px-4 py-3 whitespace-nowrap text-center">Progress Delta</th>
                  <th className="px-4 py-3 whitespace-nowrap">Audit Status</th>
                  <th className="px-4 py-3">Revision Reason / Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
                {individualCheckins.map((chk, idx) => (
                  <tr
                    key={chk.id}
                    className="border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)]"
                  >
                    {/* 1. Sr. No. (Modern SaaS interactive badge without hash) */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <ViewerSerialBadge num={idx + 1} />
                    </td>

                    {/* 2. Timestamp */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-[var(--color-text-muted,#80868B)]">
                      {chk.timestamp}
                    </td>

                    {/* 3. Engineer */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-[var(--color-text-primary,#202124)]">
                        {chk.engineer}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted,#80868B)]">
                        {chk.role}
                      </div>
                    </td>

                    {/* 4. Project & Task */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="font-medium text-[var(--color-text-primary,#202124)] line-clamp-1">
                        {chk.task}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted,#80868B)]">
                        {chk.project}
                      </div>
                    </td>

                    {/* 5. Progress Delta */}
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className="font-mono text-[11px] text-[var(--color-text-muted,#80868B)] line-through mr-1.5">
                        {chk.priorPercent}%
                      </span>
                      <span className="font-mono font-bold text-xs text-[var(--color-text-primary,#202124)]">
                        → {chk.submittedPercent}%
                      </span>
                    </td>

                    {/* 6. Audit Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ViewerStatusBadge
                        label={chk.status === "APPROVED_PROGRESS" ? "Progress Approved" : "Downward Revision"}
                        tone={chk.status === "APPROVED_PROGRESS" ? "success" : "warning"}
                        dot
                      />
                    </td>

                    {/* 7. Revision Explanation */}
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary,#5F6368)]">
                      {chk.explanation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <ViewerPaginationBar
          currentPage={currentPage}
          totalItems={activeTab === "structured" ? milestones.length : individualCheckins.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </ViewerSurfaceCard>
    </div>
  );
}
