"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, ExternalLink, GitBranch, GitCommit, GitPullRequest, Github, Link2Off, Lock, Plug, RefreshCw,
  Search, Unlock, XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AdminButton, AdminInput, AdminSelect, EmptyStateView, PageFrame, Panel, StatusBadge } from "@/components/delivery/DeliveryUI";
import { SectionGate, changeError, dateTimeText } from "@/components/developer/DevUI";
import { apiClient } from "@/lib/api";
import type {
  GitHubAppStatusDto, GitHubChoiceDto, GitHubConnectionDto, GitHubFeedItemDto, GitHubFeedQuery, GitHubInstallationDto,
  GitHubRepoChoiceDto, GitHubTarget, GitHubValidationDto, SyncResultDto,
} from "@/types/flow";
import { useFlowMutation, useGitHubApp, useGitHubBranches, useGitHubFeed, useGitHubRepositories } from "./useFlowApi";

/**
 * GitHub through the Prowise GitHub App. An Owner/Admin connects GitHub once for the organization (installs the App);
 * afterwards whoever may connect a project's repository (its creator, its PM, Owner/Admin) picks a repository and a
 * branch, sees the checks, and connects. Commits and pull requests are evidence only: they never complete tasks or
 * change progress.
 */

const STATE_KEY = "prowise.github.install";

/** Sends the browser to GitHub to install the App; the one-time state is kept for the callback page. */
export async function startGitHubInstall(orgId: string, returnTo: string) {
  const { install_url } = await apiClient.flow.githubApp.startInstall(orgId, returnTo);
  try {
    const state = new URL(install_url).searchParams.get("state");
    if (state) sessionStorage.setItem(STATE_KEY, JSON.stringify({ state, orgId, returnTo }));
  } catch {
    // Without storage the state still travels on the GitHub redirect.
  }
  window.location.assign(install_url);
}

/* ================================================================== organization: Integrations page */

export function OrgIntegrationsView({ orgId, family }: { orgId: string; family: "owner" | "admin" }) {
  const home = `/org/${orgId}/${family}`;
  return (
    <PageFrame crumbs={[{ label: family === "owner" ? "Owner" : "Admin", href: `${home}/dashboard` }, { label: "Integrations" }]}
      title="Integrations" description="Connect GitHub for the organization. Each project then gets its own repository.">
      <OrgGitHubIntegration orgId={orgId} returnTo={`${home}/integrations`} />
    </PageFrame>
  );
}

export function OrgGitHubIntegration({ orgId, returnTo }: { orgId: string; returnTo: string }) {
  const status = useGitHubApp(orgId);
  return (
    <Panel title="GitHub" icon={Github} iconTone="violet"
      description="Connect GitHub once for the organization. Managers then pick a repository for each project. Activity is evidence only; it never changes progress.">
      <SectionGate state={status} what="the GitHub connection">
        {(s) => <OrgGitHubBody orgId={orgId} status={s} returnTo={returnTo} />}
      </SectionGate>
    </Panel>
  );
}

function OrgGitHubBody({ orgId, status, returnTo }: { orgId: string; status: GitHubAppStatusDto; returnTo: string }) {
  const [starting, setStarting] = useState(false);
  const connect = () => {
    setStarting(true);
    startGitHubInstall(orgId, returnTo).catch((e) => { setStarting(false); toast.error(changeError(e)); });
  };
  if (!status.configured) {
    return (
      <div className="space-y-2 text-xs" data-testid="github-not-configured">
        <p className="flex items-center gap-2 font-medium"><AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" /> The Prowise GitHub App is not set up on this server yet.</p>
        <p className="text-[var(--color-text-muted)]">
          A platform administrator sets GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET,
          GITHUB_APP_PRIVATE_KEY and GITHUB_APP_WEBHOOK_SECRET on the backend (see backend/.env.example).
        </p>
      </div>
    );
  }
  const active = status.installations;
  return (
    <div className="space-y-4 text-xs">
      {active.length === 0 ? (
        <EmptyStateView icon={Plug} title="GitHub is not connected"
          description={status.can_manage
            ? "Install the Prowise GitHub App on your GitHub organization or account and choose which repositories it may read."
            : "An Owner or Admin connects GitHub for the organization. Ask them to open Integrations."}
          actionLabel={status.can_manage ? (starting ? "Opening GitHub…" : "Connect GitHub") : undefined}
          onAction={status.can_manage && !starting ? connect : undefined} />
      ) : (
        <>
          <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="installations">
            {active.map((i) => <InstallationRow key={i.id} orgId={orgId} installation={i} canManage={status.can_manage} />)}
          </ul>
          {status.can_manage && (
            <AdminButton variant="outline" isLoading={starting} onClick={connect}>
              <Github className="w-3.5 h-3.5" /> Connect another GitHub account
            </AdminButton>
          )}
        </>
      )}
    </div>
  );
}

