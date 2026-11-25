"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FolderGit2 } from "lucide-react";
import {
  ViewerPageHeader,
  ViewerSurfaceCard,
  ViewerFilterBar,
  ViewerPaginationBar,
  EmptyState,
  LoadingSkeleton,
  ErrorState,
} from "../_components/ViewerPrimitives";
import { ViewerProjectTable } from "../_components/ViewerProjectTable";
import { LIFECYCLE_LABEL, useViewerProjects } from "../_services/useViewerProjects";
import type { ProjectDto } from "@/types/api";

const PAGE_SIZE = 10;
const SELECT_CLASS =
  "h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]";

export default function ViewerProjectsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const { state, retry } = useViewerProjects(orgId);

  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"ALL" | ProjectDto["mode"]>("ALL");
  const [lifecycle, setLifecycle] = useState<"ALL" | ProjectDto["lifecycle"]>("ALL");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (state.status !== "ready") return [];
    const q = search.trim().toLowerCase();
    return state.projects.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)) &&
        (mode === "ALL" || p.mode === mode) &&
        (lifecycle === "ALL" || p.lifecycle === lifecycle),
    );
  }, [state, search, mode, lifecycle]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = search !== "" || mode !== "ALL" || lifecycle !== "ALL";

  return (
    <div className="space-y-5">
      <ViewerPageHeader title="Projects Portfolio" description="Projects you are permitted to view, as reported by the delivery service." />

      {state.status === "loading" && <LoadingSkeleton type="row" count={6} />}
      {state.status === "error" && <ErrorState description={state.message} onRetry={retry} />}

      {state.status === "ready" && (
        <ViewerSurfaceCard>
          <div className="p-4 border-b border-[var(--color-border,#E2E8F0)]">
            <ViewerFilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              searchPlaceholder="Search by name or code..."
              hasActiveFilters={hasFilters}
              onResetFilters={() => {
                setSearch("");
                setMode("ALL");
                setLifecycle("ALL");
                setPage(1);
              }}
              filters={
                <>
                  <select
                    aria-label="Delivery mode"
                    className={SELECT_CLASS}
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value as typeof mode);
                      setPage(1);
                    }}
                  >
                    <option value="ALL">All modes</option>
                    <option value="STRUCTURED">Structured</option>
                    <option value="INDIVIDUAL">Individual</option>
                  </select>
                  <select
                    aria-label="Lifecycle"
                    className={SELECT_CLASS}
                    value={lifecycle}
                    onChange={(e) => {
                      setLifecycle(e.target.value as typeof lifecycle);
                      setPage(1);
                    }}
                  >
                    <option value="ALL">All lifecycles</option>
                    {Object.entries(LIFECYCLE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </>
              }
            />
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={FolderGit2}
              title={state.projects.length === 0 ? "No projects yet" : "No matching projects"}
              description={
                state.projects.length === 0
                  ? "Projects shared with you will appear here once they are created."
                  : "Try a different search or clear the filters."
              }
            />
          ) : (
            <>
              <ViewerProjectTable projects={pageItems} />
              <ViewerPaginationBar currentPage={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </ViewerSurfaceCard>
      )}
    </div>
  );
}
