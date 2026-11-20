"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";
import { switchWorkspace } from "@/lib/workspace-switch";

export default function SelectOrgPage() {
  const router = useRouter();
  const { organizations, setCurrentOrg, currentRole } = useAuthStore();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Task 1.3: selecting a workspace asks the API for an org-bound token and clears the previous workspace's caches.
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
    router.push(getRoleDashboardPath(currentRole, org.id));
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text-primary flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl bg-blue-600 items-center justify-center text-white font-bold text-xl shadow-md mb-3">
            P
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-app-text-primary">
            Select Organization Workspace
          </h1>
          <p className="text-sm text-app-text-secondary mt-1">
            Choose the organization you wish to collaborate in
          </p>
        </div>

        {error && (
          <p role="alert" className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}
        <div className="space-y-3">
          {organizations.map((org) => (
            <Card
              key={org.id}
              aria-busy={pending === org.id}
              className={`p-4 hover:border-blue-500 cursor-pointer transition-all flex items-center justify-between ${pending && pending !== org.id ? "opacity-60" : ""}`}
              onClick={() => void handleSelect(org)}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-app-text-primary">{org.name}</h3>
                  <p className="text-xs text-app-text-secondary">
                    {org.timezone} • {org.plan} Plan
                  </p>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-app-text-muted" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

