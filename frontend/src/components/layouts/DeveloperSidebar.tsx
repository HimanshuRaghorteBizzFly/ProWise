"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavigationConfig } from "@/config/navigation";
import { Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function DeveloperSidebar({ orgId = "org-1" }: { orgId?: string }) {
  const pathname = usePathname();
  const sections = getNavigationConfig("DEVELOPER", orgId);

  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-sidebar)] flex flex-col h-screen sticky top-0 overflow-hidden">
      <div className="flex h-16 items-center gap-2.5 px-6 border-b border-[var(--color-border)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white font-bold">
          <Code2 className="w-4 h-4" />
        </div>
        <div>
          <span className="font-bold text-sm tracking-tight text-[var(--color-text-primary)]">ProWise</span>
          <span className="ml-1.5 rounded bg-cyan-100 dark:bg-cyan-950 px-1.5 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
            DEVELOPER
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.title && (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 font-semibold"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.title}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

