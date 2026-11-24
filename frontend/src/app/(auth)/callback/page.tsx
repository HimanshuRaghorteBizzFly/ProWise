"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { establishSession } from "@/lib/session";

/** Lands from the server session (GET /v1/me), never from the store's default role or organization. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    establishSession()
      .then((session) => { if (active) router.replace(session.target); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] flex items-center justify-center p-4">
      {failed ? (
        <div role="alert" className="text-center space-y-2">
          <p className="text-sm font-semibold">We could not finish signing you in.</p>
          <a href="/login" className="text-xs font-semibold text-[#1A73E8]">Back to sign in</a>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">Preparing your workspace…</p>
        </div>
      )}
    </div>
  );
}
