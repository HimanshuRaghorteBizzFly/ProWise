"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { currentRole, currentOrg } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      const destination = getRoleDashboardPath(currentRole, currentOrg?.id || "org-1");
      router.push(destination);
    }, 800);
    return () => clearTimeout(timer);
  }, [currentRole, currentOrg, router]);

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          Authenticating session and preparing workspace...
        </p>
      </div>
    </div>
  );
}

