"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";
import { SEEDED_ORGS } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";

export default function SelectOrgPage() {
  const router = useRouter();
  const { currentOrg, setCurrentOrg, currentRole } = useAuthStore();

  const handleSelect = (org: typeof SEEDED_ORGS[0]) => {
    setCurrentOrg(org);
    const dest = getRoleDashboardPath(currentRole, org.id);
    router.push(dest);
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

        <div className="space-y-3">
          {SEEDED_ORGS.map((org) => (
            <Card
              key={org.id}
              className="p-4 hover:border-blue-500 cursor-pointer transition-all flex items-center justify-between"
              onClick={() => handleSelect(org)}
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

