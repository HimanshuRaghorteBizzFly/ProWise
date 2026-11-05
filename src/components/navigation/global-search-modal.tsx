"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderGit2, CheckSquare, Users, ExternalLink, X } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { useAuthStore } from "@/store/auth-store";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { projects, workItems } = useProjectStore();
  const { currentOrg } = useAuthStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.key.toLowerCase().includes(query.toLowerCase())
  );

  const filteredWorkItems = workItems.filter(
    (w) =>
      w.title.toLowerCase().includes(query.toLowerCase()) ||
      w.key.toLowerCase().includes(query.toLowerCase())
  );

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
            placeholder="Search projects, tasks, keys (e.g. CRM-101, SOLO-10)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-12 bg-transparent text-sm text-app-text-primary placeholder:text-app-text-muted focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-app-text-muted hover:text-app-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {/* Projects */}
          {filteredProjects.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-app-text-muted uppercase px-2 mb-1">
                Projects
              </div>
              <div className="space-y-0.5">
                {filteredProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      handleSelect(
                        p.mode === "INDIVIDUAL"
                          ? `/org/${currentOrg.id}/developer/projects/${p.id}/individual`
                          : `/org/${currentOrg.id}/developer/projects/${p.id}/structured`
                      )
                    }
                    className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg hover:bg-app-hover transition-colors text-xs text-app-text-primary"
                  >
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-blue-600">[{p.key}]</span>
                      <span>{p.name}</span>
                    </div>
                    <span className="text-[10px] text-app-text-muted uppercase">{p.mode}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Work items */}
          {filteredWorkItems.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-app-text-muted uppercase px-2 mb-1">
                Work Items
              </div>
              <div className="space-y-0.5">
                {filteredWorkItems.map((w) => (
                  <button
                    key={w.id}
                    onClick={() =>
                      handleSelect(
                        `/org/${currentOrg.id}/developer/projects/proj-structured-cds/structured`
                      )
                    }
                    className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg hover:bg-app-hover transition-colors text-xs text-app-text-primary"
                  >
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold">{w.key}</span>
                      <span className="truncate max-w-[280px]">{w.title}</span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase">{w.state}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredProjects.length === 0 && filteredWorkItems.length === 0 && (
            <div className="py-8 text-center text-xs text-app-text-muted">
              No matching projects or work items found for &quot;{query}&quot;
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-app-border text-[11px] text-app-text-muted flex items-center justify-between bg-app-sidebar/50">
          <span>Navigation: Use mouse or keyboard</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}

