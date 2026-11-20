"use client";

import React from "react";
import {
  X,
  Calendar,
  Clock,
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
} from "lucide-react";
import { ViewerCalendarEvent } from "../_types";
import { Badge } from "@/components/ui/badge";
import { ReadOnlyBadge } from "./ViewerPrimitives";
import { useRouter, useParams } from "next/navigation";

export function EventDetailModal({
  event,
  onClose,
}: {
  event: ViewerCalendarEvent | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";

  if (!event) return null;

  const handleNavigateProject = () => {
    onClose();
    router.push(`/org/${orgId}/viewer/projects`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-app-border flex items-center justify-between bg-app-sidebar/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    event.type === "DEADLINE"
                      ? "danger"
                      : event.type === "MILESTONE"
                      ? "default"
                      : "secondary"
                  }
                >
                  {event.type.replace("_", " ")}
                </Badge>
                <ReadOnlyBadge />
              </div>
              <h2 className="text-sm font-bold text-app-text-primary mt-1 line-clamp-1">
                {event.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text-primary hover:bg-app-hover transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-app-bg border border-app-border flex items-center justify-between">
            <div>
              <div className="text-[10px] text-app-text-muted">Target Date</div>
              <div className="font-semibold text-app-text-primary mt-0.5">{event.date}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-app-text-muted">Timing</div>
              <div
                className={`font-bold mt-0.5 ${
                  event.daysRemaining < 0
                    ? "text-red-600"
                    : event.daysRemaining <= 7
                    ? "text-amber-600"
                    : "text-green-600"
                }`}
              >
                {event.daysRemaining < 0
                  ? `Overdue by ${Math.abs(event.daysRemaining)} days`
                  : event.daysRemaining === 0
                  ? "Today"
                  : `${event.daysRemaining} days remaining`}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-app-text-muted uppercase font-semibold">Initiative</div>
            <div className="font-semibold text-app-text-primary mt-0.5 flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5 text-blue-500" />
              <span>{event.projectName} ({event.projectKey})</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-app-text-muted uppercase font-semibold">Details</div>
            <p className="text-app-text-secondary mt-1 leading-relaxed">
              {event.description}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-app-border bg-app-sidebar/50 flex items-center justify-between">
          <button
            onClick={handleNavigateProject}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
          >
            <span>View in Projects</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-app-border bg-app-surface text-app-text-primary hover:bg-app-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
