"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { SystemRole } from "@/types";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  PlusCircle,
  RotateCcw,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function RoleTestBanner() {
  const router = useRouter();
  const { currentRole, currentOrg, switchRoleAndNavigate } = useAuthStore();
  const { approveScopeAddition, reopenWorkItem, resetToInitialFixtures } = useProjectStore();
  const [isExpanded, setIsExpanded] = useState(true);

  const panels: { role: SystemRole; label: string; route: string }[] = [
    { role: "SUPER_ADMIN", label: "1. Super Admin", route: "/super-admin" },
    { role: "PLATFORM_OPERATOR", label: "2. Platform Operator", route: "/platform-operator" },
    { role: "ORGANIZATION_OWNER", label: "3. Org Owner", route: `/org/${currentOrg.id}/owner` },
    { role: "ORGANIZATION_ADMIN", label: "4. Org Admin", route: `/org/${currentOrg.id}/admin` },
    { role: "PROJECT_MANAGER", label: "5. Project Manager", route: `/org/${currentOrg.id}/manager` },
    { role: "TEAM_LEAD", label: "6. Team Lead", route: `/org/${currentOrg.id}/lead` },
    { role: "DEVELOPER", label: "7. Developer", route: `/org/${currentOrg.id}/developer` },
    { role: "QA_REVIEWER", label: "8. QA / Reviewer", route: `/org/${currentOrg.id}/reviewer` },
    { role: "VIEWER", label: "9. Viewer", route: `/org/${currentOrg.id}/viewer` },
  ];

  // Test Scenario 8 trigger: Approve 25-point scope addition to CRM-100 (50/100 -> 50/125 = 40%)
  const handleTriggerScenario8 = () => {
    approveScopeAddition(
      "proj-structured-cds",
      "Automated Audit Trail & Event Ingest Engine",
      25,
      "Approved scope amendment: Requirement M12 Compliance Logging",
      "usr-manager"
    );
    toast.success("Scenario 8 Executed: Approved 25-point scope addition! Progress is now 50/125 = 40%.");
  };

  // Test Scenario 9 trigger: Reopen completed 30-point API task (50/125 -> 20/125 = 16%)
  const handleTriggerScenario9 = () => {
    reopenWorkItem(
      "wi-task-2",
      "Security audit discovered dosage threshold rounding defect",
      "usr-lead"
    );
    toast.warning("Scenario 9 Executed: Reopened CRM-102 (30 pts)! Eligible progress reduced to 20/125 = 16%.");
  };

  const handleResetFixtures = () => {
    resetToInitialFixtures();
    toast.info("State reset to initial Blueprint V1.1 fixtures.");
  };

  return (
    <div className="bg-slate-900 text-slate-100 border-b border-slate-800 text-xs py-1.5 px-4 shadow-sm select-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded text-[10px] tracking-wide uppercase">
            <Sparkles className="w-3 h-3" />
            Blueprint V1.1 Quick Navigator
          </span>
          <span className="text-slate-300 hidden sm:inline text-[11px]">
            Switch between all 9 panels or run verification scenarios:
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
          >
            {isExpanded ? (
              <>
                <span>Collapse</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Expand Panels</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* 9 Panels Switcher */}
          <div className="flex flex-wrap items-center gap-1.5">
            {panels.map((p) => {
              const isCurrent = currentRole === p.role;
              return (
                <button
                  key={p.role}
                  onClick={() => switchRoleAndNavigate(p.role, router.push)}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-medium transition-all",
                    isCurrent
                      ? "bg-blue-600 text-white font-semibold shadow-xs ring-1 ring-blue-400"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Test Scenario Shortcuts */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleTriggerScenario8}
              className="px-2 py-1 bg-amber-900/50 hover:bg-amber-800/60 border border-amber-700/60 text-amber-200 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
              title="Add 25 pts leaf to CRM-100: Denominator grows to 125, progress becomes 40%"
            >
              <PlusCircle className="w-3 h-3 text-amber-400" />
              AS-08: Add 25pts Scope
            </button>

            <button
              onClick={handleTriggerScenario9}
              className="px-2 py-1 bg-rose-900/50 hover:bg-rose-800/60 border border-rose-700/60 text-rose-200 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors"
              title="Reopen CRM-102 (30 pts): Progress becomes 20/125 = 16%"
            >
              <RotateCcw className="w-3 h-3 text-rose-400" />
              Reopen 30pts API
            </button>

            <button
              onClick={handleResetFixtures}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-medium flex items-center gap-1 transition-colors"
              title="Reset data fixtures to starting state"
            >
              <RefreshCw className="w-3 h-3" />
              Reset Fixtures
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

