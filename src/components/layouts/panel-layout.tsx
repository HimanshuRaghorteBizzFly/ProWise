"use client";

import React, { useEffect } from "react";
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
    <div className="flex flex-col h-screen h-[100dvh] overflow-hidden bg-app-bg text-app-text-primary antialiased">
      {/* Test Scenario Quick Navigator Banner */}
      <RoleTestBanner />

      <div className="flex min-h-0 flex-1 w-full overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex flex-1 min-w-0 flex-col h-full overflow-y-auto overflow-x-hidden">
          <TopNav title={title} breadcrumb={breadcrumb} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full min-w-0">
            {children}
          </main>
        </div>
      </div>

      <Toaster position="top-right" theme={resolvedTheme} richColors />
    </div>
  );
}

