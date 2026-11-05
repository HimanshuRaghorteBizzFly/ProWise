import React from "react";
import { AlertCircle, RotateCw } from "lucide-react";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Failed to load data",
  message = "An error occurred while fetching information. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-8 text-center">
      <div className="rounded-full bg-red-100 dark:bg-red-900/40 p-3 text-red-600 dark:text-red-400 mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-red-800 dark:text-red-300">{title}</h3>
      <p className="mt-1 text-sm text-red-600 dark:text-red-400 max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}

