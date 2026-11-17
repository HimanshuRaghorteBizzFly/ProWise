import React from "react";
import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { PermissionDenied } from "@/components/feedback/PermissionDenied";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

type OwnerPageStateProps =
  | {
      state: "loading";
      label?: string;
    }
  | {
      state: "empty";
      title: string;
      description: string;
      icon?: LucideIcon;
      action?: {
        label: string;
        onAction: () => void;
      };
    }
  | {
      state: "error";
      title?: string;
      description?: string;
      onRetry?: () => void;
    }
  | {
      state: "forbidden";
      requiredPermission?: string;
      description?: string;
    }
  | {
      state: "access-lost";
      description?: string;
      onRetry?: () => void;
    };

export function OwnerPageState(props: OwnerPageStateProps) {
  switch (props.state) {
    case "loading":
      return (
        <section
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="space-y-3 rounded-xl border border-app-border bg-app-surface p-4 sm:p-5"
        >
          <span className="sr-only">{props.label ?? "Loading organization data"}</span>
          <div aria-hidden="true" className="space-y-3">
            <LoadingSkeleton className="h-4 w-2/5" />
            <LoadingSkeleton className="h-10 w-1/3" />
            <LoadingSkeleton className="h-4 w-3/5" />
          </div>
        </section>
      );
    case "empty":
      return (
        <div role="status" aria-live="polite">
          <EmptyState
            title={props.title}
            description={props.description}
            icon={props.icon}
            actionLabel={props.action?.label}
            onAction={props.action?.onAction}
          />
        </div>
      );
    case "error":
      return (
        <div role="alert">
          <ErrorState
            title={props.title}
            message={props.description}
            onRetry={props.onRetry}
          />
        </div>
      );
    case "forbidden":
      return (
        <div role="alert">
          <PermissionDenied
            requiredPermission={props.requiredPermission}
            message={props.description}
          />
        </div>
      );
    case "access-lost":
      return (
        <div role="alert">
          <ErrorState
            title="Access lost"
            message={props.description ?? "Your workspace context is missing or expired. Please reload and try again."}
            onRetry={props.onRetry}
          />
        </div>
      );
  }
}

export type { OwnerPageStateProps };
