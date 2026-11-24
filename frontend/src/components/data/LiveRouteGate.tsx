"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, FolderPlus, LayoutDashboard, UserPlus } from "lucide-react";

import { usePermissions } from "@/hooks/usePermissions";
import { previewEnabled } from "@/lib/permissions";
import { areaOf, isLiveRoute, laterInfoFor, type Area } from "@/lib/live-routes";

/**
 * Outside the dev preview (NEXT_PUBLIC_USE_MOCKS=true), pages without a backend never render: they show this
 * "Later (task X)" empty state instead, so no sample company, name or number can appear in normal use.
 */
export function LiveRouteGate({ children, shell }: {
  children: React.ReactNode;
  /** Wraps the Later page when the layout itself has no shell (the developer pages bring their own). */
  shell?: (content: React.ReactNode) => React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  if (previewEnabled() || isLiveRoute(pathname)) return <>{children}</>;
  const later = <LaterPage pathname={pathname} />;
  return <>{shell ? shell(later) : later}</>;
}

const TENANT_AREAS: readonly Area[] = ["owner", "admin", "manager", "lead", "developer", "reviewer", "viewer"];

export function LaterPage({ pathname }: { pathname: string }) {
  const info = laterInfoFor(pathname);
  const parsed = areaOf(pathname);
  const tenant = parsed !== null && TENANT_AREAS.includes(parsed.area);
  const base = parsed
    ? tenant ? pathname.match(/^\/org\/[^/]+\/[^/]+/)?.[0] ?? "/" : `/${parsed.area}`
    : "/";
  const label = info.task === "not in V1" ? "Not in V1" : info.task === "platform" ? "Later" : `Later · task ${info.task}`;
  return (
    <section className="p-4 sm:p-6" data-testid="later-page">
      <div className="mx-auto max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center space-y-3">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-[#1A73E8]">
          <Clock className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="inline-flex rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-secondary)]">
          {label}
        </p>
        <h1 className="text-base font-semibold text-[var(--color-text-primary)]">{info.title} is not available yet</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {info.task === "not in V1"
            ? "This part is outside the V1 release, so there is nothing to show."
            : "This part has no backend yet, so nothing is shown here: no sample names, numbers or charts."}
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Link href={`${base}/dashboard`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]">
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" /> Back to dashboard
          </Link>
          {tenant && <TenantNextSteps base={base} area={parsed!.area} />}
        </div>
      </div>
    </section>
  );
}

/** Real next steps, only where the active membership holds the permission. */
function TenantNextSteps({ base, area }: { base: string; area: Area }) {
  const { can } = usePermissions();
  const createPath = area === "manager" ? "create-project" : "projects/new";
  return (
    <>
      {can("project.create") && (area === "owner" || area === "admin" || area === "manager") && (
        <Link href={`${base}/${createPath}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A73E8] px-3 py-1.5 text-xs font-semibold text-white">
          <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" /> Create a project
        </Link>
      )}
      {can("member.invite") && (area === "owner" || area === "admin") && (
        <Link href={`${base}/invitations/new`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]">
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Invite your team
        </Link>
      )}
    </>
  );
}
