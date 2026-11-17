"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";

export default function UnauthorizedPage() {
  const router = useRouter();
  const { currentRole, currentOrg } = useAuthStore();
  const homePath = getRoleDashboardPath(currentRole, currentOrg.id);

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)] flex flex-col justify-center items-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-4 shadow-modal border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
          Access Denied (403 Forbidden)
        </h1>

        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
          You do not possess the required scoped permissions to view or perform operations on this
          tenant resource. Under the ProWise Blueprint V1.1 security policy, role grants are strictly
          isolated per organization and project.
        </p>

        <div className="pt-4 flex flex-col gap-2">
          <Button onClick={() => router.push(homePath)} className="w-full">
            <span>Return to Permitted Dashboard</span>
          </Button>

          <Link href="/login">
            <Button variant="outline" className="w-full">
              Switch User Account
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
