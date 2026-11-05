"use client";

import React from "react";
import { DashboardHeader } from "./DashboardHeader";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { OperatorSidebar } from "./OperatorSidebar";
import { OwnerSidebar } from "./OwnerSidebar";
import { AdminSidebar } from "./AdminSidebar";
import { ManagerSidebar } from "./ManagerSidebar";
import { LeadSidebar } from "./LeadSidebar";
import { DeveloperSidebar } from "./DeveloperSidebar";
import { ReviewerSidebar } from "./ReviewerSidebar";
import { ViewerSidebar } from "./ViewerSidebar";
import { RoleTestBanner } from "@/components/navigation/role-test-banner";
import { useAuth } from "@/hooks/useAuth";
import { SystemRole } from "@/types";
import { Toaster } from "sonner";
import { useTheme } from "@/hooks/useTheme";

export interface AppShellProps {
  children: React.ReactNode;
  role?: SystemRole;
  orgId?: string;
  title?: string;
}

export function AppShell({ children, role: overrideRole, orgId = "org-1", title }: AppShellProps) {
  const { role: authRole } = useAuth();
  const { isDark } = useTheme();
  const currentRole = overrideRole || authRole;

  const renderSidebar = () => {
    switch (currentRole) {
      case "SUPER_ADMIN":
        return <SuperAdminSidebar />;
      case "PLATFORM_OPERATOR":
        return <OperatorSidebar />;
      case "ORGANIZATION_OWNER":
        return <OwnerSidebar orgId={orgId} />;
      case "ORGANIZATION_ADMIN":
        return <AdminSidebar orgId={orgId} />;
      case "PROJECT_MANAGER":
        return <ManagerSidebar orgId={orgId} />;
      case "TEAM_LEAD":
        return <LeadSidebar orgId={orgId} />;
      case "DEVELOPER":
        return <DeveloperSidebar orgId={orgId} />;
      case "QA_REVIEWER":
        return <ReviewerSidebar orgId={orgId} />;
      case "VIEWER":
      default:
        return <ViewerSidebar orgId={orgId} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)] antialiased">
      <RoleTestBanner />
      <div className="flex flex-1 overflow-hidden">
        {renderSidebar()}
        <div className="flex flex-1 flex-col overflow-y-auto">
          <DashboardHeader title={title} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
      <Toaster position="top-right" theme={isDark ? "dark" : "light"} richColors />
    </div>
  );
}

