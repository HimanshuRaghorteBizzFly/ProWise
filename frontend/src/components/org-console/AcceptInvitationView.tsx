"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogIn, MailX, UserPlus } from "lucide-react";

import { ApiError, apiClient } from "@/lib/api";
import { switchWorkspace } from "@/lib/workspace-switch";
import { getRoleDashboardPath } from "@/store/auth-store";
import type { InvitationPreviewDto } from "@/types/api";
import { AdminButton, PageSkeleton, Panel, StatPill, formatDateTime } from "@/components/delivery/DeliveryUI";
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
  | { kind: "accepted"; organizationName: string };

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
    if (error instanceof ApiError && error.status === 401) return setView({ kind: "signin" });
    if (error instanceof ApiError && error.status === 404) return setView({ kind: "invalid", requestId: error.requestId });
    const requestId = error instanceof ApiError ? error.requestId : "";
    const message = error instanceof ApiError && error.code === "ALREADY_MEMBER"
      ? "You are already a member of this workspace."
      : error instanceof ApiError && error.code === "MEMBERSHIP_DISABLED"
        ? "Your membership in this workspace is disabled. Ask an administrator to re-enable it."
        : "The invitation could not be processed.";
    setView({ kind: "error", message, requestId });
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
