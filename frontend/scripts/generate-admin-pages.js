const fs = require('fs');
const path = require('path');

function writePage(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// 1. Dashboard re-export
writePage('src/app/(workspace)/org/[orgId]/admin/dashboard/page.tsx', `export { default } from "../page";\n`);
writePage('src/app/(workspace)/org/[orgId]/admin/members/page.tsx', `export { default } from "../../owner/members/page";\n`);
writePage('src/app/(workspace)/org/[orgId]/admin/teams/page.tsx', `export { default } from "../../owner/teams/page";\n`);
writePage('src/app/(workspace)/org/[orgId]/admin/invitations/page.tsx', `export { default } from "../../owner/invitations/page";\n`);
writePage('src/app/(workspace)/org/[orgId]/admin/roles-permissions/page.tsx', `export { default } from "../../owner/roles-permissions/page";\n`);
writePage('src/app/(workspace)/org/[orgId]/admin/projects/page.tsx', `export { default } from "../../owner/projects/page";\n`);
writePage('src/app/(workspace)/org/[orgId]/admin/integrations/page.tsx', `export { default } from "../../owner/integrations/page";\n`);
writePage('src/app/(workspace)/org/[orgId]/admin/reports/page.tsx', `export { default } from "../../owner/reports/page";\n`);

// Repositories
writePage('src/app/(workspace)/org/[orgId]/admin/repositories/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/hooks/useProjects";
import { GitBranch, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";

export default function AdminRepositoriesPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { repositories } = useProjects(orgId);

  return (
    <PanelLayout title="Repositories" breadcrumb={[{ label: "Admin", href: \`/org/\${orgId}/admin\` }, { label: "Repositories" }]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Engineering Code Repositories</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Connected GitHub repositories and commit stream status</p>
          </div>
          <Button size="sm" onClick={() => toast.info("Opening GitHub repo picker...")}>
            <Plus className="w-4 h-4 mr-1.5" /> Connect Repository
          </Button>
        </div>

        <div className="space-y-3">
          {repositories.map(repo => (
            <Card key={repo.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <GitBranch className="w-5 h-5 text-primary-600" />
                <div>
                  <h4 className="text-sm font-semibold">{repo.name}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)]">Branch: {repo.defaultBranch} • Owner: {repo.owner}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="default" className="bg-green-600">{repo.syncStatus}</Badge>
                <Button size="sm" variant="outline" onClick={() => toast.success(\`Triggering manual sync for \${repo.name}...\`)}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Sync
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// Activity
writePage('src/app/(workspace)/org/[orgId]/admin/activity/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";
import { GitCommit, GitPullRequest } from "lucide-react";

export default function AdminActivityPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { gitEvents } = useProjects(orgId);

  return (
    <PanelLayout title="Engineering Activity Feed" breadcrumb={[{ label: "Admin", href: \`/org/\${orgId}/admin\` }, { label: "Activity" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Recent Engineering Activity</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Live stream of incoming commits, pull requests, and status changes</p>
        </div>

        <div className="space-y-3">
          {gitEvents.map(evt => (
            <Card key={evt.id} className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-950 text-primary-600 mt-1">
                {evt.type === "PUSH" ? <GitCommit className="w-4 h-4" /> : <GitPullRequest className="w-4 h-4" />}
              </div>
              <div>
                <h4 className="text-sm font-semibold">{evt.title}</h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{evt.detail}</p>
                <span className="text-[10px] text-[var(--color-text-muted)] mt-1 block">
                  {evt.actor} • {evt.repoName} • {new Date(evt.timestamp).toLocaleString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
`);

// Settings
writePage('src/app/(workspace)/org/[orgId]/admin/settings/page.tsx', `"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminSettingsPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";

  return (
    <PanelLayout title="Admin Workspace Settings" breadcrumb={[{ label: "Admin", href: \`/org/\${orgId}/admin\` }, { label: "Settings" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Workspace Administration</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Configure defaults for projects, automated git linking, and member permissions</p>
        </div>
        <Card className="p-5 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
          <Button size="sm" onClick={() => toast.success("Settings updated")}>Save Preferences</Button>
        </Card>
      </div>
    </PanelLayout>
  );
}
`);

console.log('Admin pages generated.');

