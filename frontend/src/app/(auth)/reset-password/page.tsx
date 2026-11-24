"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { ApiError, apiClient } from "@/lib/api";
import { isPasswordAcceptable } from "@/lib/password-policy";
import { PasswordInput, PasswordStrengthChecklist } from "@/components/auth/PasswordFields";

/**
 * Account setup links (setup=1, 72 hours, activates a pending account such as the first Super Admin) and
 * password reset links (30 minutes) share this page. Both are single use; the password is sent once over HTTPS
 * and never stored in the browser.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") || "",
  );
  const [isSetup] = useState(() =>
    typeof window === "undefined" ? false : new URLSearchParams(window.location.search).get("setup") === "1",
  );
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This link is missing its token. Open the link from your email again.");
      return;
    }
    if (!isPasswordAcceptable(password)) {
      setError("The password does not meet every requirement below.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      if (isSetup) await apiClient.activateAccount(token, password);
      else await apiClient.confirmPasswordReset(token, password);
      setPassword("");
      setConfirmPassword("");
      setIsSuccess(true);
      toast.success(isSetup ? "Your account is ready." : "Your password was reset.");
      setTimeout(() => router.push("/login?password=changed"), 2500);
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_FAILED") {
        setError(err.message);
      } else {
        setError(
          isSetup
            ? "This setup link is invalid, already used or expired. Ask your administrator to resend it."
            : "This reset link is invalid, already used or expired. Request a new one.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-2xl font-black tracking-tight text-primary-600 dark:text-primary-400">ProWise</span>
          <h1 className="text-xl font-bold mt-2">{isSetup ? "Set your password" : "Reset your password"}</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {isSetup
              ? "Choose your own password to activate your account. This link works once."
              : "Enter a strong new password for your account. Signing in elsewhere will end."}
          </p>
        </div>

        <Card className="p-6 shadow-sm border border-[var(--color-border)] bg-[var(--color-surface)]">
          {isSuccess ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold">{isSetup ? "Account activated" : "Password changed successfully"}</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                You can now sign in with your new password. Redirecting to sign in…
              </p>
              <Link href="/login" className="inline-block mt-3 text-xs text-blue-600 hover:underline">
                Go to sign in now
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <PasswordInput
                id="new-password"
                label="New Password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                placeholder="At least 12 characters"
              />
              <PasswordStrengthChecklist password={password} />
              <PasswordInput
                id="confirm-password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                placeholder="Repeat new password"
                error={mismatch ? "Passwords do not match." : undefined}
              />
              {error && (
                <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                <span>{submitting ? "Saving…" : isSetup ? "Activate account" : "Update password"}</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
              {!isSetup && (
                <p className="text-center text-[11px] text-[var(--color-text-muted)]">
                  Link expired? <Link href="/forgot-password" className="text-blue-600 hover:underline">Request a new one</Link>
                </p>
              )}
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
