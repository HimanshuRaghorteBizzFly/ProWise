"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderGit2, Search, X } from "lucide-react";

import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import type { SystemRole } from "@/types";
import type { ProjectDto } from "@/types/api";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Where a project opens for the signed-in role; roles without a project page land on their dashboard. */
function projectHref(role: SystemRole, orgId: string, project: ProjectDto): string {
  const base = `/org/${encodeURIComponent(orgId)}`;
  const id = encodeURIComponent(project.id);
  switch (role) {
    case "ORGANIZATION_OWNER":
      return `${base}/owner/projects/${id}`;
    case "ORGANIZATION_ADMIN":
      return `${base}/admin/projects/${id}`;
    case "PROJECT_MANAGER":
      return `${base}/manager/projects/${id}`;
    case "DEVELOPER":
      return `${base}/developer/projects/${id}/${project.mode === "INDIVIDUAL" ? "individual" : "structured"}`;
    default:
      return `${base}/viewer/projects`;
  }
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; projects: ProjectDto[] }
  | { status: "error" };

/** Searches the projects the signed-in person may read (GET /v1/organizations/{org}/projects?q=). */
export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchState>({ status: "idle" });
  const orgId = useAuthStore((state) => state.currentOrg.id);
  const role = useAuthStore((state) => state.currentRole);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !orgId) return;
    const term = query.trim();
    if (!term) {
      setResult({ status: "idle" });
      return;
    }
    let active = true;
    setResult({ status: "loading" });
    const timer = window.setTimeout(() => {
      apiClient
        .projects(orgId, { q: term, limit: 20 })
        .then((page) => active && setResult({ status: "ready", projects: page.items }))
        .catch(() => active && setResult({ status: "error" }));
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isOpen, orgId, query]);

  if (!isOpen) return null;

  const handleSelect = (url: string) => {
    onClose();
    router.push(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-xl rounded-xl bg-app-surface border border-app-border shadow-modal overflow-hidden z-10">
        <div className="flex items-center px-4 border-b border-app-border">
          <Search className="w-5 h-5 text-app-text-muted mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Search projects by name or key..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-12 bg-transparent text-sm text-app-text-primary placeholder:text-app-text-muted focus:outline-none"
          />
          <button onClick={onClose} aria-label="Close search" className="p-1 rounded text-app-text-muted hover:text-app-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {!orgId && <p className="py-8 text-center text-xs text-app-text-muted">Open a workspace to search its projects.</p>}
          {orgId && result.status === "idle" && (
            <p className="py-8 text-center text-xs text-app-text-muted">Type to search the projects you can see.</p>
          )}
          {result.status === "loading" && <p className="py-8 text-center text-xs text-app-text-muted">Searching…</p>}
          {result.status === "error" && (
            <p className="py-8 text-center text-xs text-rose-600">Search is unavailable right now. Try again.</p>
          )}
          {result.status === "ready" && result.projects.length === 0 && (
            <p className="py-8 text-center text-xs text-app-text-muted">No projects match &quot;{query.trim()}&quot;.</p>
          )}
          {result.status === "ready" && result.projects.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-app-text-muted uppercase px-2 mb-1">Projects</div>
              <div className="space-y-0.5">
                {result.projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(projectHref(role, orgId, p))}
                    className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg hover:bg-app-hover transition-colors text-xs text-app-text-primary"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderGit2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-semibold text-blue-600">[{p.key}]</span>
                      <span className="truncate">{p.name}</span>
                    </div>
                    <span className="text-[10px] text-app-text-muted uppercase">{p.mode}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-app-border text-[11px] text-app-text-muted flex items-center justify-between bg-app-sidebar/50">
          <span>Results come from your organization&apos;s projects</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
