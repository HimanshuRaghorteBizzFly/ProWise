"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OperatorDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/platform-operator/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Redirecting to Platform Operator Dashboard...
      </div>
    </div>
  );
}
