"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogIn, MailX, UserPlus } from "lucide-react";

import { ApiError, apiClient, type PublicInvitationPreview } from "@/lib/api";
import { switchWorkspace } from "@/lib/workspace-switch";
import { getRoleDashboardPath } from "@/store/auth-store";
import type { InvitationPreviewDto } from "@/types/api";
import { AdminButton, AdminInput, PageSkeleton, Panel, StatPill, formatDateTime } from "@/components/delivery/DeliveryUI";
import { roleDisplayName } from "./permission-key-catalog";

/**
 * Task 1.2: accept an invitation. The token arrives in the URL fragment (#token=…), which browsers never send to
 * a server; it is moved to sessionStorage, removed from the address bar, and posted in a request body only.
 */
const STORAGE_KEY = "prowise.pendingInvitation";

type View =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "signin" }
  | { kind: "invalid"; requestId: string }
  | { kind: "error"; message: string; requestId: string }
  | { kind: "ready"; preview: InvitationPreviewDto }
  | { kind: "accepted"; organizationName: string }
  | { kind: "create"; preview: PublicInvitationPreview }
  | { kind: "signin-existing"; preview: PublicInvitationPreview }
  | { kind: "activated"; organizationName: string; email: string };

/** Mirrors the server rule: 12 to 200 characters. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 200) return "Use at most 200 characters.";
  if (password !== confirm) return "The two passwords do not match.";
  return null;
}

function readToken(): string | null {
  try {
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
    if (fromHash) {
      sessionStorage.setItem(STORAGE_KEY, fromHash);
      window.history.replaceState(null, "", window.location.pathname);
      return fromHash;
    }
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function forget() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

export function AcceptInvitationView() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [accepting, setAccepting] = useState(false);

  const fail = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) return void signedOutPreview();
    if (error instanceof ApiError && error.status === 404) return setView({ kind: "invalid", requestId: error.requestId });
    const requestId = error instanceof ApiError ? error.requestId : "";
    const message = error instanceof ApiError && error.code === "ALREADY_MEMBER"
      ? "You are already a member of this workspace."
      : error instanceof ApiError && error.code === "MEMBERSHIP_DISABLED"
        ? "Your membership in this workspace is disabled. Ask an administrator to re-enable it."
        : "The invitation could not be processed.";
    setView({ kind: "error", message, requestId });
  };

  /** Not signed in: read what the link is for, then offer "create my account" or "sign in and accept". */
  const signedOutPreview = async (found = token ?? readToken()) => {
    if (!found) return setView({ kind: "missing" });
    try {
      const preview = await apiClient.publicInvitationPreview(found);
      setView(preview.account_exists ? { kind: "signin-existing", preview } : { kind: "create", preview });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return setView({ kind: "invalid", requestId: error.requestId });
      setView({ kind: "signin" });
    }
  };

  useEffect(() => {
    const found = readToken();
    setToken(found);
    if (!found) {
      setView({ kind: "missing" });
      return;
    }
    apiClient.previewInvitation(found).then((preview) => setView({ kind: "ready", preview }), fail);
  }, []);

  const accept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const result = await apiClient.acceptInvitation(token);
      forget();
      const switched = await switchWorkspace(result.organization_id);
      if (switched.ok) {
        router.push(getRoleDashboardPath(result.role_template as Parameters<typeof getRoleDashboardPath>[0], result.organization_id));
      } else {
        setView({ kind: "accepted", organizationName: result.organization_name });
      }
    } catch (error) {
      fail(error);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <h1 className="text-xl font-bold tracking-tight">Join a workspace</h1>
        {view.kind === "loading" && <PageSkeleton variant="detail" />}
        {view.kind === "missing" && (
          <Panel title="No invitation link" icon={MailX} iconTone="rose">
            <p className="text-xs">Open the link from your invitation email. It works once and expires.</p>
          </Panel>
        )}
        {view.kind === "signin" && (
          <Panel title="Sign in to accept" icon={LogIn}>
            <p className="text-xs">Sign in, or create an account, with the email address the invitation was sent to. Then open this page again.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="text-xs font-semibold text-blue-600 hover:underline" href="/login">Sign in</Link>
              <Link className="text-xs font-semibold text-blue-600 hover:underline" href="/signup">Create an account</Link>
              <Link className="text-xs font-semibold text-blue-600 hover:underline" href="/invitations/accept">I signed in, continue</Link>
            </div>
          </Panel>
        )}
        {view.kind === "invalid" && (
          <Panel title="This link can't be used" icon={MailX} iconTone="rose">
            <p className="text-xs">It may have expired, been replaced by a newer email, been revoked, already been used, or been sent to a different email address. Ask the person who invited you for a new link.</p>
            {view.requestId && <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Reference: {view.requestId}</p>}
          </Panel>
        )}
        {view.kind === "error" && (
          <Panel title="Something went wrong" icon={MailX} iconTone="rose">
            <p className="text-xs">{view.message}</p>
            {view.requestId && <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Reference: {view.requestId}</p>}
          </Panel>
        )}
        {view.kind === "ready" && (
          <Panel title={view.preview.organization_name} icon={UserPlus} description={`Invited by ${view.preview.invited_by_email}`}>
            <div className="grid grid-cols-2 gap-3">
              <StatPill label="Role" value={roleDisplayName(view.preview.role_name)} />
              <StatPill label="Expires" value={formatDateTime(view.preview.expires_at)} />
              {view.preview.team_name && <StatPill label="Team" value={view.preview.team_name} />}
            </div>
            <div className="mt-4">
              <AdminButton isLoading={accepting} onClick={() => void accept()}><CheckCircle2 className="w-3.5 h-3.5" /> Accept and join</AdminButton>
            </div>
          </Panel>
        )}
        {view.kind === "create" && token && (
          <CreateAccountPanel
            token={token}
            preview={view.preview}
            onDone={(organizationName) => {
              forget();
              setView({ kind: "activated", organizationName, email: view.preview.email });
            }}
            onInvalid={(requestId) => setView({ kind: "invalid", requestId })}
          />
        )}
        {view.kind === "signin-existing" && (
          <Panel title={`Join ${view.preview.organization_name}`} icon={LogIn} description={`Invited by ${view.preview.invited_by_email}`}>
            <p className="text-xs">
              {view.preview.email} already has a ProWise account. Sign in with it, then come back to this page to accept
              the {roleDisplayName(view.preview.role_name)} invitation.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link className="text-xs font-semibold text-blue-600 hover:underline" href="/login">Sign in</Link>
              <Link className="text-xs font-semibold text-blue-600 hover:underline" href="/invitations/accept">I signed in, continue</Link>
              <Link className="text-xs font-semibold text-blue-600 hover:underline" href="/forgot-password">Forgot password</Link>
            </div>
          </Panel>
        )}
        {view.kind === "activated" && (
          <Panel title="Your account is ready" icon={CheckCircle2} iconTone="emerald">
            <p className="text-xs">You joined {view.organizationName}. Sign in with {view.email} and the password you just chose.</p>
            <Link className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:underline" href="/login">Go to sign in</Link>
          </Panel>
        )}
        {view.kind === "accepted" && (
          <Panel title="You joined" icon={CheckCircle2} iconTone="emerald">
            <p className="text-xs">You are now a member of {view.organizationName}.</p>
            <Link className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:underline" href="/select-org">Open your workspaces</Link>
          </Panel>
        )}
      </div>
    </div>
  );
}

