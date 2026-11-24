"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, LogOut, Plus } from "lucide-react";

import { apiClient } from "@/lib/api";
import { NO_WORKSPACE_PATH, SELECT_WORKSPACE_PATH, establishSession } from "@/lib/session";
import { switchWorkspace } from "@/lib/workspace-switch";
import { useAuthStore } from "@/store/auth-store";
import type { MeResponse } from "@/types/api";
import {
  AdminButton,
  ErrorBanner,
  PageSkeleton,
  StatusBadge,
  SurfaceCard,
} from "@/components/delivery/DeliveryUI";

/** Workspace picker and "no workspace yet" (sign-in landing). Super Admin theme, no popups. */

export const ROLE_LABEL: Record<string, string> = {
  ORGANIZATION_OWNER: "Organization Owner",
  ORGANIZATION_ADMIN: "Organization Admin",
  PROJECT_MANAGER: "Project Manager",
  TEAM_LEAD: "Team Lead",
  DEVELOPER: "Developer",
  QA_REVIEWER: "QA / Reviewer",
  VIEWER: "Viewer",
};

type Membership = MeResponse["memberships"][number];

function Frame({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 rounded-xl bg-[#1A73E8] items-center justify-center text-white font-bold text-xl shadow-md mb-3">P</div>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Loads GET /v1/me; returns null while loading. */
function useMe() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [failed, setFailed] = useState<"unauthenticated" | "error" | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(null);
    apiClient.me()
      .then((value) => { if (active) setMe(value); })
      .catch((error: unknown) => {
        if (!active) return;
        const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 0;
        setFailed(status === 401 ? "unauthenticated" : "error");
      });
    return () => { active = false; };
  }, [attempt]);
  return { me, failed, retry: () => setAttempt((value) => value + 1) };
}

function SignedOut() {
  return (
    <SurfaceCard className="p-5 space-y-3 text-center">
      <p className="text-sm font-semibold">Your session has ended</p>
      <p className="text-xs text-[var(--color-text-secondary)]">Sign in again to continue.</p>
      <Link href="/login" className="inline-flex items-center justify-center rounded-lg bg-[#1A73E8] px-4 py-2 text-xs font-semibold text-white">Sign in</Link>
    </SurfaceCard>
  );
}

function useSignOut() {
  const router = useRouter();
  return async () => {
    try { await apiClient.signout(); } catch { /* the session may already be gone */ }
    useAuthStore.getState().logout();
    router.replace("/login");
  };
}

/* ------------------------------------------------------------------ picker */

export function WorkspacePickerList({ memberships, pending, onSelect }: {
  memberships: Membership[];
  pending: string | null;
  onSelect: (membership: Membership) => void;
}) {
  return (
    <ul className="space-y-3" data-testid="workspace-picker">
      {memberships.map((membership) => (
        <li key={membership.org_id}>
          <button type="button" onClick={() => onSelect(membership)} disabled={pending !== null}
            aria-busy={pending === membership.org_id}
            className="w-full text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[#1A73E8] transition-colors flex items-center justify-between gap-3 disabled:opacity-60">
            <span className="flex items-center gap-3 min-w-0">
              <span className="h-10 w-10 shrink-0 rounded-lg bg-blue-500/10 text-[#1A73E8] flex items-center justify-center"><Building2 className="w-5 h-5" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">{membership.name}</span>
                <span className="block text-[11px] text-[var(--color-text-secondary)] font-mono truncate">org/{membership.slug} · {membership.timezone}</span>
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <StatusBadge label={ROLE_LABEL[membership.role_template] ?? membership.role_template} tone="info" />
              <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)]" />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SelectWorkspaceView() {
  const router = useRouter();
  const { me, failed, retry } = useMe();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signOut = useSignOut();

  useEffect(() => {
    if (me && me.memberships.length === 0 && !me.platform_account) router.replace(NO_WORKSPACE_PATH);
  }, [me, router]);

  const select = async (membership: Membership) => {
    setPending(membership.org_id);
    setError(null);
    // Task 1.3: the server issues a token bound to the chosen organization; the landing then follows that membership.
    const result = await switchWorkspace(membership.org_id);
    if (!result.ok) {
      setPending(null);
      setError(result.message);
      return;
    }
    try {
      const session = await establishSession();
      router.replace(session.target);
    } catch {
      setPending(null);
      setError("The workspace could not be opened. Try again.");
    }
  };

  return (
    <Frame title="Choose your workspace" description="You belong to more than one organization. Pick the one to work in now.">
      {failed === "unauthenticated" ? <SignedOut />
        : failed === "error" ? <ErrorBanner message="Your workspaces could not be loaded." onRetry={retry} />
          : !me ? <PageSkeleton variant="list" />
            : (
              <>
                {error && <ErrorBanner message={error} />}
                <WorkspacePickerList memberships={me.memberships} pending={pending} onSelect={(m) => void select(m)} />
                <div className="flex flex-wrap justify-between gap-2">
                  <Link href="/create-organization" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1A73E8]">
                    <Plus className="w-3.5 h-3.5" /> Create another company
                  </Link>
                  <AdminButton variant="ghost" size="sm" onClick={() => void signOut()}><LogOut className="w-3.5 h-3.5" /> Sign out</AdminButton>
                </div>
              </>
            )}
    </Frame>
  );
}

/* ------------------------------------------------------------------ no workspace yet */

export function NoWorkspaceContent({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <SurfaceCard className="p-5 space-y-4" data-testid="no-workspace">
      <div className="space-y-1">
        <p className="text-sm font-semibold">No workspace yet</p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {email} is not an active member of any organization. Ask your company for an invitation, or create your own
          company and become its Owner.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/create-organization"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A73E8] px-4 py-2 text-xs font-semibold text-white">
          <Plus className="w-3.5 h-3.5" /> Create a company
        </Link>
        <AdminButton variant="outline" size="sm" onClick={onSignOut}><LogOut className="w-3.5 h-3.5" /> Sign out</AdminButton>
      </div>
    </SurfaceCard>
  );
}

export function NoWorkspaceView() {
  const router = useRouter();
  const { me, failed, retry } = useMe();
  const signOut = useSignOut();

  useEffect(() => {
    // Someone who does have a workspace (or a platform account) does not belong here.
    if (me && (me.platform_account || me.memberships.length > 0)) {
      router.replace(me.target_dashboard_url && me.target_dashboard_url !== NO_WORKSPACE_PATH
        ? me.target_dashboard_url : SELECT_WORKSPACE_PATH);
    }
  }, [me, router]);

  return (
    <Frame title="Welcome to ProWise" description="You are signed in, but there is no workspace to open yet.">
      {failed === "unauthenticated" ? <SignedOut />
        : failed === "error" ? <ErrorBanner message="Your account could not be loaded." onRetry={retry} />
          : !me ? <PageSkeleton variant="detail" />
            : <NoWorkspaceContent email={me.email} onSignOut={() => void signOut()} />}
    </Frame>
  );
}
