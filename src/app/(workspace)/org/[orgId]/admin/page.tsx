"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Users,
  GitPullRequest,
  Mail,
  FolderGit2,
  Activity,
  ShieldCheck,
  Plus,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { SEEDED_MEMBERSHIPS, SEEDED_USERS, SEEDED_TEAMS, SEEDED_INVITATIONS } from "@/lib/mock-data";
import { toast } from "sonner";

export default function OrganizationAdminDashboard() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg } = useAuthStore();
  const { repositories, projects, gitEvents } = useProjectStore();

  const [activeTab, setActiveTab] = useState<"members" | "repositories" | "teams" | "activity">("members");
  const [memberships, setMemberships] = useState(SEEDED_MEMBERSHIPS);
  const [repoList, setRepoList] = useState(repositories);

  // Repository Connect Dialog
  const [isConnectRepoOpen, setIsConnectRepoOpen] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoOwner, setNewRepoOwner] = useState("acme-health");

  const handleToggleMember = (membershipId: string) => {
    setMemberships(
      memberships.map((m) =>
        m.id === membershipId
          ? { ...m, status: m.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }
          : m
      )
    );
    toast.info("Member status toggled. Scoped permissions updated immediately.");
  };

  const handleConnectRepo = (e: React.FormEvent) => {
    e.preventDefault();
    const newRepo = {
      id: `repo-${Date.now()}`,
      orgId,
      name: newRepoName,
      owner: newRepoOwner,
      providerRepoId: `gh-${Math.floor(Math.random() * 9000000 + 1000000)}`,
      installationId: "inst-90123",
      defaultBranch: "main",
      syncStatus: "SYNCED" as const,
      lastSuccessfulSync: new Date().toISOString(),
      linkedProjectIds: ["proj-structured-cds"],
    };
    setRepoList([...repoList, newRepo]);
    setIsConnectRepoOpen(false);
    setNewRepoName("");
    toast.success(`GitHub repository ${newRepoOwner}/${newRepoName} linked to workspace.`);
  };

  const handleDisconnectRepo = (repoId: string) => {
    setRepoList(repoList.filter((r) => r.id !== repoId));
    toast.warning("Repository unlinked from organization. Future sync events will be rejected.");
  };

  return (
    <PanelLayout
      title="Organization Administration"
      breadcrumb={[{ label: currentOrg.name }, { label: "Admin Panel" }]}
    >
      <div className="space-y-6">
        {/* Admin Boundary Notice */}
        <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-app-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span className="text-app-text-secondary">
              <strong>Admin Scope:</strong> Manage memberships, teams, and permitted GitHub repositories. Ownership transfer and platform operations are restricted to Org Owner and Super Admin.
            </span>
          </div>
          <Button size="sm" onClick={() => setIsConnectRepoOpen(true)}>
            <GitPullRequest className="w-3.5 h-3.5 mr-1" /> Connect GitHub Repo
          </Button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-app-border space-x-4">
          <button
            onClick={() => setActiveTab("members")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "members"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Members &amp; Role Assignments ({memberships.length})
          </button>
          <button
            onClick={() => setActiveTab("repositories")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "repositories"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Connected Repositories ({repoList.length})
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "activity"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Engineering Activity Stream ({gitEvents.length})
          </button>
        </div>

        {/* Tab 1: Members */}
        {activeTab === "members" && (
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Assigned Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.map((m) => {
                  const user = SEEDED_USERS.find((u) => u.id === m.userId);
                  const isOwner = m.role === "ORGANIZATION_OWNER";
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-semibold text-xs">{user?.name}</TableCell>
                      <TableCell className="text-xs text-app-text-secondary">{user?.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{m.role.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.status === "ACTIVE" ? "success" : "danger"}>
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!isOwner ? (
                          <Button
                            size="sm"
                            variant={m.status === "ACTIVE" ? "outline" : "primary"}
                            onClick={() => handleToggleMember(m.id)}
                          >
                            {m.status === "ACTIVE" ? "Disable Access" : "Re-enable"}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-app-text-muted">Primary Owner</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Tab 2: Repositories */}
        {activeTab === "repositories" && (
          <div className="space-y-4">
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repository</TableHead>
                    <TableHead>Default Branch</TableHead>
                    <TableHead>Sync Status</TableHead>
                    <TableHead>Last Successful Sync</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repoList.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold font-mono text-xs text-blue-600">
                        {r.owner}/{r.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.defaultBranch}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.syncStatus === "SYNCED"
                              ? "success"
                              : r.syncStatus === "FAILED"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {r.syncStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-app-text-muted">
                        {r.lastSuccessfulSync ? new Date(r.lastSuccessfulSync).toLocaleString() : "None"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDisconnectRepo(r.id)}
                        >
                          Disconnect
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* Tab 3: Git Events Feed */}
        {activeTab === "activity" && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-app-border">
              <CardTitle className="text-sm">Verified GitHub Activity Feed</CardTitle>
              <span className="text-xs text-app-text-muted">
                Blueprint Rule: Commits &amp; PRs are evidence only; they do not increment completion.
              </span>
            </div>

            <div className="space-y-3">
              {gitEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-lg border border-app-border bg-app-sidebar/40 text-xs flex items-start justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{evt.type}</Badge>
                      <span className="font-semibold text-app-text-primary">{evt.title}</span>
                      {evt.linkedTaskKey && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-mono text-[10px] font-bold">
                          {evt.linkedTaskKey}
                        </span>
                      )}
                    </div>
                    <p className="text-app-text-secondary">{evt.detail}</p>
                    <div className="text-[10px] text-app-text-muted">
                      Repo: {evt.repoName} • Actor: {evt.actor}
                    </div>
                  </div>
                  <span className="text-[10px] text-app-text-muted shrink-0 ml-4">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Connect Repo Dialog */}
      <Dialog
        isOpen={isConnectRepoOpen}
        onClose={() => setIsConnectRepoOpen(false)}
        title="Connect GitHub Repository"
        description="Link an authorized repository from your GitHub App installation to this organization."
      >
        <form onSubmit={handleConnectRepo} className="space-y-4 pt-2">
          <Input
            label="Repository Owner / Organization"
            value={newRepoOwner}
            onChange={(e) => setNewRepoOwner(e.target.value)}
            required
          />

          <Input
            label="Repository Name"
            value={newRepoName}
            onChange={(e) => setNewRepoName(e.target.value)}
            placeholder="e.g. core-auth-service"
            required
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsConnectRepoOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Connect Repository</Button>
          </div>
        </form>
      </Dialog>
    </PanelLayout>
  );
}