function InstallationRow({ orgId, installation, canManage }: { orgId: string; installation: GitHubInstallationDto; canManage: boolean }) {
  const remove = useFlowMutation(() => apiClient.flow.githubApp.remove(orgId, installation.id, installation.version));
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="font-semibold flex items-center gap-2">
          <Github className="w-4 h-4" aria-hidden="true" /> {installation.account}
          <StatusBadge label={installation.status === "ACTIVE" ? "Connected" : "Suspended on GitHub"}
            tone={installation.status === "ACTIVE" ? "success" : "warning"} dot />
        </p>
        <p className="text-[var(--color-text-muted)]">
          {installation.account_type} · {installation.repository_selection === "all" ? "All repositories" : "Selected repositories"} ·{" "}
          {installation.project_count} project{installation.project_count === 1 ? "" : "s"} · connected {dateTimeText(installation.connected_at)}
          {installation.connected_by ? ` by ${installation.connected_by}` : ""}
        </p>
      </div>
      <span className="flex gap-2">
        <a href={installation.manage_url} target="_blank" rel="noreferrer noopener"
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 hover:bg-[var(--color-hover)]">
          <ExternalLink className="w-3 h-3" aria-hidden="true" /> Choose repositories on GitHub
        </a>
        {canManage && (
          <AdminButton size="xs" variant="danger" isLoading={remove.isPending} onClick={() => {
            if (!window.confirm(`Remove ${installation.account} from Prowise? Its ${installation.project_count} project link(s) are disconnected; history stays.`)) return;
            remove.mutate(undefined, {
              onSuccess: () => toast.success(`${installation.account} removed. Uninstall the app on GitHub too if you no longer need it.`),
              onError: (e) => toast.error(changeError(e)),
            });
          }}>
            <Link2Off className="w-3 h-3" /> Remove
          </AdminButton>
        )}
      </span>
    </li>
  );
}

/* ================================================================== GitHub setup redirect */

