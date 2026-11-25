"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileQuestion, ArrowLeft, LayoutDashboard } from "lucide-react";

export default function RootNotFound() {
  const router = useRouter();

  useEffect(() => {
    // If the user reached 404 with a path containing 'viewer', 'task', 'project', or 'dashboard', auto-redirect to valid viewer dashboard
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname.toLowerCase();
      if (
        pathname.includes("viewer") ||
        pathname.includes("task") ||
        pathname.includes("project") ||
        pathname.includes("progress") ||
        pathname.includes("dashboard")
      ) {
        router.replace("/select-workspace");
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-app-bg,#F8FAFD)] p-6">
      <div className="max-w-md w-full bg-[var(--color-surface,#FFFFFF)] border border-[var(--color-border,#E2E8F0)] rounded-2xl p-8 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
          <FileQuestion className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary,#202124)]">Page Not Found</h2>
          <p className="text-sm text-[var(--color-text-secondary,#5F6368)] mt-1.5 leading-relaxed">
            The page or workspace resource you are looking for does not exist or has been moved.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/select-workspace"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs"
          >
            <LayoutDashboard className="w-4 h-4" /> Go to my workspaces
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border border-[var(--color-border,#E2E8F0)] hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-primary,#202124)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to ProWise Home
          </Link>
        </div>
      </div>
    </div>
  );
}
