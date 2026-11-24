"use client";

import React from "react";
import Link from "next/link";
import { KeyRound, LogIn, RotateCcw, ShieldOff, UserX } from "lucide-react";
import { SurfaceCard } from "@/components/delivery/DeliveryUI";

/** Full-page access states in the Super Admin style (task 1.3). Never reveal what the hidden page contains. */

function StateCard({
  icon: Icon,
  tone,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  tone: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <SurfaceCard className="mx-auto max-w-lg p-6 text-center space-y-4 mt-6" role="alert">
      <div className={`mx-auto h-12 w-12 rounded-xl flex items-center justify-center ${tone}`}>
        <Icon className="w-6 h-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{description}</p>
      </div>
      {children && <div className="flex flex-wrap items-center justify-center gap-2 pt-1">{children}</div>}
    </SurfaceCard>
  );
}

const buttonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

/** 403: the workspace is visible, but this page needs a permission the membership does not hold. */
export function AccessDeniedState({ permission, backHref }: { permission?: string; backHref: string }) {
  return (
    <StateCard
      icon={ShieldOff}
      tone="bg-amber-500/15 text-amber-600 dark:text-amber-300"
      title="You don't have access to this page"
      description={
        permission
          ? `It needs the "${permission}" permission on your membership. Ask an owner or admin who holds it.`
          : "Your membership does not include the permission this page needs."
      }
    >
      <Link href={backHref} className={`${buttonClass} border border-[var(--color-border)] hover:bg-[var(--color-hover)]`}>
        Back to dashboard
      </Link>
    </StateCard>
  );
}

/** Membership disabled, removed or the workspace is not the selected one: nothing from it is shown. */
export function AccessLostState() {
  return (
    <StateCard
      icon={UserX}
      tone="bg-rose-500/15 text-rose-600 dark:text-rose-300"
      title="This workspace is no longer available"
      description="Your access to this workspace ended or another workspace is selected. Choose a workspace you are an active member of."
    >
      <Link href="/select-org" className={`${buttonClass} bg-[#1A73E8] text-white hover:bg-[#1557B0]`}>
        <KeyRound className="w-3.5 h-3.5" /> Choose workspace
      </Link>
    </StateCard>
  );
}

export function SessionExpiredState() {
  return (
    <StateCard
      icon={LogIn}
      tone="bg-blue-500/15 text-blue-600 dark:text-blue-300"
      title="Your session has ended"
      description="Sign in again to continue."
    >
      <Link href="/login" className={`${buttonClass} bg-[#1A73E8] text-white hover:bg-[#1557B0]`}>
        Sign in
      </Link>
    </StateCard>
  );
}

export function PermissionsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <StateCard
      icon={RotateCcw}
      tone="bg-slate-500/15 text-slate-600 dark:text-slate-300"
      title="We couldn't check your permissions"
      description="This page stays locked until your access is confirmed."
    >
      <button type="button" onClick={onRetry} className={`${buttonClass} border border-[var(--color-border)] hover:bg-[var(--color-hover)]`}>
        <RotateCcw className="w-3.5 h-3.5" /> Try again
      </button>
    </StateCard>
  );
}
