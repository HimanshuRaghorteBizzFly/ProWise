"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock, CheckCircle2, ShieldCheck, KeyRound, AlertCircle, Eye, EyeOff } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const passwordChecks = useMemo(() => {
    return {
      minLength: newPassword.length >= 8,
      hasUpper: /[A-Z]/.test(newPassword),
      hasLower: /[a-z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
      hasSpecial: /[^A-Za-z0-9]/.test(newPassword),
    };
  }, [newPassword]);

  const passwordStrengthScore = useMemo(() => {
    let score = 0;
    if (passwordChecks.minLength) score += 1;
    if (passwordChecks.hasUpper) score += 1;
    if (passwordChecks.hasLower) score += 1;
    if (passwordChecks.hasNumber) score += 1;
    if (passwordChecks.hasSpecial) score += 1;
    return score;
  }, [passwordChecks]);

  const strengthLabel = useMemo(() => {
    if (!newPassword) return "";
    if (passwordStrengthScore <= 2) return "Weak";
    if (passwordStrengthScore <= 4) return "Medium";
    return "Strong";
  }, [newPassword, passwordStrengthScore]);

  const strengthColor = useMemo(() => {
    if (!newPassword) return "bg-gray-200 dark:bg-gray-700";
    if (passwordStrengthScore <= 2) return "bg-rose-500";
    if (passwordStrengthScore <= 4) return "bg-amber-500";
    return "bg-emerald-500";
  }, [newPassword, passwordStrengthScore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordChecks.minLength) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.changePassword({
        currentPassword: currentPassword.trim() || undefined,
        newPassword: newPassword.trim(),
      });

      setIsSuccess(true);
      toast.success("Password changed successfully! Redirecting...");

      // Fetch updated profile to route to the correct dashboard
      try {
        const me = await apiClient.me();
        const role = (me as any).role || "VIEWER";
        const targetUrl = (me as any).target_dashboard_url || "/select-org";
        useAuthStore.getState().setCurrentRole(role);
        setTimeout(() => {
          router.push(targetUrl);
        }, 1200);
      } catch {
        setTimeout(() => {
          router.push("/dashboard");
        }, 1200);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change password. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 rounded-xl bg-blue-600 items-center justify-center text-white font-bold text-xl shadow-md mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Change Password
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1 max-w-sm mx-auto">
            Please create a secure new password for your ProWise account before continuing.
          </p>
        </div>

        {/* Form Card */}
        <Card className="p-6 shadow-md border border-[var(--color-border)] bg-[var(--color-surface)]">
          {isSuccess ? (
            <div className="text-center py-6 space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                Password Successfully Updated
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Your credentials are secure. Taking you to your dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Security Notice */}
              <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  For security, temporary passwords expire upon first login. Please choose a strong password.
                </span>
              </div>

              {/* Current Password (Optional if newly logged in with temporary) */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                  Current / Temporary Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
                  <Input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current or temporary password"
                    className="pl-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    tabIndex={-1}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
                  <Input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="pl-9 pr-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--color-text-muted)]">Strength:</span>
                      <span className="font-medium text-[var(--color-text-secondary)]">{strengthLabel}</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${strengthColor}`}
                        style={{ width: `${(passwordStrengthScore / 5) * 100}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-[var(--color-text-muted)] pt-1">
                      <span className={passwordChecks.minLength ? "text-emerald-500" : ""}>
                        • 8+ characters
                      </span>
                      <span className={passwordChecks.hasUpper ? "text-emerald-500" : ""}>
                        • Uppercase letter
                      </span>
                      <span className={passwordChecks.hasLower ? "text-emerald-500" : ""}>
                        • Lowercase letter
                      </span>
                      <span className={passwordChecks.hasNumber ? "text-emerald-500" : ""}>
                        • Number or symbol
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
                Update Password &amp; Continue
              </Button>
            </form>
          )}
        </Card>

        {/* Back Link */}
        <p className="text-center text-xs text-[var(--color-text-secondary)] mt-6">
          Need help? Contact your{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Super Administrator
          </Link>
        </p>
      </div>
    </div>
  );
}
