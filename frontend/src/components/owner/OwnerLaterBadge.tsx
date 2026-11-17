import React from "react";
import { Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface OwnerLaterBadgeProps {
  /** Build task that delivers the missing backend, e.g. "1.2". */
  task: string;
  /** "Later · after task X": the API exists but writes wait for another task (e.g. 1.4 safe writes). */
  after?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

/** Marks a feature whose backend is not built yet. Never pair it with a working action. */
export function OwnerLaterBadge({ task, after = false, icon, className }: OwnerLaterBadgeProps) {
  return (
    <Badge variant="outline" className={cn("w-fit gap-1 whitespace-nowrap", className)}>
      {icon ?? <Clock aria-hidden="true" className="h-3.5 w-3.5" />}
      Later · {after ? "after " : ""}task {task}
    </Badge>
  );
}

const LATER_ACTION =
  "inline-flex h-8 cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-lg border border-app-border bg-app-bg px-2.5 text-xs font-medium text-app-text-muted";

/**
 * A visible but disabled action whose backend is not built yet. Callers render it only when
 * the membership holds the action's permission, and pair it with an OwnerLaterBadge.
 */
export function LaterActionButton({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <button type="button" disabled title={title ?? "Not available yet"} className={LATER_ACTION}>
      {children}
    </button>
  );
}
