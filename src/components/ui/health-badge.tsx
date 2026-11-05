import React from "react";
import { ProjectHealth } from "@/types";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Clock, HelpCircle } from "lucide-react";

interface HealthBadgeProps {
  health: ProjectHealth;
  reasons?: string[];
  isOverridden?: boolean;
  className?: string;
  showIcon?: boolean;
}

export function HealthBadge({
  health,
  reasons = [],
  isOverridden,
  className,
  showIcon = true,
}: HealthBadgeProps) {
  const configs = {
    ON_TRACK: {
      label: "On Track",
      classes:
        "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/70 dark:text-green-300 dark:border-green-800",
      icon: CheckCircle2,
    },
    AT_RISK: {
      label: "At Risk",
      classes:
        "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800",
      icon: AlertCircle,
    },
    DELAYED: {
      label: "Delayed",
      classes:
        "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800",
      icon: Clock,
    },
    UNKNOWN: {
      label: "Unknown",
      classes:
        "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      icon: HelpCircle,
    },
  };

  const config = configs[health] || configs.UNKNOWN;
  const Icon = config.icon;

  return (
    <div className="relative group inline-block">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border cursor-help transition-all",
          config.classes,
          className
        )}
      >
        {showIcon && <Icon className="w-3.5 h-3.5" />}
        <span>{config.label}</span>
        {isOverridden && (
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-75">
            (Override)
          </span>
        )}
      </span>

      {/* Hover tooltip for underlying reasons */}
      {reasons.length > 0 && (
        <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block z-50 w-64 p-2.5 bg-gray-900 text-white dark:bg-gray-800 text-xs rounded-lg shadow-lg pointer-events-none">
          <p className="font-semibold mb-1 text-slate-200">Health Reasons:</p>
          <ul className="list-disc pl-4 space-y-1 text-slate-300">
            {reasons.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

