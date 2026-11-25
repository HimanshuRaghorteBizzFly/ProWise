import React, { useId } from "react";

import { cn } from "@/lib/utils";

export interface OwnerChartFrameProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function OwnerChartFrame({
  title,
  description,
  children,
  className,
  contentClassName,
}: OwnerChartFrameProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <figure
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn("min-w-0", className)}
    >
      <figcaption className="mb-3">
        <h3 id={titleId} className="text-sm font-semibold text-app-text-primary">
          {title}
        </h3>
        {description && (
          <p id={descriptionId} className="mt-1 text-caption text-app-text-secondary">
            {description}
          </p>
        )}
      </figcaption>
      <div className={cn("h-[clamp(14rem,24vw,20rem)] min-w-0 w-full", contentClassName)}>{children}</div>
    </figure>
  );
}
