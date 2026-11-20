"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MaintenanceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/super-admin/maintenance");
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center text-xs text-[var(--color-text-muted)]">
      Loading Maintenance Mode...
    </div>
  );
}
