import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { PageHeader } from "@/components/owner/primitives";
import { deadlineStatus, formatDateOnly } from "@/components/owner/project-format";
import type { Project } from "@/types";
import type { PermissionKey } from "@/types/permission";

export interface ReportsViewProps {
  projects: Project[];
  source: "api" | "fixture";
  can: (key: PermissionKey) => boolean;
  basePath?: string;
  now?: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  laterTask: string;
}

export const OWNER_REPORTS: ReportDefinition[] = [
  { id: "portfolio", name: "Portfolio", description: "Every readable project with lifecycle, health and progress by method.", laterTask: "5.5" },
  { id: "overdue", name: "Overdue", description: "Open projects past their approved target date, in each project's own time zone.", laterTask: "5.5" },
  { id: "workload", name: "Workload", description: "Known planned hours against availability by member and week.", laterTask: "5.4" },
  { id: "acceptance", name: "Acceptance", description: "Delivery acceptance requests and decisions.", laterTask: "2.4" },
];

export function ReportsView({ projects, source, can, basePath, now }: ReportsViewProps) {
  const canExport = can("report.export");
  const header = (
    <PageHeader
      title="Reports & exports"
      description="Reports use the same permission-aware queries as the screens. Exporting needs report.export even where reading is allowed."
      simulationLabel={source === "fixture" ? "Sample data" : undefined}
    />
  );

  if (!can("project.read")) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState state="forbidden" requiredPermission="project.read" description="Reports require project.read." />
      </div>
    );
  }

  const readable = projects.filter((project) => !project.archived);
  const overdue = readable.filter((project) => deadlineStatus(project, now) === "overdue");

  const preview = (id: string) => {
    if (id === "portfolio") {
      return <p className="text-sm text-app-text-primary">{readable.length} readable projects in the current record.</p>;
    }
    if (id === "overdue") {
      return overdue.length === 0 ? (
        <p className="text-sm text-app-text-secondary">No open project is past its target date.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {overdue.map((project) => (
            <li key={project.id} className="text-app-text-primary">
              <span className="font-semibold">{project.key}</span> · target {formatDateOnly(project.targetDate, project.timezone)}
            </li>
          ))}
        </ul>
      );
    }
    return <p className="text-sm text-app-text-secondary">No preview until the report source exists.</p>;
  };

  return (
    <div className="space-y-4">
      {header}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        {OWNER_REPORTS.map((report) => (
          <OwnerPanel
            key={report.id}
            title={report.name}
            description={report.description}
            actions={
              <>
                {canExport && <LaterActionButton title="CSV export ships with task 5.5">Export CSV</LaterActionButton>}
                <Link
                  href={basePath ? `${basePath}/reports/${report.id}` : report.id}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-blue-700 hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:text-blue-300"
                >
                  Open report <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
                <OwnerLaterBadge task={report.laterTask} />
              </>
            }
          >
            {preview(report.id)}
          </OwnerPanel>
        ))}
      </div>
    </div>
  );
}
