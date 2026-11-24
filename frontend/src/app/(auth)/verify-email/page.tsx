"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mail, CheckCircle2, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api";

/**
 * Landing page for the single-use link emailed after public signup (approved decision D9). The token comes from
 * the link; confirming activates the pending account, then the owner signs in and creates a workspace.
 * Confirmation needs a click so that mail scanners that pre-open links do not use the token up.
 */
export default function VerifyEmailPage() {
  const router = useRouter();
  const [token] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") || "",
  );
  const [isVerified, setIsVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Open the link from your email to confirm your address.");
      return;
    }
    setIsSubmitting(true);
    apiClient
      .verifyEmail(token)
      .then(() => {
        setIsVerified(true);
        toast.success("Your email is confirmed. You can sign in now.");
        setTimeout(() => router.push("/login"), 1500);
      })
      .catch(() =>
        toast.error("This link is invalid, already used or expired. Sign up again with the same address to get a new one."),
      )
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-2xl font-black tracking-tight text-primary-600 dark:text-primary-400">
            ProWise
          </span>
          <h1 className="text-xl font-bold mt-2">Verify your email</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Confirm the address you signed up with to activate your account. The link works once.
          </p>
        </div>

        <Card className="p-6 shadow-sm border border-[var(--color-border)] bg-[var(--color-surface)]">
          {isVerified ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold">Account Verified</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Redirecting you to sign in...
              </p>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
                <Mail className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                <span>
                  {token
                    ? "Select the button below to confirm your email address."
                    : "No confirmation link was found. Open the link from the email we sent you."}
                </span>
              </div>

              <Button type="submit" className="w-full" disabled={!token} isLoading={isSubmitting}>
                <span>Confirm my email</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>

              <div className="text-center pt-2">
                <Link href="/login" className="text-xs text-primary-600 hover:underline">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
