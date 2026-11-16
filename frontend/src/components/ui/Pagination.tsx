import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center justify-between px-2 py-3", className)}>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Page <span className="font-medium text-[var(--color-text-primary)]">{currentPage}</span> of{" "}
        <span className="font-medium text-[var(--color-text-primary)]">{totalPages}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-lg border border-[var(--color-border)] p-1.5 text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="rounded-lg border border-[var(--color-border)] p-1.5 text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-40 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

