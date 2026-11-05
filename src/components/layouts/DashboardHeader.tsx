"use client";

import React from "react";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { GlobalSearch } from "@/components/navigation/GlobalSearch";
import { NotificationMenu } from "@/components/navigation/NotificationMenu";
import { RoleSwitcher } from "@/components/navigation/RoleSwitcher";
import { WorkspaceSwitcher } from "@/components/navigation/WorkspaceSwitcher";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Sun, Moon } from "lucide-react";

export interface DashboardHeaderProps {
  title?: string;
}

export function DashboardHeader({ title }: DashboardHeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-4">
        <div>
          {title ? (
            <h1 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h1>
          ) : (
            <Breadcrumbs />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <GlobalSearch />
        <WorkspaceSwitcher />
        <RoleSwitcher />

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        <NotificationMenu />

        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-border)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white uppercase">
              {user.name.slice(0, 2)}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