/** /integrations/github/callback: GitHub sends the installer back here with installation_id, code and state. */
export function GitHubCallbackView() {
  const params = useSearchParams();
  const [result, setResult] = useState<{ kind: "working" } | { kind: "done"; account: string; returnTo: string | null }
    | { kind: "error"; message: string; returnTo: string | null }>({ kind: "working" });
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    let stored: { state?: string; returnTo?: string } = {};
    try {
      stored = JSON.parse(sessionStorage.getItem(STATE_KEY) ?? "{}");
    } catch {
      stored = {};
    }
    const state = params.get("state") || stored.state || "";
    const installationId = Number(params.get("installation_id"));
    const code = params.get("code") ?? "";
    const fallback = stored.returnTo ?? null;
    if (params.get("error")) {
      setResult({ kind: "error", message: "GitHub authorization was cancelled.", returnTo: fallback });
      return;
    }
    if (!state || !Number.isFinite(installationId) || installationId <= 0) {
      setResult({ kind: "error", message: "GitHub did not send the installation details. Start again from Integrations.", returnTo: fallback });
      return;
    }
    apiClient.flow.githubApp.complete({ state, installation_id: installationId, code, setup_action: params.get("setup_action") ?? undefined })
      .then((done) => {
        try { sessionStorage.removeItem(STATE_KEY); } catch { /* nothing stored */ }
        setResult({ kind: "done", account: done.account, returnTo: done.return_to ?? fallback });
      })
      .catch((e) => setResult({ kind: "error", message: changeError(e), returnTo: fallback }));
  }, [params]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-app-bg)] p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm space-y-3" aria-live="polite">
        <p className="flex items-center gap-2 font-semibold"><Github className="w-5 h-5" aria-hidden="true" /> Connect GitHub</p>
        {result.kind === "working" && <p className="text-[var(--color-text-muted)]">Checking the installation with GitHub…</p>}
        {result.kind === "done" && (
          <>
            <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="w-4 h-4" aria-hidden="true" /> GitHub account {result.account} is connected.</p>
            <p className="text-xs text-[var(--color-text-muted)]">Managers can now pick a repository for each project, while creating it or from the project.</p>
            {result.returnTo && <Link href={result.returnTo} className="inline-block rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Continue</Link>}
          </>
        )}
        {result.kind === "error" && (
          <>
            <p role="alert" className="flex items-start gap-2 text-rose-700 dark:text-rose-300"><XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> {result.message}</p>
            <Link href={result.returnTo ?? "/select-workspace"} className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline">Back to Prowise</Link>
          </>
        )}
      </div>
    </main>
  );
}

/* ================================================================== repository + branch picker */

type PickerStep = "account" | "repository" | "branch" | "confirm";

/**
 * Account → repository → branch → confirmation checks → connect. For a project the repository is connected (or
 * changed, with the current version) and recent activity imported; for a draft it is saved on the draft.
 */
export function GitHubRepoPicker({ orgId, target, expectedVersion, initial, onDone, onCancel, returnTo }: {
  orgId: string;
  target: GitHubTarget;
  expectedVersion?: number;
  initial?: { installationId?: string | null; repository?: string | null; branch?: string | null };
  /** Project: after connect. Draft: called with the choice to save on the draft. */
  onDone: (result: { choice: GitHubChoiceDto; validation: GitHubValidationDto; connection?: GitHubConnectionDto; imported?: SyncResultDto }) => void;
  onCancel?: () => void;
  returnTo: string;
}) {
  const status = useGitHubApp(orgId);
  return (
    <SectionGate state={status} what="GitHub">
      {(s) => <PickerBody orgId={orgId} status={s} target={target} expectedVersion={expectedVersion} initial={initial}
        onDone={onDone} onCancel={onCancel} returnTo={returnTo} />}
    </SectionGate>
  );
}

