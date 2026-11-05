import React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0-100 or -1
  max?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  status?: "default" | "success" | "warning" | "danger";
  isNotReported?: boolean;
  isNotMeasurable?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  className,
  size = "md",
  showLabel = false,
  status = "default",
  isNotReported = false,
  isNotMeasurable = false,
}: ProgressBarProps) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));

  const heightClasses = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  const statusColors = {
    default: "bg-blue-600 dark:bg-blue-500",
    success: "bg-green-600 dark:bg-green-500",
    warning: "bg-amber-500 dark:bg-amber-400",
    danger: "bg-red-600 dark:bg-red-500",
  };

  let fillColor = statusColors[status];
  if (percent >= 100) fillColor = statusColors.success;

  if (isNotReported || value < 0) {
    return (
      <div className={cn("w-full", className)}>
        <div className={cn("w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-dashed border-slate-300 dark:border-slate-700", heightClasses[size])}>
          <div className="h-full w-full bg-slate-200 dark:bg-slate-700/50 flex items-center justify-center text-[10px] text-slate-500">
            {isNotMeasurable ? "Not Measurable" : "Not Reported"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full flex items-center gap-3", className)}>
      <div className={cn("flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden", heightClasses[size])}>
        <div
          className={cn("h-full transition-all duration-500 rounded-full", fillColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-app-text-secondary min-w-[36px] text-right">
          {Math.round(percent)}%
        </span>
      )}
    </div>
  );
}

