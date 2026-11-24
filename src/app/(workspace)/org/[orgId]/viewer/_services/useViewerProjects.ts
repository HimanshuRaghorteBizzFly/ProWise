"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, ApiError } from "@/lib/api";
import type { ProjectDto } from "@/types/api";

const PAGE_SIZE = 50;

/** Every project the signed-in viewer may read in this organization (the API applies tenant and permission scope). */
export async function loadViewerProjects(orgId: string): Promise<ProjectDto[]> {
  const projects: ProjectDto[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    const page = await apiClient.projects(orgId, { limit: PAGE_SIZE, cursor });
    projects.push(...page.items);
    if (!page.has_more || !page.next_cursor || seen.has(page.next_cursor)) return projects;
    seen.add(page.next_cursor);
    cursor = page.next_cursor;
  }
}

export type ViewerProjectsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; projects: ProjectDto[] };

export function useViewerProjects(orgId: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ViewerProjectsState & { key: string }>({ key: "", status: "loading" });
  const key = `${orgId}:${attempt}`;

  useEffect(() => {
    let active = true;
    setState({ key, status: "loading" });
    if (!orgId) {
      setState({ key, status: "error", message: "No active organization is selected." });
      return;
    }
    loadViewerProjects(orgId)
      .then((projects) => {
        if (active) setState({ key, status: "ready", projects });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message =
          error instanceof ApiError && error.status === 403
            ? "You do not have permission to view projects in this organization."
            : error instanceof Error
              ? error.message
              : "Projects could not be loaded.";
        setState({ key, status: "error", message });
      });
    return () => {
      active = false;
    };
  }, [key, orgId]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current: ViewerProjectsState = state.key === key ? state : { status: "loading" };
  return { state: current, retry };
}

export const LIFECYCLE_LABEL: Record<ProjectDto["lifecycle"], string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  AWAITING_ACCEPTANCE: "Awaiting acceptance",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export function lifecycleTone(lifecycle: ProjectDto["lifecycle"]) {
  switch (lifecycle) {
    case "ACTIVE":
      return "info" as const;
    case "DELIVERED":
    case "CLOSED":
      return "success" as const;
    case "ON_HOLD":
    case "AWAITING_ACCEPTANCE":
      return "warning" as const;
    case "CANCELLED":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function formatLocalDate(value: string | null): string {
  if (!value) return "—";
  // Date-only values stay local dates: never shift them through a time zone.
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