function PickerBody({ orgId, status, target, expectedVersion, initial, onDone, onCancel, returnTo }: {
  orgId: string; status: GitHubAppStatusDto; target: GitHubTarget; expectedVersion?: number;
  initial?: { installationId?: string | null; repository?: string | null; branch?: string | null };
  onDone: Parameters<typeof GitHubRepoPicker>[0]["onDone"]; onCancel?: () => void; returnTo: string;
}) {
  const installations = status.installations.filter((i) => i.status === "ACTIVE");
  const [installationId, setInstallationId] = useState<string>(initial?.installationId ?? (installations.length === 1 ? installations[0].id : ""));
  const [repository, setRepository] = useState<string>(initial?.repository ?? "");
  const [branch, setBranch] = useState<string>(initial?.branch ?? "");
  const [step, setStep] = useState<PickerStep>(installationId ? (repository ? "branch" : "repository") : "account");
  const [validation, setValidation] = useState<GitHubValidationDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const validate = useFlowMutation((body: GitHubChoiceDto) => apiClient.flow.githubApp.validate(target, body));
  const connect = useFlowMutation((body: GitHubChoiceDto) => "projectId" in target
    ? apiClient.flow.githubApp.connect(target.projectId, body) : Promise.resolve(null));

  if (!status.configured) {
    return <p className="text-xs text-[var(--color-text-muted)]" data-testid="github-not-configured">GitHub is not set up on this server yet. A platform administrator configures the Prowise GitHub App.</p>;
  }
  if (installations.length === 0) {
    return (
      <div className="space-y-3 text-xs" data-testid="github-org-not-connected">
        <p className="font-medium">GitHub is not connected for this organization yet.</p>
        {status.can_manage ? (
          <AdminButton isLoading={starting} onClick={() => {
            setStarting(true);
            startGitHubInstall(orgId, returnTo).catch((e) => { setStarting(false); setError(changeError(e)); });
          }}><Github className="w-3.5 h-3.5" /> Connect GitHub</AdminButton>
        ) : <p className="text-[var(--color-text-muted)]">Ask an Owner or Admin to connect GitHub (Integrations). You can continue without a repository and add it later.</p>}
        {error && <p role="alert" className="text-rose-600 dark:text-rose-400">{error}</p>}
        {onCancel && <AdminButton variant="ghost" onClick={onCancel}>Skip for now</AdminButton>}
      </div>
    );
  }

  const account = installations.find((i) => i.id === installationId);
  const choice: GitHubChoiceDto = { installation_id: installationId, repository, branch, ...(expectedVersion !== undefined ? { expected_version: expectedVersion } : {}) };
  const steps: { key: PickerStep; label: string }[] = [
    { key: "account", label: "Account" }, { key: "repository", label: "Repository" }, { key: "branch", label: "Branch" }, { key: "confirm", label: "Confirm" },
  ];
  const at = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-4 text-xs" data-testid="github-picker">
      <ol className="flex flex-wrap gap-2" aria-label="Connect repository steps">
        {steps.map((s, i) => (
          <li key={s.key} aria-current={s.key === step ? "step" : undefined}
            className={`rounded-full px-2.5 py-1 border ${i === at ? "border-blue-500 bg-blue-500/10 font-semibold" : i < at ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {step === "account" && (
        <fieldset className="space-y-2">
          <legend className="font-medium mb-1">GitHub organization or account</legend>
          {installations.map((i) => (
            <label key={i.id} className="flex items-center gap-2 rounded-md border border-[var(--color-border)] p-2 cursor-pointer hover:bg-[var(--color-hover)]">
              <input type="radio" name="github-account" checked={installationId === i.id} onChange={() => { setInstallationId(i.id); setRepository(""); setBranch(""); }} />
              <Github className="w-4 h-4" aria-hidden="true" /> <span className="font-medium">{i.account}</span>
              <span className="text-[var(--color-text-muted)]">{i.account_type}</span>
            </label>
          ))}
          <div className="flex justify-between gap-2 pt-1">
            {onCancel ? <AdminButton variant="ghost" onClick={onCancel}>Cancel</AdminButton> : <span />}
            <AdminButton disabled={!installationId} onClick={() => setStep("repository")}>Next: repository</AdminButton>
          </div>
        </fieldset>
      )}

      {step === "repository" && account && (
        <RepositoryList target={target} installation={account} selected={repository}
          onBack={() => setStep("account")}
          onPick={(repo) => { setRepository(repo.full_name); setBranch(repo.default_branch); setStep("branch"); }} />
      )}

      {step === "branch" && account && (
        <BranchChoice target={target} installationId={installationId} repository={repository} branch={branch} setBranch={setBranch}
          checking={validate.isPending} error={error}
          onBack={() => setStep("repository")}
          onNext={() => {
            setError(null);
            validate.mutate(choice, {
              onSuccess: (v) => { setValidation(v); setStep("confirm"); },
              onError: (e) => setError(changeError(e)),
            });
          }} />
      )}

      {step === "confirm" && validation && (
        <div className="space-y-3" data-testid="github-confirm">
          <div className="rounded-lg border border-[var(--color-border)] p-3 space-y-1">
            <p className="font-semibold flex items-center gap-2">
              {validation.private_repository ? <Lock className="w-3.5 h-3.5" aria-label="Private" /> : <Unlock className="w-3.5 h-3.5" aria-label="Public" />}
              <a href={validation.repository_url} target="_blank" rel="noreferrer noopener" className="text-blue-600 dark:text-blue-400 hover:underline">{validation.repository}</a>
            </p>
            <p className="text-[var(--color-text-muted)]">Account {validation.account} · branch <span className="font-mono">{validation.branch}</span> · default branch <span className="font-mono">{validation.default_branch}</span></p>
          </div>
          <ul className="space-y-1.5" aria-label="Checks">
            {validation.checks.map((c) => (
              <li key={c.key} className="flex items-start gap-2">
                {c.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-label="Passed" />
                  : c.required ? <XCircle className="w-4 h-4 text-rose-600 shrink-0" aria-label="Failed" />
                  : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" aria-label="Warning" />}
                <span><span className="font-medium">{c.label}</span> · <span className="text-[var(--color-text-muted)]">{c.detail}</span></span>
              </li>
            ))}
          </ul>
          <p className="text-[var(--color-text-muted)]">Commits and pull requests are imported as evidence. They never complete tasks or change progress.</p>
          {error && <p role="alert" className="text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex justify-between gap-2">
            <AdminButton variant="ghost" onClick={() => setStep("branch")}>Back</AdminButton>
            <AdminButton disabled={!validation.ok} isLoading={connect.isPending} onClick={() => {
              setError(null);
              if (!("projectId" in target)) return onDone({ choice, validation });
              connect.mutate(choice, {
                onSuccess: (result) => { if (result) onDone({ choice, validation, connection: result.connection, imported: result.imported }); },
                onError: (e) => setError(changeError(e)),
              });
            }}>{"projectId" in target ? "Connect Repository" : "Use this repository"}</AdminButton>
          </div>
        </div>
      )}
    </div>
  );
}

function RepositoryList({ target, installation, selected, onPick, onBack }: {
  target: GitHubTarget; installation: GitHubInstallationDto; selected: string;
  onPick: (repo: GitHubRepoChoiceDto) => void; onBack: () => void;
}) {
  const repositories = useGitHubRepositories(target, installation.id);
  const [filter, setFilter] = useState("");
  return (
    <div className="space-y-2">
      <AdminInput label="Find a repository" placeholder={`${installation.account}/…`} value={filter} onChange={(e) => setFilter(e.target.value)} />
      <SectionGate state={repositories} what="repositories">
        {(rows) => {
          const shown = rows.filter((r) => r.full_name.toLowerCase().includes(filter.trim().toLowerCase()));
          if (rows.length === 0) {
            return (
              <p className="text-[var(--color-text-muted)]" data-testid="no-repositories">
                The GitHub App cannot see any repository of {installation.account}.{" "}
                <a href={installation.manage_url} target="_blank" rel="noreferrer noopener" className="text-blue-600 dark:text-blue-400 hover:underline">Choose repositories on GitHub</a>, then try again.
              </p>
            );
          }
          return (
            <ul className="max-h-72 overflow-y-auto divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" aria-label="Repositories">
              {shown.length === 0 && <li className="p-3 text-[var(--color-text-muted)]">No repository matches “{filter}”.</li>}
              {shown.map((r) => (
                <li key={r.full_name}>
                  <button type="button" disabled={!!r.used_by_project} onClick={() => onPick(r)}
                    className={`w-full text-left p-2.5 flex items-center justify-between gap-2 ${r.used_by_project ? "opacity-60 cursor-not-allowed" : "hover:bg-[var(--color-hover)]"} ${selected === r.full_name ? "bg-blue-500/10" : ""}`}>
                    <span className="min-w-0">
                      <span className="font-medium flex items-center gap-1.5">
                        {r.private_repository ? <Lock className="w-3 h-3" aria-label="Private" /> : <Unlock className="w-3 h-3" aria-label="Public" />} {r.full_name}
                      </span>
                      {r.description && <span className="block truncate text-[var(--color-text-muted)]">{r.description}</span>}
                    </span>
                    {r.used_by_project ? <StatusBadge label={`Used by ${r.used_by_project}`} tone="neutral" /> : <span className="font-mono text-[var(--color-text-muted)]">{r.default_branch}</span>}
                  </button>
                </li>
              ))}
            </ul>
          );
        }}
      </SectionGate>
      <AdminButton variant="ghost" onClick={onBack}>Back</AdminButton>
    </div>
  );
}

function BranchChoice({ target, installationId, repository, branch, setBranch, onBack, onNext, checking, error }: {
  target: GitHubTarget; installationId: string; repository: string; branch: string; setBranch: (b: string) => void;
  onBack: () => void; onNext: () => void; checking: boolean; error: string | null;
}) {
  const branches = useGitHubBranches(target, installationId, repository);
  return (
    <div className="space-y-2">
      <p>Repository <span className="font-semibold">{repository}</span></p>
      <SectionGate state={branches} what="branches">
        {(rows) => (
          <AdminSelect label="Default branch for commits" value={branch} onChange={(e) => setBranch(e.target.value)}
            options={(rows.includes(branch) || !branch ? rows : [branch, ...rows]).map((b) => ({ label: b, value: b }))} />
        )}
      </SectionGate>
      {error && <p role="alert" className="text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex justify-between gap-2">
        <AdminButton variant="ghost" onClick={onBack}>Back</AdminButton>
        <AdminButton disabled={!branch} isLoading={checking} onClick={onNext}>Check access</AdminButton>
      </div>
    </div>
  );
}

/* ================================================================== project: connected repository */

/** Connected through the App: details, status, sync, change, disconnect and the way to the activity tab. */
export function AppConnectionView({ orgId, projectId, connection, onViewActivity, returnTo, justImported }: {
  orgId: string; projectId: string; connection: GitHubConnectionDto; onViewActivity?: () => void; returnTo: string;
  justImported?: SyncResultDto | null;
}) {
  const [changing, setChanging] = useState(false);
  const sync = useFlowMutation(() => apiClient.flow.githubApp.sync(projectId));
  const disconnect = useFlowMutation(() => apiClient.flow.disconnectGitHub(projectId, connection.version));
  const healthy = connection.status === "ACTIVE" && !connection.last_error;
  if (changing) {
    return (
      <GitHubRepoPicker orgId={orgId} target={{ projectId }} expectedVersion={connection.version} returnTo={returnTo}
        initial={{ installationId: connection.installation_id, repository: null, branch: null }}
        onCancel={() => setChanging(false)}
        onDone={({ connection: saved }) => { setChanging(false); toast.success(`Now connected to ${saved?.repository}@${saved?.branch}.`); }} />
    );
  }
  return (
    <div className="space-y-3 text-xs" data-testid="github-connected">
      {justImported && (
        <p className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-200" role="status">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          {justImported.ok ? `Connected. ${justImported.linked} recent commit(s) and pull request(s) imported.` : `Connected, but the import failed: ${justImported.problem}`}
        </p>
      )}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Repository">
          <a href={connection.repository_url ?? "#"} target="_blank" rel="noreferrer noopener" className="font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
            {connection.private_repository ? <Lock className="w-3 h-3" aria-label="Private" /> : null}{connection.repository}<ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </Field>
        <Field label="Branch"><span className="font-mono">{connection.branch ?? "—"}</span></Field>
        <Field label="GitHub account">{connection.installation_account ?? "—"}</Field>
        <Field label="Status"><StatusBadge label={healthy ? "Connected" : "Needs attention"} tone={healthy ? "success" : "warning"} dot /></Field>
        <Field label="Last sync">{connection.last_synced_at ? dateTimeText(connection.last_synced_at) : "Not yet"}</Field>
        <Field label="Imported activity">{connection.activity_count ?? 0} commit(s) and pull request(s)</Field>
        <Field label="Live updates">Through the Prowise GitHub App webhook</Field>
        <Field label="Connected by">{connection.connected_by ?? "—"}</Field>
      </dl>
      {connection.last_error && <p className="rounded-md bg-amber-500/10 p-2 text-amber-800 dark:text-amber-200" role="alert">{connection.last_error}</p>}
      <div className="flex flex-wrap gap-2">
        {onViewActivity && <AdminButton size="xs" onClick={onViewActivity}><GitCommit className="w-3 h-3" /> View GitHub Activity</AdminButton>}
        {connection.can_manage && (
          <>
            <AdminButton size="xs" variant="outline" isLoading={sync.isPending} onClick={() => sync.mutate(undefined, {
              onSuccess: (r) => r.ok ? toast.success(`Synced. ${r.linked} new item(s).`) : toast.error(r.problem ?? "Sync failed."),
              onError: (e) => toast.error(changeError(e)),
            })}><RefreshCw className="w-3 h-3" /> Sync now</AdminButton>
            <AdminButton size="xs" variant="outline" onClick={() => setChanging(true)}><GitBranch className="w-3 h-3" /> Change repository or branch</AdminButton>
            <AdminButton size="xs" variant="danger" isLoading={disconnect.isPending} onClick={() => {
              if (!window.confirm(`Disconnect ${connection.repository}? Imported activity stays as history.`)) return;
              disconnect.mutate(undefined, {
                onSuccess: () => toast.success("Repository disconnected."),
                onError: (e) => toast.error(changeError(e)),
              });
            }}><Link2Off className="w-3 h-3" /> Disconnect</AdminButton>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-[var(--color-text-muted)]">{label}</dt><dd>{children}</dd></div>;
}

/* ================================================================== GitHub Activity tab */

export function GitHubActivityPanel({ projectId, canSync, onConnect }: { projectId: string; canSync: boolean; onConnect?: () => void }) {
  const [query, setQuery] = useState<GitHubFeedQuery>({ page: 0, size: 20 });
  const [search, setSearch] = useState("");
  const feed = useGitHubFeed(projectId, query);
  const sync = useFlowMutation(() => apiClient.flow.githubApp.sync(projectId));
  const set = (patch: Partial<GitHubFeedQuery>) => setQuery((q) => ({ ...q, ...patch, page: patch.page ?? 0 }));
  return (
    <Panel title="GitHub Activity" icon={GitCommit} iconTone="violet"
      description="Commits and pull requests from the connected repository. Evidence only: never completion or progress.">
      <SectionGate state={feed} what="GitHub activity">
        {(page) => {
          if (!page.connected) {
            return (
              <EmptyStateView icon={Link2Off} title="No repository connected"
                description={page.total > 0 ? "The repository was disconnected. Connect one to see its activity again." : "Connect a GitHub repository to see its commits and pull requests here."}
                actionLabel={onConnect ? "Go to Repository" : undefined} onAction={onConnect} />
            );
          }
          const pages = Math.max(1, Math.ceil(page.total / page.size));
          return (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[var(--color-text-muted)]">
                  <a href={page.repository_url ?? "#"} target="_blank" rel="noreferrer noopener" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{page.repository}</a>
                  {" "}· branch <span className="font-mono">{page.branch}</span> · last sync {page.last_synced_at ? dateTimeText(page.last_synced_at) : "not yet"}
                </p>
                {canSync && (
                  <AdminButton size="xs" variant="outline" isLoading={sync.isPending} onClick={() => sync.mutate(undefined, {
                    onSuccess: (r) => r.ok ? toast.success(`Synced. ${r.linked} new item(s).`) : toast.error(r.problem ?? "Sync failed."),
                    onError: (e) => toast.error(changeError(e)),
                  })}><RefreshCw className="w-3 h-3" /> Sync now</AdminButton>
                )}
              </div>
              {page.last_error && <p className="rounded-md bg-amber-500/10 p-2 text-amber-800 dark:text-amber-200" role="alert">{page.last_error}</p>}
              <form className="grid grid-cols-1 sm:grid-cols-4 gap-2" onSubmit={(e) => { e.preventDefault(); set({ q: search.trim() }); }} role="search">
                <AdminSelect label="Type" value={query.type ?? ""} onChange={(e) => set({ type: e.target.value as GitHubFeedQuery["type"] })}
                  options={[{ label: "Commits and pull requests", value: "" }, { label: "Commits", value: "COMMIT" }, { label: "Pull requests", value: "PULL_REQUEST" }]} />
                <AdminSelect label="Branch" value={query.branch ?? ""} onChange={(e) => set({ branch: e.target.value })}
                  options={[{ label: "All branches", value: "" }, ...page.branches.map((b) => ({ label: b, value: b }))]} />
                <AdminSelect label="Author" value={query.author ?? ""} onChange={(e) => set({ author: e.target.value })}
                  options={[{ label: "All authors", value: "" }, ...page.authors.map((a) => ({ label: a, value: a }))]} />
                <AdminInput label="Search" placeholder="Message, SHA or #PR" value={search} onChange={(e) => setSearch(e.target.value)} />
              </form>
              {page.items.length === 0 ? (
                <EmptyStateView icon={Search} title={query.q || query.type || query.branch || query.author ? "Nothing matches these filters" : "No activity yet"}
                  description={query.q || query.type || query.branch || query.author ? "Clear a filter to see more."
                    : canSync ? "Push a commit or open a pull request, or use Sync now." : "Commits and pull requests appear here once they are pushed."} />
              ) : (
                <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" aria-label="GitHub activity">
                  {page.items.map((item) => <FeedRow key={item.id} item={item} />)}
                </ul>
              )}
              {page.total > page.size && (
                <div className="flex items-center justify-between">
                  <AdminButton size="xs" variant="ghost" disabled={page.page === 0} onClick={() => set({ page: page.page - 1 })}>Previous</AdminButton>
                  <span className="text-[var(--color-text-muted)]">Page {page.page + 1} of {pages} · {page.total} items</span>
                  <AdminButton size="xs" variant="ghost" disabled={page.page + 1 >= pages} onClick={() => set({ page: page.page + 1 })}>Next</AdminButton>
                </div>
              )}
            </div>
          );
        }}
      </SectionGate>
    </Panel>
  );
}

const PR_TONE: Record<string, "success" | "info" | "neutral" | "violet"> = { open: "success", merged: "violet", closed: "neutral" };

export function FeedRow({ item }: { item: GitHubFeedItemDto }) {
  const isPull = item.type === "PULL_REQUEST";
  const stats = useMemo(() => item.additions === null && item.deletions === null ? null
    : { add: item.additions ?? 0, del: item.deletions ?? 0, files: item.files_changed ?? 0 }, [item]);
  return (
    <li className="p-3 flex items-start gap-3">
      {isPull ? <GitPullRequest className="w-4 h-4 mt-0.5 text-violet-500 shrink-0" aria-label="Pull request" />
        : <GitCommit className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" aria-label="Commit" />}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium break-words">
          {item.url ? <a href={item.url} target="_blank" rel="noreferrer noopener" className="hover:underline">{item.title}</a> : item.title}
          {isPull && item.pr_number !== null && <span className="text-[var(--color-text-muted)]"> #{item.pr_number}</span>}
        </p>
        <p className="text-[var(--color-text-muted)] flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{item.author}</span>
          <span>{dateTimeText(item.occurred_at)}</span>
          {!isPull && item.sha && <span className="font-mono">{item.sha.slice(0, 7)}</span>}
          {item.branch && <span className="inline-flex items-center gap-1 font-mono"><GitBranch className="w-3 h-3" aria-hidden="true" />{item.branch}{isPull && item.base_branch ? ` → ${item.base_branch}` : ""}</span>}
          {isPull && item.state && <StatusBadge label={item.state} tone={PR_TONE[item.state] ?? "neutral"} />}
          {item.task_keys.map((k) => <StatusBadge key={k} label={k} tone="info" />)}
        </p>
      </div>
      <div className="text-right shrink-0 font-mono" aria-label="Code changes">
        {stats ? (
          <>
            <span className="text-emerald-600 dark:text-emerald-400">+{stats.add}</span>{" "}
            <span className="text-rose-600 dark:text-rose-400">−{stats.del}</span>
            <span className="block text-[var(--color-text-muted)]">{stats.files} file{stats.files === 1 ? "" : "s"}</span>
          </>
        ) : <span className="text-[var(--color-text-muted)]">—</span>}
      </div>
    </li>
  );
}
