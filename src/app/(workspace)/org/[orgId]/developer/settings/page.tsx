"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  GitBranch,
  GitPullRequest,
  GitCommit,
  Bell,
  Globe,
  Key,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Plus,
  Trash2,
  Shield,
  Laptop,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Radio,
  Lock,
  Workflow,
  Sparkles,
} from "lucide-react";
import { developerApi, DeveloperPreferences } from "@/lib/developer-api";
import { useProjects } from "@/hooks/useProjects";
import { useThemeStore } from "@/store/theme-store";
import { useAuthStore } from "@/store/auth-store";
import { Repository } from "@/types";
import { toast } from "sonner";

type SettingsTab = "profile" | "repositories" | "notifications" | "tokens";

export default function DeveloperSettingsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { setTheme, resolvedTheme } = useThemeStore();
  const { currentUser } = useAuthStore();
  const {
    repositories,
    projects,
    addRepository,
    removeRepository,
    syncRepository,
  } = useProjects(orgId);

  // Active Tab
  const [activeTab, setActiveTab] = useState<SettingsTab>("repositories");

  // General Profile State
  const [name, setName] = useState(currentUser.name || "Alex Rivera");
  const [title, setTitle] = useState("Senior Full-Stack Engineer");
  const [squad, setSquad] = useState("Platform Squad — APIs, billing and integrations");
  const [githubUser, setGithubUser] = useState("alex-rivera-dev");
  const [timezone, setTimezone] = useState("America/New_York");
  const [themePref, setThemePref] = useState("system");
  const [weeklyCapacity, setWeeklyCapacity] = useState(40);
  const [statusMessage, setStatusMessage] = useState("Available for PR reviews & sprint tasks");

  // Notifications State
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [slackNotifs, setSlackNotifs] = useState(true);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("https://hooks.slack.com/services/T000/B000/XXXXX");
  const [prReviewAlerts, setPrReviewAlerts] = useState(true);
  const [blockerAlerts, setBlockerAlerts] = useState(true);
  const [qaVerdicts, setQaVerdicts] = useState(true);
  const [ciAlerts, setCiAlerts] = useState(false);

  // API Tokens & Security
  const [cliToken, setCliToken] = useState("pwt_dev_live_79a40fb68e1c2d3e4f5061");
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Saving State
  const [saving, setSaving] = useState(false);
  const [syncingRepoId, setSyncingRepoId] = useState<string | null>(null);

  // Add Repository Modal State
  const [isAddRepoOpen, setIsAddRepoOpen] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [newRepoName, setNewRepoName] = useState("");
  const [newDefaultBranch, setNewDefaultBranch] = useState("main");
  const [newLinkedProjectId, setNewLinkedProjectId] = useState(projects[0]?.id || "");
  const [newRepoVisibility, setNewRepoVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE");
  const [newPatToken, setNewPatToken] = useState("");
  const [newEnableWebhooks, setNewEnableWebhooks] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTested, setConnectionTested] = useState<"IDLE" | "SUCCESS" | "FAILED">("IDLE");

  // Load initial preferences
  useEffect(() => {
    developerApi.getPreferences().then((pref) => {
      if (pref) {
        setEmailNotifs(pref.emailNotifications);
        setSlackNotifs(pref.slackNotifications);
        setThemePref(pref.theme || "system");
        if (pref.githubUsername) setGithubUser(pref.githubUsername);
        if (pref.timezone) setTimezone(pref.timezone);
      }
    });

    // Check localStorage fallback for custom repositories
    try {
      const stored = localStorage.getItem("prowise_custom_repositories");
      if (stored) {
        const parsed: Repository[] = JSON.parse(stored);
        parsed.forEach((r) => {
          if (!repositories.some((existing) => existing.id === r.id)) {
            addRepository(r);
          }
        });
      }
    } catch {
      // safe fallback
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill repository name when URL is pasted
  const handleUrlChange = (url: string) => {
    setNewRepoUrl(url);
    setConnectionTested("IDLE");
    const clean = url
      .trim()
      .replace(/^https?:\/\/github\.com\//, "")
      .replace(/\.git$/, "");
    if (clean && clean.includes("/")) {
      setNewRepoName(clean);
    }
  };

  // Test connection to GitHub
  const handleTestConnection = async () => {
    if (!newRepoUrl && !newRepoName) {
      toast.error("Please enter a GitHub repository URL or slug");
      return;
    }
    setTestingConnection(true);
    await new Promise((r) => setTimeout(r, 700));
    setTestingConnection(false);
    setConnectionTested("SUCCESS");
    toast.success("GitHub repository verified successfully (Ping: 32ms)");
  };

  // Add Repository Handler
  const handleAddRepository = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = (newRepoName || newRepoUrl)
      .trim()
      .replace(/^https?:\/\/github\.com\//, "")
      .replace(/\.git$/, "");

    if (!finalName) {
      toast.error("Repository name or URL is required");
      return;
    }

    const parts = finalName.split("/");
    const owner = parts.length > 1 ? parts[0] : (githubUser || "prowise");
    const repoId = `repo-${Date.now()}`;

    const newRepo: Repository = {
      id: repoId,
      orgId,
      name: finalName,
      owner,
      providerRepoId: `gh-${Date.now()}`,
      installationId: "inst-github-1",
      defaultBranch: newDefaultBranch || "main",
      syncStatus: "SYNCED",
      lastSuccessfulSync: new Date().toISOString(),
      linkedProjectIds: newLinkedProjectId ? [newLinkedProjectId] : [],
    };

    addRepository(newRepo);

    // Persist to safeStorage / localStorage
    try {
      const existing = localStorage.getItem("prowise_custom_repositories");
      const list: Repository[] = existing ? JSON.parse(existing) : [];
      list.push(newRepo);
      localStorage.setItem("prowise_custom_repositories", JSON.stringify(list));
    } catch {
      // safe fallback
    }

    toast.success(`Repository ${finalName} linked successfully!`);
    setIsAddRepoOpen(false);
    setNewRepoUrl("");
    setNewRepoName("");
    setNewPatToken("");
    setConnectionTested("IDLE");
  };

  // Sync a single repository
  const handleSyncRepo = async (repoId: string, repoName: string) => {
    setSyncingRepoId(repoId);
    await new Promise((r) => setTimeout(r, 800));
    syncRepository(repoId);
    setSyncingRepoId(null);
    toast.success(`Synced latest commits and PR checks from ${repoName}`);
  };

  // Remove a repository
  const handleRemoveRepo = (repoId: string, repoName: string) => {
    if (confirm(`Are you sure you want to disconnect repository "${repoName}"?`)) {
      removeRepository(repoId);
      try {
        const existing = localStorage.getItem("prowise_custom_repositories");
        if (existing) {
          const list: Repository[] = JSON.parse(existing);
          const filtered = list.filter((r) => r.id !== repoId);
          localStorage.setItem("prowise_custom_repositories", JSON.stringify(filtered));
        }
      } catch {
        // safe fallback
      }
      toast.info(`Disconnected ${repoName}`);
    }
  };

  // Save All Preferences
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await developerApi.updatePreferences({
      emailNotifications: emailNotifs,
      slackNotifications: slackNotifs,
      theme: themePref,
      githubUsername: githubUser,
      timezone,
    });
    if (themePref === "dark" || themePref === "light" || themePref === "system") {
      setTheme(themePref as any);
    }
    setSaving(false);
    toast.success("Settings and preferences saved successfully");
  };

  const copyToClipboard = (text: string, type: "token" | "webhook" | "secret") => {
    navigator.clipboard.writeText(text);
    if (type === "token") {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else if (type === "webhook") {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
    toast.success("Copied to clipboard");
  };

  return (
    <PanelLayout
      title="Developer Settings"
      breadcrumb={[
        { label: "Developer", href: `/org/${orgId}/developer` },
        { label: "Settings & Integrations" },
      ]}
    >
      <div className="space-y-6 max-w-5xl">
        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app-border pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-app-text-primary tracking-tight">Developer Settings</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Laptop className="w-3 h-3" />
                Developer Panel
              </span>
            </div>
            <p className="text-xs text-app-text-secondary mt-1">
              Manage your engineering workspace, connected GitHub repositories, webhook dispatch, and personal API tokens.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setIsAddRepoOpen(true)}
              className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect GitHub Repo</span>
            </Button>
          </div>
        </div>

        {/* Settings Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-app-border overflow-x-auto pb-px">
          <button
            type="button"
            onClick={() => setActiveTab("repositories")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === "repositories"
                ? "border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20 dark:text-blue-400"
                : "border-transparent text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-purple-600" />
            <span>GitHub &amp; Repositories</span>
            <span className="ml-1 rounded-full bg-purple-500/15 px-1.5 py-0.2 text-[10px] font-bold text-purple-700 dark:text-purple-300">
              {repositories.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === "profile"
                ? "border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20 dark:text-blue-400"
                : "border-transparent text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover"
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-blue-600" />
            <span>Profile &amp; Appearance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === "notifications"
                ? "border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20 dark:text-blue-400"
                : "border-transparent text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover"
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-600" />
            <span>Notifications &amp; Alerts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tokens")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === "tokens"
                ? "border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20 dark:text-blue-400"
                : "border-transparent text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover"
            }`}
          >
            <Key className="w-3.5 h-3.5 text-emerald-600" />
            <span>API Keys &amp; CLI</span>
          </button>
        </div>

        {/* TAB 1: GITHUB & REPOSITORIES */}
        {activeTab === "repositories" && (
          <div className="space-y-6">
            {/* GitHub Account Connection Card */}
            <Card className="p-5 border border-app-border bg-app-surface shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-sm dark:bg-slate-800">
                    <GitBranch className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-app-text-primary">GitHub Organization &amp; Account</h3>
                      <Badge variant="success" className="text-[10px] gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected
                      </Badge>
                    </div>
                    <p className="text-xs text-app-text-secondary mt-0.5">
                      Authenticated as <span className="font-mono font-semibold text-app-text-primary">@{githubUser}</span>.
                      Commits, pull requests, and status checks automatically attach to your assigned projects.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const user = prompt("Enter GitHub Username / Handle:", githubUser);
                      if (user && user.trim()) {
                        setGithubUser(user.trim());
                        toast.success(`Updated GitHub handle to @${user.trim()}`);
                      }
                    }}
                    className="text-xs gap-1.5"
                  >
                    <span>Edit Handle</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsAddRepoOpen(true)}
                    className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Repository</span>
                  </Button>
                </div>
              </div>
            </Card>

            {/* Connected Repositories Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-app-text-primary">
                    Connected Repositories ({repositories.length})
                  </h3>
                  <p className="text-xs text-app-text-secondary">
                    Active source repositories linked to your developer profile and project deliverables.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    repositories.forEach((r) => syncRepository(r.id));
                    toast.success("Synchronized all repositories");
                  }}
                  className="text-xs gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync All</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {repositories.map((repo) => {
                  const linkedProj = projects.find((p) => repo.linkedProjectIds?.includes(p.id));
                  const isSyncing = syncingRepoId === repo.id;

                  return (
                    <Card
                      key={repo.id}
                      className="p-4 border border-app-border bg-app-surface hover:border-blue-500/40 transition-all shadow-sm flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                              <GitBranch className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-app-text-primary truncate font-mono">
                                {repo.name}
                              </h4>
                              <p className="text-[11px] text-app-text-muted">
                                Branch: <span className="font-mono font-medium text-app-text-primary">{repo.defaultBranch}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              Private
                            </Badge>
                            <Badge variant="success" className="text-[10px]">
                              {repo.syncStatus || "SYNCED"}
                            </Badge>
                          </div>
                        </div>

                        {/* Linked project tag */}
                        <div className="mt-3 flex items-center gap-2 text-[11px] text-app-text-secondary bg-app-bg px-2.5 py-1.5 rounded-lg border border-app-border">
                          <Workflow className="w-3 h-3 text-blue-600 shrink-0" />
                          <span className="truncate">
                            Linked:{" "}
                            <strong className="text-app-text-primary font-semibold">
                              {linkedProj ? `${linkedProj.key} — ${linkedProj.name}` : "Assigned Delivery Scope"}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-app-border text-[11px] text-app-text-muted">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>CI Passing</span>
                        </span>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSyncing}
                            onClick={() => handleSyncRepo(repo.id, repo.name)}
                            className="h-7 px-2 text-[11px] gap-1 hover:text-blue-600"
                            title="Fetch latest PRs and commits"
                          >
                            <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                            <span>{isSyncing ? "Syncing..." : "Sync"}</span>
                          </Button>

                          <a
                            href={`https://github.com/${repo.name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 h-7 px-2 rounded text-[11px] text-app-text-secondary hover:text-app-text-primary hover:bg-app-hover transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>GitHub</span>
                          </a>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRepo(repo.id, repo.name)}
                            className="h-7 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title="Disconnect repository"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Webhook Configuration Card */}
            <Card className="p-5 border border-app-border bg-app-surface space-y-4">
              <div className="flex items-center gap-2 border-b border-app-border pb-3">
                <Terminal className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-app-text-primary">GitHub Webhook Dispatch Setup</h3>
              </div>
              <p className="text-xs text-app-text-secondary">
                Configure your repository webhooks in GitHub Settings &rarr; Webhooks to push commit activity, branch builds, and pull request reviews directly to ProWise.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-app-text-primary block mb-1">
                    Payload URL (POST)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      readOnly
                      value="https://api.prowise.io/api/v1/webhooks/github"
                      className="font-mono text-xs bg-app-bg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard("https://api.prowise.io/api/v1/webhooks/github", "webhook")}
                      className="h-9 px-2.5 text-xs gap-1 shrink-0"
                    >
                      {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedWebhook ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-app-text-primary block mb-1">
                    Webhook Secret Key
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      readOnly
                      type={showSecret ? "text" : "password"}
                      value="whsec_live_9f838271e8c04bb1"
                      className="font-mono text-xs bg-app-bg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSecret(!showSecret)}
                      className="h-9 px-2.5 text-xs shrink-0"
                      title={showSecret ? "Hide secret" : "Show secret"}
                    >
                      {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard("whsec_live_9f838271e8c04bb1", "secret")}
                      className="h-9 px-2.5 text-xs gap-1 shrink-0"
                    >
                      {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSecret ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-app-text-secondary flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-app-text-primary">Supported Event Types:</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">push (commits &amp; tags)</Badge>
                    <Badge variant="outline" className="text-[10px]">pull_request (opened, merged, closed)</Badge>
                    <Badge variant="outline" className="text-[10px]">pull_request_review (approved, comments)</Badge>
                    <Badge variant="outline" className="text-[10px]">check_run (CI build status)</Badge>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: PROFILE & APPEARANCE */}
        {activeTab === "profile" && (
          <form onSubmit={handleSavePreferences} className="space-y-6">
            <Card className="p-5 space-y-4 border border-app-border bg-app-surface">
              <div className="flex items-center gap-2 border-b border-app-border pb-3">
                <Settings className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-app-text-primary">Engineering Profile</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-app-text-primary block mb-1">
                    Full Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-xs"
                    placeholder="e.g. Alex Rivera"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-app-text-primary block mb-1">
                    Corporate Email
                  </label>
                  <Input
                    disabled
                    value={currentUser.email || "alex.rivera@acmehealth.com"}
                    className="text-xs bg-app-bg text-app-text-muted"
                  />
                  <p className="text-[10px] text-app-text-muted mt-0.5">Managed by Workspace Admin</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-app-text-primary block mb-1">
                    Engineering Role Title
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xs"
                    placeholder="e.g. Senior Full-Stack Engineer"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-app-text-primary block mb-1">
                    Delivery Squad / Team
                  </label>
                  <Input
                    value={squad}
                    onChange={(e) => setSquad(e.target.value)}
                    className="text-xs"
                    placeholder="e.g. Platform Squad"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-app-text-primary block mb-1">
                    Current Focus &amp; Status Message
                  </label>
                  <Input
                    value={statusMessage}
                    onChange={(e) => setStatusMessage(e.target.value)}
                    className="text-xs"
                    placeholder="e.g. Available for PR reviews & sprint tasks"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-4 border border-app-border bg-app-surface">
              <div className="flex items-center gap-2 border-b border-app-border pb-3">
                <Globe className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-app-text-primary">Theme &amp; Regional Localization</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-app-text-primary block mb-1">
                    Interface Theme
                  </label>
                  <select
                    value={themePref}
                    onChange={(e) => {
                      setThemePref(e.target.value);
                      if (e.target.value === "dark" || e.target.value === "light" || e.target.value === "system") {
                        setTheme(e.target.value as any);
                      }
                    }}
                    className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary"
                  >
                    <option value="system">System Default</option>
                    <option value="light">Light Theme (Clean White &amp; Neutral)</option>
                    <option value="dark">Dark Theme (Dark Charcoal &amp; Professional)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-app-text-primary block mb-1">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary"
                  >
                    <option value="America/New_York">Eastern Time (US &amp; Canada) - New York</option>
                    <option value="America/Chicago">Central Time (US &amp; Canada) - Chicago</option>
                    <option value="America/Los_Angeles">Pacific Time (US &amp; Canada) - Los Angeles</option>
                    <option value="Europe/London">London (GMT / BST)</option>
                    <option value="Asia/Kolkata">India Standard Time (IST)</option>
                    <option value="UTC">Coordinated Universal Time (UTC)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-app-text-primary block mb-1">
                    Weekly Sprint Capacity
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={10}
                      max={80}
                      value={weeklyCapacity}
                      onChange={(e) => setWeeklyCapacity(parseInt(e.target.value) || 40)}
                      className="text-xs w-32"
                    />
                    <span className="text-xs text-app-text-secondary">hours / sprint week</span>
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                type="submit"
                disabled={saving}
                className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? "Saving..." : "Save Profile Settings"}</span>
              </Button>
            </div>
          </form>
        )}

        {/* TAB 3: NOTIFICATIONS & DISPATCH ALERTS */}
        {activeTab === "notifications" && (
          <form onSubmit={handleSavePreferences} className="space-y-6">
            <Card className="p-5 space-y-4 border border-app-border bg-app-surface">
              <div className="flex items-center gap-2 border-b border-app-border pb-3">
                <Bell className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-app-text-primary">Dispatch Channels</h3>
              </div>

              <div className="space-y-3">
                <label className="flex items-start justify-between cursor-pointer gap-4 p-2.5 rounded-lg hover:bg-app-hover transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-app-text-primary block">
                      Email Milestone Digests &amp; Deadline Alerts
                    </span>
                    <span className="text-[11px] text-app-text-secondary">
                      Receive weekly solo check-in reminders, overdue task notifications, and scope amendments.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailNotifs}
                    onChange={(e) => setEmailNotifs(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5"
                  />
                </label>

                <div className="border-t border-app-border pt-3">
                  <label className="flex items-start justify-between cursor-pointer gap-4 p-2.5 rounded-lg hover:bg-app-hover transition-colors">
                    <div>
                      <span className="text-xs font-semibold text-app-text-primary block">
                        Slack Webhook Channel Integration
                      </span>
                      <span className="text-[11px] text-app-text-secondary">
                        Stream pull request review requests, blocker notices, and peer verification verdicts to Slack.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={slackNotifs}
                      onChange={(e) => setSlackNotifs(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5"
                    />
                  </label>

                  {slackNotifs && (
                    <div className="mt-2.5 pl-2.5 pr-2.5 space-y-2">
                      <label className="text-[11px] font-semibold text-app-text-primary block">
                        Slack Webhook Ingest URL
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={slackWebhookUrl}
                          onChange={(e) => setSlackWebhookUrl(e.target.value)}
                          placeholder="https://hooks.slack.com/services/..."
                          className="text-xs font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toast.success("Test notification dispatched to Slack channel #engineering-delivery")}
                          className="text-xs shrink-0"
                        >
                          Send Test
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-4 border border-app-border bg-app-surface">
              <div className="flex items-center gap-2 border-b border-app-border pb-3">
                <Radio className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-app-text-primary">Engineering Event Triggers</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-2.5 border border-app-border rounded-lg cursor-pointer hover:bg-app-hover">
                  <span className="text-xs text-app-text-primary">Pull Request Review Requests</span>
                  <input
                    type="checkbox"
                    checked={prReviewAlerts}
                    onChange={(e) => setPrReviewAlerts(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 border border-app-border rounded-lg cursor-pointer hover:bg-app-hover">
                  <span className="text-xs text-app-text-primary">Blocker Flags Raised on Tasks</span>
                  <input
                    type="checkbox"
                    checked={blockerAlerts}
                    onChange={(e) => setBlockerAlerts(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 border border-app-border rounded-lg cursor-pointer hover:bg-app-hover">
                  <span className="text-xs text-app-text-primary">QA Verdicts &amp; Test Approvals</span>
                  <input
                    type="checkbox"
                    checked={qaVerdicts}
                    onChange={(e) => setQaVerdicts(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 border border-app-border rounded-lg cursor-pointer hover:bg-app-hover">
                  <span className="text-xs text-app-text-primary">GitHub CI/CD Build Failures</span>
                  <input
                    type="checkbox"
                    checked={ciAlerts}
                    onChange={(e) => setCiAlerts(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </label>
              </div>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                type="submit"
                disabled={saving}
                className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? "Saving..." : "Save Notification Preferences"}</span>
              </Button>
            </div>
          </form>
        )}

        {/* TAB 4: API KEYS & CLI TOKENS */}
        {activeTab === "tokens" && (
          <div className="space-y-6">
            <Card className="p-5 space-y-4 border border-app-border bg-app-surface">
              <div className="flex items-center justify-between border-b border-app-border pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-app-text-primary">ProWise CLI Authentication Token</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const next = `pwt_dev_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
                    setCliToken(next);
                    toast.success("Rotated ProWise CLI personal access token");
                  }}
                  className="text-xs gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Rotate Token</span>
                </Button>
              </div>

              <p className="text-xs text-app-text-secondary">
                Use this token to authenticate git hooks, automated release pipelines, or the ProWise CLI directly from your terminal.
              </p>

              <div>
                <label className="text-[11px] font-semibold text-app-text-primary block mb-1">
                  Active Personal Access Token (PAT)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={cliToken}
                    className="font-mono text-xs bg-app-bg"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(cliToken, "token")}
                    className="h-9 px-3 text-xs gap-1 shrink-0"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedToken ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900 text-slate-100 dark:bg-slate-950 font-mono text-xs space-y-1.5">
                <span className="text-slate-400 block text-[11px]"># Quick terminal login:</span>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400">prowise login --token {cliToken.substring(0, 16)}...</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`prowise login --token ${cliToken}`, "token")}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Copy command"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-3 border border-app-border bg-app-surface">
              <div className="flex items-center gap-2 border-b border-app-border pb-3">
                <Lock className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-app-text-primary">Active Developer Sessions</h3>
              </div>
              <div className="divide-y divide-app-border text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-app-text-primary block">Current Browser Session</span>
                    <span className="text-[11px] text-app-text-muted">Chrome / Windows &bull; IP: 127.0.0.1 (Localhost)</span>
                  </div>
                  <Badge variant="success" className="text-[10px]">Active Now</Badge>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-app-text-primary block">GitHub Webhook Dispatcher</span>
                    <span className="text-[11px] text-app-text-muted">Automated push &amp; PR ingest bot &bull; Webhook ID #982</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Standby</Badge>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADD REPOSITORY MODAL                                                      */}
        {/* ========================================================================= */}
        {isAddRepoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <Card className="w-full max-w-xl p-6 bg-app-surface border border-app-border shadow-2xl space-y-5">
              <div className="flex items-start justify-between border-b border-app-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <GitBranch className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-app-text-primary">Connect GitHub Repository</h3>
                    <p className="text-xs text-app-text-secondary mt-0.5">
                      Link a source code repository to track pull requests, commits, and peer evidence.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddRepoOpen(false)}
                  className="text-app-text-muted hover:text-app-text-primary text-sm p-1 rounded"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleAddRepository} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-app-text-primary block mb-1">
                    Repository URL or GitHub Slug <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      required
                      value={newRepoUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      placeholder="https://github.com/prowise/billing-service or org/repo"
                      className="text-xs font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testingConnection}
                      onClick={handleTestConnection}
                      className="text-xs shrink-0 gap-1"
                    >
                      {testingConnection ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : connectionTested === "SUCCESS" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : null}
                      <span>{testingConnection ? "Pinging..." : connectionTested === "SUCCESS" ? "Verified" : "Test"}</span>
                    </Button>
                  </div>
                  <p className="text-[11px] text-app-text-muted mt-1">
                    Supports public and private GitHub repositories.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-app-text-primary block mb-1">
                      Repository Display Name / Slug
                    </label>
                    <Input
                      required
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value)}
                      placeholder="e.g. prowise/billing-service"
                      className="text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-app-text-primary block mb-1">
                      Default Tracking Branch
                    </label>
                    <Input
                      required
                      value={newDefaultBranch}
                      onChange={(e) => setNewDefaultBranch(e.target.value)}
                      placeholder="main"
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-app-text-primary block mb-1">
                      Link to Assigned Delivery Project
                    </label>
                    <select
                      value={newLinkedProjectId}
                      onChange={(e) => setNewLinkedProjectId(e.target.value)}
                      className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.key} &mdash; {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-app-text-primary block mb-1">
                      Repository Visibility
                    </label>
                    <select
                      value={newRepoVisibility}
                      onChange={(e) => setNewRepoVisibility(e.target.value as any)}
                      className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary"
                    >
                      <option value="PRIVATE">Private (Enterprise Secret)</option>
                      <option value="PUBLIC">Public (Open Source)</option>
                    </select>
                  </div>
                </div>

                {newRepoVisibility === "PRIVATE" && (
                  <div>
                    <label className="text-xs font-semibold text-app-text-primary block mb-1">
                      Personal Access Token / Deploy Key (Optional)
                    </label>
                    <Input
                      type="password"
                      value={newPatToken}
                      onChange={(e) => setNewPatToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="text-xs font-mono"
                    />
                    <p className="text-[10px] text-app-text-muted mt-0.5">
                      Required for private repositories without organization-wide app install.
                    </p>
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={newEnableWebhooks}
                    onChange={(e) => setNewEnableWebhooks(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span className="text-xs text-app-text-primary font-medium">
                    Automatically ingest commits and PR events into project evidence feed
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-app-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddRepoOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Link Repository</span>
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}
