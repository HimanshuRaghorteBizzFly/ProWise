"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { TopNav } from "@/components/navigation/top-nav";
import { RoleTestBanner } from "@/components/navigation/role-test-banner";
import { Toaster } from "sonner";
import { useThemeStore } from "@/store/theme-store";

interface PanelLayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
}

export function PanelLayout({ children, title, breadcrumb }: PanelLayoutProps) {
  const { theme, resolvedTheme, setTheme } = useThemeStore();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const mobileNavigationButtonRef = useRef<HTMLButtonElement>(null);
  const closeMobileNavigation = useCallback(() => setMobileNavigationOpen(false), []);

  useEffect(() => {
    // Sync theme on mount
    const savedTheme = localStorage.getItem("prowise-theme") as "light" | "dark" | "system" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme("light");
    }
  }, [setTheme]);

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-clip bg-app-bg text-app-text-primary antialiased">
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-lg bg-app-surface px-3 py-2 text-sm font-semibold text-app-text-primary shadow-2xl focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:outline-none focus:ring-2 focus:ring-app-accent"
      >
        Skip to main content
      </a>
      {/* Test Scenario Quick Navigator Banner */}
      <RoleTestBanner />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          mobileOpen={mobileNavigationOpen}
          onMobileClose={closeMobileNavigation}
          mobileTriggerRef={mobileNavigationButtonRef}
        />

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <TopNav
            title={title}
            breadcrumb={breadcrumb}
            onOpenNavigation={() => setMobileNavigationOpen(true)}
            navigationOpen={mobileNavigationOpen}
            navigationButtonRef={mobileNavigationButtonRef}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full min-w-0 max-w-[2560px] flex-1 px-page-gutter py-4 focus:outline-none sm:py-6"
          >
            {children}
          </main>
        </div>
      </div>

      <Toaster position="top-right" theme={resolvedTheme} richColors />
    </div>
  );
}

