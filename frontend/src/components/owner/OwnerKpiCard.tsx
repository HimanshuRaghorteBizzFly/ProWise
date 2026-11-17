import React from "react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface OwnerKpiCardProps {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function OwnerKpiCard({ label, value, detail, icon, className }: OwnerKpiCardProps) {
  return (
    <Card
      role="group"
      aria-label={label}
      className={cn(
        "group relative min-w-0 overflow-hidden shadow-subtle transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-caption font-medium text-app-text-secondary">{label}</h3>
          <p className="mt-2 break-words text-kpi font-semibold tabular-nums tracking-tight text-app-text-primary">
            {value}
          </p>
        </div>
        {icon && (
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-sidebar text-app-text-secondary"
          >
            {icon}
          </span>
        )}
      </div>
      {detail && <div className="mt-2 text-sm text-app-text-secondary">{detail}</div>}
    </Card>
  );
}
