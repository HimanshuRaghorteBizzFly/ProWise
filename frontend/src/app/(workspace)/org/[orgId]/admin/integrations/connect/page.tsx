"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Info, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { AdminButton, AdminSelect, EmptyStateView, PageFrame, Panel, formatDate, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { OrgGate, useOrgHref } from "@/components/org-console/OrgUI";
import { cn } from "@/lib/utils";

export default function AdminConnectRepositoryPage() {
  const href = useOrgHref("admin");
  const router = useRouter();
  const { status, retry, forceEmpty } = useDemoLoad(300);
  const available = useOrgConsoleStore((s) => s.availableRepos);
  const projects = useOrgConsoleStore((s) => s.projects);
  const github = useOrgConsoleStore((s) => s.github);
  const connect = useOrgConsoleStore((s) => s.connectRepo);
  const [repoId, setRepoId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const list = forceEmpty ? [] : available;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoId) return setError("Choose a repository.");
    setError("");
    setSaving(true);
    window.setTimeout(() => {
      const repo = connect("admin", repoId, projectId || null);
      setSaving(false);
      if (!repo) return setError("That repository is no longer available.");
      toast.success(`${repo.fullName} connected`, { description: "First sync started." });
      router.push(href(`integrations/${repo.id}`));
    }, 500);
  };

  return (
    <OrgGate family="admin" need="repo.connect">
      <PageFrame
        crumbs={[{ label: "Admin", href: href() }, { label: "Integrations", href: href("integrations") }, { label: "Connect repository" }]}
        back={{ href: href("integrations"), label: "Back to integrations" }}
        title="Connect a repository"
        description={`Repositories the GitHub app can see in @${github.account} that are not linked yet.`}
        status={status}
        onRetry={retry}
        skeleton="detail"
      >
        <form onSubmit={submit} className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel className="xl:col-span-2" title="Available repositories" icon={GitBranch} iconTone="cyan">
            {list.length === 0 ? (
              <EmptyStateView icon={GitBranch} title="Nothing to connect" description="Every repository visible to the GitHub app is already connected." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2" role="radiogroup" aria-label="Repository">
                {list.map((r) => (
                  <button key={r.id} type="button" role="radio" aria-checked={repoId === r.id} onClick={() => { setRepoId(r.id); setError(""); }} className={cn("rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5", repoId === r.id ? "border-blue-500/60 bg-blue-500/10" : "border-[var(--color-border)] bg-[var(--color-app-bg)] hover:border-blue-500/30")}>
                    <span className="block text-xs font-mono font-semibold break-all">{r.fullName}</span>
                    <span className="block mt-1 text-[11px] text-[var(--color-text-muted)]">{r.language} · updated {formatDate(r.updatedAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>
          <div className="space-y-4">
            <Panel title="Link to project" icon={Link2} iconTone="blue">
              <div className="space-y-3">
                <AdminSelect label="Project (optional)" value={projectId} onChange={(e) => setProjectId(e.target.value)} options={[{ label: "Don't link yet", value: "" }, ...projects.filter((p) => p.status !== "COMPLETED").map((p) => ({ label: `${p.code} · ${p.name}`, value: p.id }))]} />
                {error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}
                <AdminButton type="submit" className="w-full" isLoading={saving} disabled={list.length === 0}><GitBranch className="w-3.5 h-3.5" /> Connect</AdminButton>
              </div>
            </Panel>
            <Panel title="Good to know" icon={Info} iconTone="amber">
              <ul className="space-y-1.5 text-[11px] text-[var(--color-text-secondary)]">
                <li>Read-only scopes: {github.scopes.join(", ")}.</li>
                <li>Commits and PRs are shown as evidence; they never set progress.</li>
                <li>Installing or removing the GitHub app is owner-only.</li>
              </ul>
            </Panel>
          </div>
        </form>
      </PageFrame>
    </OrgGate>
  );
}
