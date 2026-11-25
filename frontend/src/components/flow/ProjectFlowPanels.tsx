"use client";

import React, { useState } from "react";
import { Copy, FileUp, FolderKanban, GitBranch, Link2Off, Lock, RefreshCw, ShieldCheck, Target } from "lucide-react";
import { toast } from "sonner";

import { AdminButton, AdminInput, EmptyStateView, Panel, StatusBadge } from "@/components/delivery/DeliveryUI";
import { SectionGate, changeError, dateTimeText } from "@/components/developer/DevUI";
import { useOrgId } from "@/components/org-console/useRoleApi";
import { apiClient } from "@/lib/api";
import type { GitHubConnectionDto, SyncResultDto } from "@/types/flow";
import { usePathname } from "next/navigation";
import { BOARD_COLUMNS, FileRow, ProgressFigure, RoleBadge, formatBytes } from "./FlowUI";
import { AppConnectionView, GitHubActivityPanel, GitHubRepoPicker } from "./GitHubIntegration";
import { PeoplePicker } from "./ProjectSetupWizard";
import {
  useApprovers,
  useFlowMutation,
  useGitHubConnection,
  useProjectFiles,
  useProjectWorkItems,
  useSetupOptions,
  useStructuredProgress,
  useUploadFile,
} from "./useFlowApi";

/** Team project: tasks by column (read-only here; developers move their own tasks on My Work). */
export function ProjectTasksPanel({ projectId }: { projectId: string }) {
  const items = useProjectWorkItems(projectId);
  return (
    <Panel title="Tasks" icon={FolderKanban} description="Created, In progress, In review, Completed. Only the assigned developer moves a task; approvers complete it.">
      <SectionGate state={items} what="tasks">
        {(rows) => {
          const tasks = rows.filter((r) => r.type !== "MILESTONE" && r.plan_status !== "RETIRED");
          if (tasks.length === 0) return <EmptyStateView icon={FolderKanban} title="No tasks" description="This project has no tasks yet." />;
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {BOARD_COLUMNS.map((column) => {
                const cards = tasks.filter((t) => t.state === column.state);
                return (
                  <section key={column.state} aria-label={`${column.label}, ${cards.length} tasks`}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2">
                    <h3 className="flex justify-between px-1.5 py-1 text-xs font-semibold">{column.label}<span className="text-[var(--color-text-muted)]">{cards.length}</span></h3>
                    <ul className="space-y-2 mt-1">
                      {cards.map((t) => (
                        <li key={t.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs space-y-1">
                          <div className="flex justify-between gap-2">
                            <span className="font-mono text-blue-600 dark:text-blue-400">{t.key}</span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">{t.weight ?? "—"} pts</span>
                          </div>
                          <p className="font-medium">{t.title}</p>
                          <p className="text-[10px] text-[var(--color-text-muted)]">{t.phase?.title ?? ""}{t.primary_assignee ? ` · ${t.primary_assignee.email}` : " · Unassigned"}</p>
                          {(t.blocked_by ?? []).length > 0 && (
                            <p className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300">
                              <Lock className="w-3 h-3" aria-hidden="true" /> Blocked by {(t.blocked_by ?? []).map((b) => b.key).join(", ")}
                            </p>
                          )}
                        </li>
                      ))}
                      {cards.length === 0 && <li className="px-1.5 py-2 text-[11px] text-[var(--color-text-muted)]">Nothing here.</li>}
                    </ul>
                  </section>
                );
              })}
            </div>
          );
        }}
      </SectionGate>
    </Panel>
  );
}

