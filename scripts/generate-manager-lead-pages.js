const fs = require('fs');
const path = require('path');

function writePage(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// Manager Re-exports
writePage('src/app/(workspace)/org/[orgId]/manager/dashboard/page.tsx', `export { default } from "../page";\n`);
writePage('src/app/(workspace)/org/[orgId]/manager/team-assignments/page.tsx', `export { default } from "../workload/page";\n`);
writePage('src/app/(workspace)/org/[orgId]/manager/delivery/page.tsx', `export { default } from "../delivery-approvals/page";\n`);

// Manager Project Planning
writePage('src/app/(workspace)/org/[orgId]/manager/project-planning/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";
import { toast } from "sonner";

export default function ManagerProjectPlanningPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Project Planning & Roadmaps" breadcrumb={[{ label: "Manager", href: \`/org/\${orgId}/manager\` }, { label: "Planning" }]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Release & Milestone Planning</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Schedule delivery targets, grace working day buffers, and reporting cadences</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Opening planning wizard...")}>
            <Plus className="w-4 h-4 mr-1.5" /> Plan Milestone
          </Button>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">All active projects have defined targets and reporting cadences.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// Manager Work Items
writePage('src/app/(workspace)/org/[orgId]/manager/work-items/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { CheckSquare } from "lucide-react";

export default function ManagerWorkItemsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { workItems } = useProjects(orgId);

  return (
    <PanelLayout title="Work Items Hierarchy" breadcrumb={[{ label: "Manager", href: \`/org/\${orgId}/manager\` }, { label: "Work Items" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Structured Scope Hierarchy</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">5-level hierarchy: Project → Milestone → Deliverable → Task → Subtask</p>
        </div>
        <div className="space-y-2">
          {workItems.map(w => (
            <Card key={w.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-primary-600">{w.key}</span>
                <span className="font-semibold">{w.title}</span>
                <span className="rounded bg-[var(--color-sidebar)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">{w.type}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono">{w.weight} {w.weightUnit}</span>
                <span className="font-semibold text-primary-600">{w.state}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// Manager Dependencies
writePage('src/app/(workspace)/org/[orgId]/manager/dependencies/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Layers } from "lucide-react";

export default function ManagerDependenciesPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Finish-to-Start Dependencies" breadcrumb={[{ label: "Manager", href: \`/org/\${orgId}/manager\` }, { label: "Dependencies" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Work Item Predecessor Constraints</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Explicit Finish-to-Start dependencies enforce sequential delivery within projects</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">CRM-101 (Predecessor) must reach DONE before CRM-102 can enter IN_PROGRESS.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// Manager Reviews
writePage('src/app/(workspace)/org/[orgId]/manager/reviews/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function ManagerReviewsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { reviews } = useProjects(orgId);

  return (
    <PanelLayout title="Review Oversight" breadcrumb={[{ label: "Manager", href: \`/org/\${orgId}/manager\` }, { label: "Reviews" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">QA & Lead Review Oversight</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Tracking revision approvals and rejection justifications</p>
        </div>
        <div className="space-y-3">
          {reviews.map(r => (
            <Card key={r.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold">Review ID: {r.id} (rev {r.submittedRevision})</span>
                <span className={r.decision === "APPROVED" ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>{r.decision}</span>
              </div>
              {r.feedbackReason && (
                <p className="text-xs text-[var(--color-text-secondary)] bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                  Feedback: {r.feedbackReason}
                </p>
              )}
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// Manager Settings
writePage('src/app/(workspace)/org/[orgId]/manager/settings/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ManagerSettingsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Project Manager Settings" breadcrumb={[{ label: "Manager", href: \`/org/\${orgId}/manager\` }, { label: "Settings" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Manager Preferences</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Default cadence, grace day warnings, and reminder notifications</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <Button size="sm" onClick={() => toast.success("Preferences saved")}>Save Preferences</Button>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

// ========================
// Lead Re-exports & Pages
// ========================
writePage('src/app/(workspace)/org/[orgId]/lead/dashboard/page.tsx', `export { default } from "../page";\n`);
writePage('src/app/(workspace)/org/[orgId]/lead/my-team/page.tsx', `export { default } from "../team/page";\n`);

writePage('src/app/(workspace)/org/[orgId]/lead/assignments/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function LeadAssignmentsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { workItems } = useProjects(orgId);

  return (
    <PanelLayout title="Work Item Assignments" breadcrumb={[{ label: "Team Lead", href: \`/org/\${orgId}/lead\` }, { label: "Assignments" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Assignee Distribution</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Primary assignees, reviewers, and collaborators</p>
        </div>
        <div className="space-y-2">
          {workItems.map(w => (
            <Card key={w.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center text-xs">
              <span className="font-semibold">{w.key}: {w.title}</span>
              <span className="text-[var(--color-text-secondary)]">Assignee: {w.primaryAssigneeId || "Unassigned"}</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/lead/sprint-planning/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function LeadSprintPlanningPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Sprint Planning" breadcrumb={[{ label: "Team Lead", href: \`/org/\${orgId}/lead\` }, { label: "Sprint Planning" }]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Sprint Iterations</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Manage 2-week delivery cycles and leaf task commitments</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Create iteration...")}>
            <Plus className="w-4 h-4 mr-1.5" /> New Sprint
          </Button>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">Current Sprint: Sprint 14 (Nov 1 - Nov 14) • 82% commitment on track</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/lead/progress/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { Card } from "@/components/ui/card";

export default function LeadProgressPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Team Velocity & Progress" breadcrumb={[{ label: "Team Lead", href: \`/org/\${orgId}/lead\` }, { label: "Progress" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Team Burnup & Velocity</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Real-time baseline leaf completion progress across all squad projects</p>
        </div>
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <ProgressChart height={260} />
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/lead/reviews/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function LeadReviewsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Peer Reviews" breadcrumb={[{ label: "Team Lead", href: \`/org/\${orgId}/lead\` }, { label: "Reviews" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Peer Code & Work Item Reviews</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Technical lead verification of submitted revisions</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">0 pending lead review sign-offs.</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/lead/workload/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { WorkloadChart } from "@/components/charts/WorkloadChart";
import { Card } from "@/components/ui/card";

export default function LeadWorkloadPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Team Workload Balance" breadcrumb={[{ label: "Team Lead", href: \`/org/\${orgId}/lead\` }, { label: "Workload" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Capacity vs Planned Workload</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Hours planned vs available hours (strictly distinct from points per V1.1)</p>
        </div>
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <WorkloadChart height={280} />
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/lead/activity/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function LeadActivityPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { gitEvents } = useProjects(orgId);

  return (
    <PanelLayout title="Team Engineering Stream" breadcrumb={[{ label: "Team Lead", href: \`/org/\${orgId}/lead\` }, { label: "Activity" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Team Commit & Review Stream</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Recent repository and task actions from assigned team members</p>
        </div>
        <div className="space-y-2">
          {gitEvents.map(e => (
            <Card key={e.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] text-xs flex justify-between">
              <div>
                <span className="font-semibold">{e.actor}:</span> {e.title}
              </div>
              <span className="text-[var(--color-text-muted)] font-mono">{e.repoName}</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/lead/reports/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function LeadReportsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Team Delivery Reports" breadcrumb={[{ label: "Team Lead", href: \`/org/\${orgId}/lead\` }, { label: "Reports" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Team Quality & Completion Metrics</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Review rejection rates, rework cycle time, and milestone delivery</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-xs text-[var(--color-text-secondary)]">Average review cycle time: 4.2 hours • First-pass approval rate: 89%</p>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

console.log('Manager and Lead pages generated.');

