const fs = require('fs');
const path = require('path');

function writePage(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// 1. Root Developer Re-exports
writePage('src/app/(workspace)/org/[orgId]/developer/dashboard/page.tsx', `export { default } from "../page";\n`);
writePage('src/app/(workspace)/org/[orgId]/developer/check-ins/page.tsx', `export { default } from "../checkins/page";\n`);

// 2. Developer Projects
writePage('src/app/(workspace)/org/[orgId]/developer/projects/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { HealthBadge } from "@/components/ui/health-badge";
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";

export default function DeveloperProjectsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { projects } = useProjects(orgId);

  return (
    <PanelLayout title="My Assigned Projects" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Projects" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Assigned Projects</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Navigate to Individual Check-In mode or Structured Work-Item mode</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(p => {
            const modePath = p.mode === "INDIVIDUAL"
              ? \`/org/\${orgId}/developer/projects/\${p.id}/individual\`
              : \`/org/\${orgId}/developer/projects/\${p.id}/structured\`;

            return (
              <Card key={p.id} className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary-600">{p.key}</span>
                      <h4 className="font-semibold text-sm">{p.name}</h4>
                    </div>
                    <span className="text-[10px] rounded bg-[var(--color-sidebar)] px-1.5 py-0.5 font-mono text-[var(--color-text-muted)]">
                      {p.mode} MODE
                    </span>
                  </div>
                  <HealthBadge health={p.health} />
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-[var(--color-border)]">
                  <span>Progress: <strong>{p.lastProgressPercent}%</strong></span>
                  <Link href={modePath} className="inline-flex items-center gap-1 text-primary-600 hover:underline font-medium">
                    Open {p.mode === "INDIVIDUAL" ? "Check-Ins" : "Task Board"} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// 3. Developer Tasks
writePage('src/app/(workspace)/org/[orgId]/developer/tasks/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { TaskBoard } from "@/components/developer/TaskBoard";
import { useProjects } from "@/hooks/useProjects";

export default function DeveloperTasksPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { workItems } = useProjects(orgId);

  return (
    <PanelLayout title="My Tasks & Kanban" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Tasks" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Assigned Tasks</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Manage your work items across TODO, IN_PROGRESS, IN_REVIEW, and DONE</p>
        </div>
        <TaskBoard workItems={workItems} projectId="proj-crm" />
      </div>
    </PanelLayout>
  );
}
`);

// 4. Developer Progress Tracker
writePage('src/app/(workspace)/org/[orgId]/developer/progress/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { Card } from "@/components/ui/card";

export default function DeveloperProgressTrackerPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Personal Progress Tracker" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Progress" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Progress Velocity</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Historical delivery velocity and check-in timeline</p>
        </div>
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <ProgressChart height={280} />
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// 5. Developer Repositories
writePage('src/app/(workspace)/org/[orgId]/developer/repositories/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { GitBranch } from "lucide-react";

export default function DeveloperRepositoriesPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { repositories } = useProjects(orgId);

  return (
    <PanelLayout title="Developer Repositories" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Repositories" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Assigned Code Repositories</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Linked git repositories for commit tagging and PR evidence</p>
        </div>
        <div className="space-y-3">
          {repositories.map(r => (
            <Card key={r.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary-600" />
                <span className="font-semibold">{r.name}</span>
                <span className="text-[var(--color-text-muted)] font-mono">({r.defaultBranch})</span>
              </div>
              <span className="text-green-600 font-semibold">{r.syncStatus}</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// 6. Developer Evidence
writePage('src/app/(workspace)/org/[orgId]/developer/evidence/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function DeveloperEvidencePage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Verification Evidence" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Evidence" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Artifacts & Review Evidence</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Pull request links, test reports, and design artifacts submitted with check-ins</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">All uploaded evidence artifacts are linked to corresponding check-in audits and reviews.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// 7. Developer Blockers
writePage('src/app/(workspace)/org/[orgId]/developer/blockers/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function DeveloperBlockersPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="My Blockers" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Blockers" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Active Delivery Impediments</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Reported blockers automatically escalate project health to AT_RISK or DELAYED</p>
        </div>
        <Card className="p-5 border border-red-200 dark:border-red-900 bg-red-50/20 dark:bg-red-950/20 space-y-2">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <h4 className="font-semibold text-xs">CRM-101: Third-party SSO certificate pending corporate renewal</h4>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">Assigned to DevOps escalation queue • Severity: HIGH</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// 8. Developer Comments
writePage('src/app/(workspace)/org/[orgId]/developer/comments/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function DeveloperCommentsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Review Comments & Feedback" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Comments" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Discussion & Feedback</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Reviewer change requests and peer discussion</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">No new review feedback threads.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// 9. Developer Notifications
writePage('src/app/(workspace)/org/[orgId]/developer/notifications/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useNotificationStore } from "@/store/notification-store";

export default function DeveloperNotificationsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { notifications } = useNotificationStore();

  return (
    <PanelLayout title="My Notifications" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Notifications" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Activity Notifications</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Review assignments, check-in due reminders, and deadline alerts</p>
        </div>
        <div className="space-y-2">
          {notifications.map(n => (
            <Card key={n.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] text-xs">
              <div className="font-semibold text-primary-600">{n.title}</div>
              <div className="text-[var(--color-text-secondary)] mt-0.5">{n.message}</div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// 10. Developer Settings
writePage('src/app/(workspace)/org/[orgId]/developer/settings/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DeveloperSettingsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Developer Settings" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Settings" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Developer Preferences</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Notification dispatch preferences and timezone settings</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <Button size="sm" onClick={() => toast.success("Preferences updated")}>Save Preferences</Button>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// ============================================
// Subproject Router: projects/[projectId]/page.tsx
// ============================================
writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/page.tsx', `"use client";
import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProjects } from "@/hooks/useProjects";

export default function DeveloperProjectRouterPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { projects } = useProjects(orgId);

  useEffect(() => {
    const project = projects.find(p => p.id === projectId);
    if (project?.mode === "STRUCTURED") {
      router.replace(\`/org/\${orgId}/developer/projects/\${projectId}/structured\`);
    } else {
      router.replace(\`/org/\${orgId}/developer/projects/\${projectId}/individual\`);
    }
  }, [projects, projectId, orgId, router]);

  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
`);

// ============================================
// Deep Individual Subpages
// ============================================
writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/individual/check-ins/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { useProjects } from "@/hooks/useProjects";
import { ProgressHistory } from "@/components/developer/ProgressHistory";

export default function IndividualCheckInsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { checkIns, projects } = useProjects(orgId);
  const project = projects.find(p => p.id === projectId);
  const pCheckIns = checkIns.filter(c => c.projectId === projectId);

  return (
    <PanelLayout title="Check-In Audit Log" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: project?.name || "Project", href: \`/org/\${orgId}/developer/projects/\${projectId}/individual\` }, { label: "Check-Ins" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Recorded Check-In History</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Immutable log of submitted progress revisions</p>
        </div>
        <ProgressHistory checkIns={pCheckIns} />
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/individual/new-check-in/page.tsx', `"use client";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { useProjects } from "@/hooks/useProjects";
import { CheckInForm } from "@/components/developer/CheckInForm";

export default function IndividualNewCheckInPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { projects } = useProjects(orgId);
  const project = projects.find(p => p.id === projectId);

  if (!project) return null;

  return (
    <PanelLayout title="Submit Check-In" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: project.name, href: \`/org/\${orgId}/developer/projects/\${projectId}/individual\` }, { label: "New Check-In" }]}>
      <div className="max-w-2xl mx-auto space-y-6">
        <CheckInForm project={project} onSuccess={() => router.push(\`/org/\${orgId}/developer/projects/\${projectId}/individual\`)} />
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/individual/progress-history/page.tsx', `export { default } from "../check-ins/page";\n`);

writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/individual/deadlines/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { useProjects } from "@/hooks/useProjects";
import { Card } from "@/components/ui/card";

export default function IndividualDeadlinesPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { projects } = useProjects(orgId);
  const project = projects.find(p => p.id === projectId);

  return (
    <PanelLayout title="Deadlines & Cadence" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: project?.name || "Project", href: \`/org/\${orgId}/developer/projects/\${projectId}/individual\` }, { label: "Deadlines" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Delivery Cadence & Target Dates</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Check-in frequency, grace periods, and expected finish date</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
          <div className="text-xs">Target Date: <strong>{project?.targetDate}</strong></div>
          <div className="text-xs">Reporting Cadence: <strong>{project?.cadence}</strong></div>
          <div className="text-xs">Grace Working Days: <strong>{project?.graceWorkingDays} days</strong></div>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/individual/evidence/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function IndividualProjectEvidencePage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;

  return (
    <PanelLayout title="Project Evidence & PRs" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Evidence" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Artifacts and PR links attached to check-ins for this project.</p>
      </Card>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/individual/delivery-status/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function IndividualDeliveryStatusPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { projects, requestDeliveryReview } = useProjects(orgId);
  const project = projects.find(p => p.id === projectId);

  return (
    <PanelLayout title="Delivery Acceptance Status" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: project?.name || "Project", href: \`/org/\${orgId}/developer/projects/\${projectId}/individual\` }, { label: "Delivery" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Delivery Review Workflow</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Request formal customer / QA acceptance review once 100% progress is recorded</p>
        </div>
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
          <div className="text-xs">Current Progress: <strong>{project?.lastProgressPercent}%</strong></div>
          {project?.deliveryReviewRequested ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded text-xs font-semibold">
              Delivery acceptance review has been requested. Pending Project Manager / QA sign-off.
            </div>
          ) : (
            <Button
              disabled={project?.lastProgressPercent !== 100}
              onClick={() => {
                requestDeliveryReview(projectId, "usr-dev");
                toast.success("Delivery acceptance review requested!");
              }}
            >
              Request Delivery Acceptance Review
            </Button>
          )}
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// ============================================
// Deep Structured Subpages
// ============================================
writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/structured/my-tasks/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { TaskBoard } from "@/components/developer/TaskBoard";
import { useProjects } from "@/hooks/useProjects";

export default function StructuredMyTasksPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { workItems } = useProjects(orgId);
  const pItems = workItems.filter(w => w.projectId === projectId);

  return (
    <PanelLayout title="Structured Tasks" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Structured", href: \`/org/\${orgId}/developer/projects/\${projectId}/structured\` }, { label: "My Tasks" }]}>
      <TaskBoard workItems={pItems} projectId={projectId} />
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/structured/tasks/[taskId]/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function StructuredTaskDetailPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const taskId = params.taskId as string;
  const { workItems } = useProjects(orgId);
  const task = workItems.find(w => w.id === taskId || w.key === taskId);

  return (
    <PanelLayout title={task ? \`Task \${task.key}\` : "Task Details"} breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Structured", href: \`/org/\${orgId}/developer/projects/\${projectId}/structured\` }, { label: task?.key || "Task" }]}>
      <div className="space-y-6">
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-mono text-xs font-bold text-primary-600">{task?.key}</span>
              <h2 className="text-xl font-bold mt-1">{task?.title}</h2>
              <span className="text-xs text-[var(--color-text-secondary)] font-mono">{task?.type} • {task?.weight} {task?.weightUnit}</span>
            </div>
            <span className="font-semibold text-primary-600 text-xs">{task?.state}</span>
          </div>
          <div className="pt-3 border-t border-[var(--color-border)] text-xs space-y-2">
            <h4 className="font-semibold">Acceptance Criteria</h4>
            <p className="text-[var(--color-text-secondary)] bg-[var(--color-sidebar)] p-3 rounded font-mono">
              {task?.criteria}
            </p>
          </div>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/structured/submit-review/page.tsx', `"use client";
import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useProjects } from "@/hooks/useProjects";

export default function StructuredSubmitReviewPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { workItems, updateWorkItem } = useProjects(orgId);
  const [evidence, setEvidence] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Submitted for review!");
    router.push(\`/org/\${orgId}/developer/projects/\${projectId}/structured\`);
  };

  return (
    <PanelLayout title="Submit for QA Review" breadcrumb={[{ label: "Developer", href: \`/org/\${orgId}/developer\` }, { label: "Structured", href: \`/org/\${orgId}/developer/projects/\${projectId}/structured\` }, { label: "Submit Review" }]}>
      <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] max-w-lg mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-base font-semibold">Submit Task Revision for Review</h3>
          <div>
            <label className="text-xs font-medium block mb-1">Artifact / PR Link</label>
            <Input value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="https://github.com/..." required />
          </div>
          <Button type="submit">Submit to QA</Button>
        </form>
      </Card>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/structured/review-feedback/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function StructuredReviewFeedbackPage() {
  return (
    <PanelLayout title="Review Feedback" breadcrumb={[{ label: "Developer", href: "#" }, { label: "Feedback" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Reviewer comments and inspection checklists for structured work items.</p>
      </Card>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/structured/evidence/page.tsx', `export { default } from "../../individual/evidence/page";\n`);

writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/structured/blockers/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function StructuredBlockersPage() {
  return (
    <PanelLayout title="Task Blockers" breadcrumb={[{ label: "Developer", href: "#" }, { label: "Blockers" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Active work item blockers impeding delivery flow.</p>
      </Card>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/structured/dependencies/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function StructuredDependenciesPage() {
  return (
    <PanelLayout title="Task Dependencies" breadcrumb={[{ label: "Developer", href: "#" }, { label: "Dependencies" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Finish-to-Start dependencies blocking tasks from entering IN_PROGRESS.</p>
      </Card>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/developer/projects/[projectId]/structured/progress/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function StructuredBaselineProgressPage() {
  return (
    <PanelLayout title="Baseline Leaf Progress" breadcrumb={[{ label: "Developer", href: "#" }, { label: "Progress" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Sum(Done Leaf Weights) / Total Approved Baseline Weights formula progress.</p>
      </Card>
    </PanelLayout>
  );
}
`);

console.log('Developer pages generated.');