/** Team progress: approved points of the active scope / total points, with the method label and every task's credit. */
export function StructuredProgressPanel({ projectId }: { projectId: string }) {
  const progress = useStructuredProgress(projectId);
  return (
    <Panel title="Progress" icon={Target} iconTone="emerald" description="Approved points of the active scope / total points.">
      <SectionGate state={progress} what="progress">
        {(p) => (
          <div className="space-y-4">
            <ProgressFigure percent={p.reported ? p.percent : null} label={p.label} method={p.method_label ?? null} />
            {p.leaves.length > 0 && (
              <ul className="divide-y divide-[var(--color-border)]">
                {p.leaves.map((leaf) => (
                  <li key={leaf.work_item_id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                    <span className="truncate"><span className="font-mono text-blue-600 dark:text-blue-400">{leaf.key}</span> {leaf.title}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="tabular-nums text-[var(--color-text-muted)]">{leaf.weight} pts</span>
                      <StatusBadge label={leaf.accepted ? "Counted" : leaf.suspended ? "Suspended" : "Not yet"}
                        tone={leaf.accepted ? "success" : leaf.suspended ? "warning" : "neutral"} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {p.snapshots.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium">History ({p.snapshots.length} events, append-only)</summary>
                <ul className="mt-2 space-y-1">
                  {[...p.snapshots].reverse().map((s) => (
                    <li key={s.id} className="text-[11px] text-[var(--color-text-secondary)]">
                      {dateTimeText(s.taken_at)} · {s.percent === null ? s.missing_label : `${s.percent}%`} ({s.numerator}/{s.denominator}) · {s.cause?.toLowerCase().replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </SectionGate>
    </Panel>
  );
}

/**
 * One GitHub repository per project, picked through the organization's GitHub App (repo.connect on the project: its
 * creator, its PM, Owner/Admin). A fine-grained token stays available as a fallback. Credentials are never shown.
 */
export function GitHubPanel({ projectId, onViewActivity }: { projectId: string; onViewActivity?: () => void }) {
  const connection = useGitHubConnection(projectId);
  const orgId = useOrgId();
  const pathname = usePathname();
  const [imported, setImported] = useState<SyncResultDto | null>(null);
  const [useToken, setUseToken] = useState(false);
  return (
    <Panel title="GitHub repository" icon={GitBranch} iconTone="violet"
      description="Commits are linked to tasks by key (e.g. KEY-12) in the message, branch or pull request title. Evidence only.">
      <SectionGate state={connection} what="the repository connection">
        {(c) => {
          if (c.connected && c.provider === "GITHUB_APP") {
            return <AppConnectionView orgId={orgId} projectId={projectId} connection={c} onViewActivity={onViewActivity}
              returnTo={pathname} justImported={imported} />;
          }
          if (!c.connected && c.can_manage && !useToken) {
            return (
              <div className="space-y-3">
                <GitHubRepoPicker orgId={orgId} target={{ projectId }} returnTo={pathname}
                  onDone={({ imported: result }) => { setImported(result ?? null); toast.success("Repository connected."); }} />
                <button type="button" className="text-xs text-[var(--color-text-muted)] hover:underline" onClick={() => setUseToken(true)}>
                  Use a fine-grained personal access token instead
                </button>
              </div>
            );
          }
          return (
            <div className="space-y-3">
              <GitHubConnection projectId={projectId} connection={c} />
              {!c.connected && c.can_manage && (
                <button type="button" className="text-xs text-[var(--color-text-muted)] hover:underline" onClick={() => setUseToken(false)}>
                  Pick from the organization&apos;s GitHub instead
                </button>
              )}
            </div>
          );
        }}
      </SectionGate>
    </Panel>
  );
}

/** The GitHub Activity tab; Sync now only for those who manage the repository. */
export function ProjectGitHubActivity({ projectId, onConnect }: { projectId: string; onConnect?: () => void }) {
  const connection = useGitHubConnection(projectId);
  const canSync = connection.kind === "ready" && connection.data.can_manage;
  return <GitHubActivityPanel projectId={projectId} canSync={canSync} onConnect={onConnect} />;
}

function GitHubConnection({ projectId, connection }: { projectId: string; connection: GitHubConnectionDto }) {
  const [repository, setRepository] = useState("");
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connect = useFlowMutation(() => apiClient.flow.connectGitHub(projectId, { repository: repository.trim(), token: token.trim() }));
  const rotate = useFlowMutation(() => apiClient.flow.rotateWebhookSecret(projectId, connection.version));
  const disconnect = useFlowMutation(() => apiClient.flow.disconnectGitHub(projectId, connection.version));

  if (!connection.connected) {
    if (!connection.can_manage) {
      return (
        <p className="text-xs text-[var(--color-text-muted)]" data-testid="ask-admin">
          No repository is connected. The project creator, its project manager or an admin can connect one.
        </p>
      );
    }
    return (
      <form className="space-y-3" noValidate onSubmit={(e) => {
        e.preventDefault();
        if (!/^[\w.-]+\/[\w.-]+$/.test(repository.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, ""))) {
          return setError("Enter the repository as owner/name, for example acme/web.");
        }
        if (!token.trim()) return setError("Paste a fine-grained, read-only token for this repository.");
        setError(null);
        connect.mutate(undefined, {
          onSuccess: (saved) => {
            setToken("");
            setSecret(saved.webhook_secret);
            toast.success(`${saved.repository} connected.`);
          },
          onError: (e) => setError(changeError(e)),
        });
      }}>
        <AdminInput label="Repository (owner/name)" placeholder="acme/web" value={repository} onChange={(e) => setRepository(e.target.value)} />
        <AdminInput label="Fine-grained read-only token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)}
          helperText="Repository access: only this repository. Permissions: Contents, Metadata and Pull requests, read-only. Stored encrypted; never shown again." />
        {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <AdminButton type="submit" isLoading={connect.isPending}>Connect repository</AdminButton>
      </form>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><dt className="text-[var(--color-text-muted)]">Repository</dt><dd className="font-medium"><a href={connection.repository_url ?? "#"} target="_blank" rel="noreferrer noopener" className="text-blue-600 dark:text-blue-400 hover:underline">{connection.repository}</a></dd></div>
        <div><dt className="text-[var(--color-text-muted)]">Token</dt><dd className="font-mono">{connection.token_last4 ? `…${connection.token_last4}` : "Not stored"}</dd></div>
        <div><dt className="text-[var(--color-text-muted)]">Status</dt><dd><StatusBadge label={connection.last_error ? "Needs attention" : "Connected"} tone={connection.last_error ? "warning" : "success"} /></dd></div>
        <div><dt className="text-[var(--color-text-muted)]">Last sync</dt><dd>{connection.last_synced_at ? dateTimeText(connection.last_synced_at) : "Not yet"}</dd></div>
        <div><dt className="text-[var(--color-text-muted)]">Connected by</dt><dd>{connection.connected_by ?? "—"}</dd></div>
      </dl>
      {connection.last_error && <p className="rounded-md bg-amber-500/10 p-2 text-amber-800 dark:text-amber-200">{connection.last_error}</p>}
      {connection.can_manage && connection.webhook_url && (
        <div className="space-y-1">
          <p className="font-medium">Webhook (optional, for instant updates)</p>
          <p className="text-[var(--color-text-muted)]">
            In GitHub: Settings → Webhooks → Add webhook. Payload URL below, content type application/json, the secret shown once
            when connecting, events: Pushes and Pull requests.
          </p>
          <code className="block break-all rounded-md bg-[var(--color-elevated)] p-2">{connection.webhook_url}</code>
        </div>
      )}
      {secret && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 space-y-1" role="status">
          <p className="font-semibold">Webhook secret (shown once)</p>
          <code className="block break-all">{secret}</code>
          <AdminButton size="xs" variant="outline" onClick={() => { void navigator.clipboard?.writeText(secret); toast.success("Copied."); }}>
            <Copy className="w-3 h-3" /> Copy
          </AdminButton>
        </div>
      )}
      {connection.can_manage && (
        <div className="flex flex-wrap gap-2">
          <AdminButton size="xs" variant="outline" isLoading={rotate.isPending} onClick={() => rotate.mutate(undefined, {
            onSuccess: (saved) => { setSecret(saved.webhook_secret); toast.success("New webhook secret created. Update it in GitHub."); },
            onError: (e) => toast.error(changeError(e)),
          })}>
            <RefreshCw className="w-3 h-3" /> New webhook secret
          </AdminButton>
          <AdminButton size="xs" variant="danger" isLoading={disconnect.isPending} onClick={() => disconnect.mutate(undefined, {
            onSuccess: () => toast.success("Repository disconnected. The stored token was deleted."),
            onError: (e) => toast.error(changeError(e)),
          })}>
            <Link2Off className="w-3 h-3" /> Disconnect
          </AdminButton>
        </div>
      )}
      {connection.can_manage && <ReplaceToken projectId={projectId} version={connection.version} />}
    </div>
  );
}

/** Replace the stored token: checked with GitHub first, then stored encrypted; only its last 4 characters are shown. */
function ReplaceToken({ projectId, version }: { projectId: string; version: number }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const replace = useFlowMutation(() => apiClient.flow.replaceGitHubToken(projectId, token.trim(), version));
  if (!open) return <AdminButton size="xs" variant="outline" onClick={() => setOpen(true)}>Replace token</AdminButton>;
  return (
    <form className="space-y-2 border-t border-[var(--color-border)] pt-3" noValidate onSubmit={(e) => {
      e.preventDefault();
      if (!token.trim()) return setError("Paste the new fine-grained read-only token.");
      setError(null);
      replace.mutate(undefined, {
        onSuccess: (saved) => { toast.success(`Token replaced (ends in ${saved.token_last4}).`); setToken(""); setOpen(false); },
        onError: (err) => setError(changeError(err)),
      });
    }}>
      <AdminInput label="New fine-grained read-only token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <AdminButton size="xs" type="submit" isLoading={replace.isPending}>Verify & replace</AdminButton>
        <AdminButton size="xs" type="button" variant="ghost" onClick={() => { setOpen(false); setToken(""); setError(null); }}>Cancel</AdminButton>
      </div>
    </form>
  );
}

/** Project documents: download for everyone who can read the project; upload with project.edit. */
export function DocumentsPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const orgId = useOrgId();
  const files = useProjectFiles(projectId);
  const upload = useUploadFile(orgId);
  return (
    <Panel title="Documents" icon={FileUp} description="PDF, Word, Excel, PowerPoint, text or images, up to 20 MB each.">
      <div className="space-y-3">
        <SectionGate state={files} what="documents">
          {(rows) => rows.length === 0 ? <p className="text-xs text-[var(--color-text-muted)]">No documents.</p> : (
            <ul className="divide-y divide-[var(--color-border)]">{rows.map((f) => <FileRow key={f.id} file={f} />)}</ul>
          )}
        </SectionGate>
        {canEdit && (
          <label className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-medium cursor-pointer hover:bg-[var(--color-hover)]">
            <FileUp className="w-3.5 h-3.5" aria-hidden="true" /> {upload.isPending ? "Uploading…" : "Upload document"}
            <input type="file" multiple className="sr-only" aria-label="Upload project document"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif"
              onChange={(e) => {
                Array.from(e.target.files ?? []).forEach((file) => {
                  if (file.size > 20 * 1024 * 1024) return toast.error(`${file.name} is larger than ${formatBytes(20 * 1024 * 1024)}.`);
                  upload.mutate({ file, kind: "PROJECT_DOCUMENT", projectId }, {
                    onSuccess: () => toast.success(`${file.name} uploaded.`),
                    onError: (err) => toast.error(`${file.name}: ${changeError(err)}`),
                  });
                });
                e.target.value = "";
              }} />
          </label>
        )}
      </div>
    </Panel>
  );
}

/** Who approves this project's work. Editable with project.edit; Owner and Admin are never offered. */
export function ApproversPanel({ projectId }: { projectId: string }) {
  const orgId = useOrgId();
  const approvers = useApprovers(projectId);
  const [editing, setEditing] = useState(false);
  return (
    <Panel title="Approvers" icon={ShieldCheck} iconTone="emerald" description="They approve this project's work. Nobody approves their own work.">
      <SectionGate state={approvers} what="approvers">
        {(view) => editing && view.can_edit
          ? <ApproverEditor orgId={orgId} projectId={projectId} current={view.approvers.map((a) => a.membership_id)}
            version={view.project_version} onDone={() => setEditing(false)} />
          : (
            <div className="space-y-2">
              {view.approvers.length === 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">No approver yet: submitted work waits for one.</p>
              ) : (
                <ul className="space-y-1">
                  {view.approvers.map((a) => (
                    <li key={a.membership_id} className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{a.name || a.email}</span><RoleBadge role={a.role_template} />
                    </li>
                  ))}
                </ul>
              )}
              {view.can_edit && <AdminButton size="xs" variant="outline" onClick={() => setEditing(true)}>Change approvers</AdminButton>}
            </div>
          )}
      </SectionGate>
    </Panel>
  );
}

function ApproverEditor({ orgId, projectId, current, version, onDone }: {
  orgId: string; projectId: string; current: string[]; version: number; onDone: () => void;
}) {
  const options = useSetupOptions(orgId);
  const [selected, setSelected] = useState<string[]>(current);
  const save = useFlowMutation(() => apiClient.flow.replaceApprovers(projectId, { approver_membership_ids: selected, expected_version: version }));
  return (
    <SectionGate state={options} what="people">
      {(o) => (
        <div className="space-y-2">
          <PeoplePicker label="Approvers" people={o.people} selected={selected} onChange={setSelected} />
          <div className="flex gap-2">
            <AdminButton size="xs" isLoading={save.isPending} onClick={() => save.mutate(undefined, {
              onSuccess: () => { toast.success("Approvers updated."); onDone(); },
              onError: (e) => toast.error(changeError(e)),
            })}>Save</AdminButton>
            <AdminButton size="xs" variant="ghost" onClick={onDone}>Cancel</AdminButton>
          </div>
        </div>
      )}
    </SectionGate>
  );
}
