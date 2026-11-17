"use client";

import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { GlobalSearchModal } from "./global-search-modal";

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] transition-colors shadow-sm"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search projects, tasks, or docs...</span>
        <kbd className="ml-2 rounded border border-[var(--color-border)] bg-[var(--color-sidebar)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
          ⌘K
        </kbd>
      </button>
      <GlobalSearchModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

