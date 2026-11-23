"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock, CheckCircle2, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") || "",
  );
  // Account setup links (72 hours) and reset links (30 minutes) share this page and the same single-use flow.
  const [isSetup] = useState(() =>
    typeof window === "undefined" ? false : new URLSearchParams(window.location.search).get("setup") === "1",
  );
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 12) {
      toast.error("Password must be at least 12 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    apiClient.confirmPasswordReset(token, password)
      .then(() => {
        setIsSuccess(true);
        toast.success(isSetup ? "Your account is ready." : "Your password was reset.");
        setTimeout(() => router.push("/login"), 1500);
      })
      .catch(() =>
        toast.error(
          isSetup
            ? "This setup link is invalid, already used or expired. Ask your administrator to resend it."
            : "This reset link is invalid, already used or expired. Request a new one.",
        ),
      );
  };

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-2xl font-black tracking-tight text-primary-600 dark:text-primary-400">
            ProWise
          </span>
          <h1 className="text-xl font-bold mt-2">{isSetup ? "Set up your account" : "Reset your password"}</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {isSetup
              ? "Choose your own password to activate your account. This link works once."
              : "Enter a strong new password for your account."}
          </p>
        </div>

        <Card className="p-6 shadow-sm border border-[var(--color-border)] bg-[var(--color-surface)]">
          {isSuccess ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold">{isSetup ? "Account activated" : "Password updated"}</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Redirecting you to login...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 12 characters"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                <span>{isSetup ? "Activate account" : "Update password"}</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

