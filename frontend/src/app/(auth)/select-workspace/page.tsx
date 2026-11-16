"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";

export default function SelectWorkspacePage() {
  const router = useRouter();
  const { organizations, setCurrentOrgId } = useWorkspaceStore();
  const { currentRole, setCurrentOrg } = useAuthStore();

  const handleSelect = (orgId: string) => {
    setCurrentOrgId(orgId);
    const found = organizations.find((o) => o.id === orgId);
    if (found) setCurrentOrg(found);
    toast.success("Switched workspace");
    const dest = getRoleDashboardPath(currentRole, orgId);
    router.push(dest);
  };


  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <span className="text-2xl font-black tracking-tight text-primary-600 dark:text-primary-400">
            ProWise
          </span>
          <h1 className="text-xl font-bold mt-2">Choose your workspace</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Select an organization or create a new workspace to continue.
          </p>
        </div>

        <div className="space-y-3">
          {organizations.map((org) => (
            <Card
              key={org.id}
              onClick={() => handleSelect(org.id)}
              className="p-4 border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-primary-500 hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{org.name}</h3>
                  <span className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                    org/{org.slug} • {org.plan} Plan
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)]" />
            </Card>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link href="/create-organization">
            <Button variant="outline" className="w-full inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Create New Organization</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
