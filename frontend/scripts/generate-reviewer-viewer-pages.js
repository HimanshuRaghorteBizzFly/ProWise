const fs = require('fs');
const path = require('path');

function writePage(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// Reviewer Re-exports
writePage('src/app/(workspace)/org/[orgId]/reviewer/dashboard/page.tsx', `export { default } from "../page";\n`);
writePage('src/app/(workspace)/org/[orgId]/reviewer/review-queue/page.tsx', `export { default } from "../queue/page";\n`);
writePage('src/app/(workspace)/org/[orgId]/reviewer/test-checklists/page.tsx', `export { default } from "../checklists/page";\n`);
writePage('src/app/(workspace)/org/[orgId]/reviewer/review-history/page.tsx', `export { default } from "../history/page";\n`);

// Reviewer Assigned Reviews
writePage('src/app/(workspace)/org/[orgId]/reviewer/assigned-reviews/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function ReviewerAssignedReviewsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { workItems } = useProjects(orgId);
  const inReview = workItems.filter(w => w.state === "IN_REVIEW");

  return (
    <PanelLayout title="Assigned Reviews" breadcrumb={[{ label: "QA Reviewer", href: \`/org/\${orgId}/reviewer\` }, { label: "Assigned" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Assigned Review Items</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Work items and deliverables awaiting QA / peer review verification</p>
        </div>
        <div className="space-y-2">
          {inReview.map(w => (
            <Card key={w.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center text-xs">
              <span className="font-semibold">{w.key}: {w.title}</span>
              <span className="text-amber-600 font-bold">rev {w.currentRevision} (IN_REVIEW)</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// Reviewer Work Items
writePage('src/app/(workspace)/org/[orgId]/reviewer/work-items/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function ReviewerWorkItemsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { workItems } = useProjects(orgId);

  return (
    <PanelLayout title="Work Items In Review" breadcrumb={[{ label: "QA Reviewer", href: \`/org/\${orgId}/reviewer\` }, { label: "Work Items" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Work Items Audit</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Inspect acceptance criteria versions and review logs</p>
        </div>
        <div className="space-y-2">
          {workItems.map(w => (
            <Card key={w.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center text-xs">
              <span className="font-semibold">{w.key}: {w.title}</span>
              <span className="font-mono text-primary-600 font-bold">{w.state}</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// Reviewer Approvals
writePage('src/app/(workspace)/org/[orgId]/reviewer/approvals/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function ReviewerApprovalsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { reviews } = useProjects(orgId);
  const approved = reviews.filter(r => r.decision === "APPROVED");

  return (
    <PanelLayout title="Approved Work Items" breadcrumb={[{ label: "QA Reviewer", href: \`/org/\${orgId}/reviewer\` }, { label: "Approvals" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Approved Revisions</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Items that passed quality criteria and checklist validation</p>
        </div>
        <div className="space-y-2">
          {approved.map(a => (
            <Card key={a.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] text-xs flex justify-between">
              <span className="font-semibold">Review: {a.id} (rev {a.submittedRevision})</span>
              <span className="text-green-600 font-bold">APPROVED</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// Reviewer Rejected Work
writePage('src/app/(workspace)/org/[orgId]/reviewer/rejected-work/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function ReviewerRejectedWorkPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { reviews } = useProjects(orgId);
  const rejected = reviews.filter(r => r.decision === "CHANGES_REQUESTED");

  return (
    <PanelLayout title="Changes Requested & Rejected Work" breadcrumb={[{ label: "QA Reviewer", href: \`/org/\${orgId}/reviewer\` }, { label: "Rejected Work" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Rework Queue</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Mandatory feedback justifications provided when changes are requested</p>
        </div>
        <div className="space-y-2">
          {rejected.map(r => (
            <Card key={r.id} className="p-4 border border-amber-200 dark:border-amber-900 bg-amber-50/20 dark:bg-amber-950/20 text-xs space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Work Item Review {r.id}</span>
                <span className="text-amber-700 dark:text-amber-300">CHANGES REQUESTED</span>
              </div>
              <p className="text-[var(--color-text-secondary)]">Feedback: {r.feedbackReason}</p>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// Reviewer Settings
writePage('src/app/(workspace)/org/[orgId]/reviewer/settings/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ReviewerSettingsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="QA Preferences" breadcrumb={[{ label: "QA Reviewer", href: \`/org/\${orgId}/reviewer\` }, { label: "Settings" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
        <h3 className="font-semibold text-sm">Reviewer Settings</h3>
        <Button size="sm" onClick={() => toast.success("Settings saved")}>Save Preferences</Button>
      </Card>
    </PanelLayout>
  );
}
`);

// ========================
// Viewer Re-exports & Pages
// ========================
writePage('src/app/(workspace)/org/[orgId]/viewer/dashboard/page.tsx', `export { default } from "../page";\n`);

writePage('src/app/(workspace)/org/[orgId]/viewer/delivery-status/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export default function ViewerDeliveryStatusPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { projects } = useProjects(orgId);

  return (
    <PanelLayout title="Delivery Status" breadcrumb={[{ label: "Viewer", href: \`/org/\${orgId}/viewer\` }, { label: "Delivery Status" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Delivery Acceptance Milestones</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Read-only view of customer delivery readiness and acceptance sign-offs</p>
        </div>
        <div className="space-y-3">
          {projects.map(p => (
            <Card key={p.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center text-xs">
              <div>
                <span className="font-semibold text-sm">{p.name} ({p.key})</span>
                <p className="text-[var(--color-text-secondary)]">Target: {p.targetDate} • Progress: {p.lastProgressPercent}%</p>
              </div>
              <span className="font-mono text-primary-600 font-bold">{p.lifecycle}</span>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/viewer/notifications/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useNotificationStore } from "@/store/notification-store";

export default function ViewerNotificationsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { notifications } = useNotificationStore();

  return (
    <PanelLayout title="Viewer Updates" breadcrumb={[{ label: "Viewer", href: \`/org/\${orgId}/viewer\` }, { label: "Notifications" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Project Updates Feed</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Announcements, status reports, and milestone publications</p>
        </div>
        <div className="space-y-2">
          {notifications.map(n => (
            <Card key={n.id} className="p-3 border border-[var(--color-border)] bg-[var(--color-surface)] text-xs">
              <span className="font-semibold text-primary-600">{n.title}</span>
              <p className="text-[var(--color-text-secondary)] mt-0.5">{n.message}</p>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

writePage('src/app/(workspace)/org/[orgId]/viewer/settings/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";

export default function ViewerSettingsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Viewer Preferences" breadcrumb={[{ label: "Viewer", href: \`/org/\${orgId}/viewer\` }, { label: "Settings" }]}>
      <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">Read-only stakeholder settings and email digest subscription options.</p>
      </Card>
    </PanelLayout>
  );
}
`);

console.log('Reviewer and Viewer pages generated.');