/** A new person chooses their own password; the single-use link creates and activates the account and joins. */
function CreateAccountPanel({ token, preview, onDone, onInvalid }: {
  token: string;
  preview: PublicInvitationPreview;
  onDone: (organizationName: string) => void;
  onInvalid: (requestId: string) => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateNewPassword(password, confirm);
    if (problem) return setError(problem);
    setError(null);
    setSaving(true);
    try {
      const result = await apiClient.activateInvitation({ token, password, name: name.trim() || undefined });
      onDone(result.organization_name);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return onInvalid(err.requestId);
      setError(err instanceof ApiError ? err.message : "Your account could not be created. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title={`Join ${preview.organization_name}`} icon={UserPlus} description={`Invited by ${preview.invited_by_email}`}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatPill label="Role" value={roleDisplayName(preview.role_name)} />
        <StatPill label="Expires" value={formatDateTime(preview.expires_at)} />
      </div>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <AdminInput label="Email" value={preview.email} readOnly disabled />
        <AdminInput label="Your name" value={name} maxLength={200} autoComplete="name" onChange={(e) => setName(e.target.value)} />
        <AdminInput label="Choose a password" type="password" autoComplete="new-password" value={password}
          helperText="At least 12 characters. Nobody at ProWise will ever ask you for it."
          onChange={(e) => setPassword(e.target.value)} />
        <AdminInput label="Repeat the password" type="password" autoComplete="new-password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} />
        {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <AdminButton type="submit" isLoading={saving}><UserPlus className="w-3.5 h-3.5" /> Create my account</AdminButton>
      </form>
    </Panel>
  );
}
