import React, { useId } from "react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface OwnerPanelProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function OwnerPanel({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: OwnerPanelProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn("min-w-0", className)}
    >
      <Card className="h-full overflow-hidden p-0">
        <header className="flex flex-col gap-3 border-b border-app-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-section-title font-semibold tracking-tight text-app-text-primary">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-app-text-secondary">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
        <div className={cn("min-w-0 px-4 py-4 sm:px-5 sm:py-5", contentClassName)}>{children}</div>
      </Card>
    </section>
  );
}
