"use client";

<<<<<<< HEAD
import { SelectWorkspaceView } from "@/components/auth/WorkspaceViews";

/** Older path kept for existing links: same workspace picker as /select-workspace. */
export default function SelectOrgPage() {
  return <SelectWorkspaceView />;
=======
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { readChoices, toSystemRole } from "@/lib/auth-session";
import { switchWorkspace } from "@/lib/workspace-switch";
import { getRoleDashboardPath, useAuthStore } from "@/store/auth-store";

const ROLE_LABEL: Record<string, string> = {
  ORGANIZATION_OWNER: "Owner",
  ORGANIZATION_ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  TEAM_LEAD: "Team Lead",
  DEVELOPER: "Developer",
  QA_REVIEWER: "QA / Reviewer",
  VIEWER: "Viewer",
};

/**
 * Organization chooser for a person with several memberships. Choosing asks the API for a token bound to that
 * organization (task 1.3) and opens the dashboard of the role held there; the role comes from the server.
 */
export default function SelectOrgPage() {
  const router = useRouter();
  const { organizations, setCurrentOrg, currentRole } = useAuthStore();
  const [choices] = React.useState(() => (typeof window === "undefined" ? [] : readChoices()));
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const roleFor = (orgId: string) => choices.find((c) => c.organization_id === orgId)?.role;

  const handleSelect = async (org: (typeof organizations)[number]) => {
    if (pending) return;
    setPending(org.id);
    setError(null);
    const result = await switchWorkspace(org.id);
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCurrentOrg(org);
    const role = toSystemRole(result.role ?? roleFor(org.id)) ?? currentRole;
    router.push(result.targetDashboardUrl || getRoleDashboardPath(role, org.id));
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text-primary flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl bg-blue-600 items-center justify-center text-white font-bold text-xl shadow-md mb-3">
            P
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-app-text-primary">Choose an organization</h1>
          <p className="text-sm text-app-text-secondary mt-1">You belong to more than one. Your role can differ in each.</p>
        </div>

        {error && (
          <p role="alert" className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}
        {organizations.length === 0 ? (
          <Card className="p-4 text-sm text-app-text-secondary">
            No organization is available to this account.{" "}
            <Link href="/login" className="text-blue-600 hover:underline">Sign in again</Link>
          </Card>
        ) : (
          <ul className="space-y-3">
            {organizations.map((org) => {
              const role = roleFor(org.id);
              return (
                <li key={org.id}>
                  <button
                    type="button"
                    aria-busy={pending === org.id}
                    disabled={!!pending}
                    onClick={() => void handleSelect(org)}
                    className={`w-full text-left rounded-xl border border-app-border bg-app-surface p-4 hover:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all flex items-center justify-between ${pending && pending !== org.id ? "opacity-60" : ""}`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="h-10 w-10 shrink-0 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center">
                        <Building2 className="w-5 h-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-sm truncate">{org.name}</span>
                        {role && <span className="block text-xs text-app-text-secondary">{ROLE_LABEL[role] ?? role}</span>}
                      </span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-app-text-muted shrink-0" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
>>>>>>> 425eba1c2e8cca7686bf3db85b1311460d0d56e4
}
