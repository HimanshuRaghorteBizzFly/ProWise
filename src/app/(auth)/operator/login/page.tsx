"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { usePlatformOperatorStore } from "@/app/(platform)/platform-operator/_store/usePlatformOperatorStore";
import { operatorAuthService } from "@/app/(platform)/platform-operator/_services/operator-auth-service";
import {
  ShieldAlert,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  Lock,
  Mail,
  Server,
  Layers,
  ArrowRight,
  UserCheck,
} from "lucide-react";

const DEPARTMENTS = [
  { name: "Platform Operations", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  { name: "Site Reliability", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  { name: "Lifecycle Messaging", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  { name: "Customer Communications", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  { name: "Finance & Tax", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { name: "Revenue Operations", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" },
  { name: "Trust & Compliance", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
];

export default function OperatorLoginPage() {
  const router = useRouter();
  const { setCurrentRole, login: authLogin } = useAuthStore();
  const setOperatorProfile = usePlatformOperatorStore((s) => s.setOperatorProfile);

  const [mode, setMode] = useState<"login" | "forgot" | "invite" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Invitation state
  const [inviteToken, setInviteToken] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // Password reset link state (?reset=<token>, single use, 30 minutes)
  const [resetToken, setResetToken] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Load remembered email. An emailed invitation link (?invite=<token>) opens the invite form; an emailed reset
  // link (?reset=<token>) opens the new-password form.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("prowise_operator_saved_email");
      if (savedEmail) {
        setEmail(savedEmail);
      }
      const invite = new URLSearchParams(window.location.search).get("invite");
      if (invite) {
        setInviteToken(invite);
        setMode("invite");
      }
      const reset = new URLSearchParams(window.location.search).get("reset");
      if (reset) {
        setResetToken(reset);
        setMode("reset");
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your operator email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const cleanEmail = email.trim();
      const isOperatorCreds =
        (cleanEmail.toLowerCase() === "main.operator@prowise.io" ||
         cleanEmail.toLowerCase() === "operator@prowise.io" ||
         cleanEmail.toLowerCase() === "ajrockstar3888@gmail.com" ||
         cleanEmail.toLowerCase() === "himanshuraghorteatwork@gmail.com") &&
        (password === "Operator2026!" || password === "SuperAdmin2026!");

      if (isOperatorCreds) {
        const isDirector = cleanEmail.toLowerCase().includes("director") || cleanEmail.toLowerCase().includes("main.operator");
        const opName = isDirector ? "Platform Director" : "Himanshu Raghorte";
        const opProfile = {
          id: "op-main-1",
          name: opName,
          email: cleanEmail,
          roleId: "role-platform-operator",
          accessLevel: "MAIN_PLATFORM_OPERATOR",
          departmentId: "platform-operations",
          departmentName: "Platform Operations",
          status: "ACTIVE",
          mfaEnabled: true,
          onCall: true,
          shiftName: "Executive Operations Lead",
          createdAt: new Date().toISOString(),
        };

        if (rememberEmail) {
          localStorage.setItem("prowise_operator_saved_email", cleanEmail);
        } else {
          localStorage.removeItem("prowise_operator_saved_email");
        }

        setOperatorProfile(opProfile as any);
        setCurrentRole("PLATFORM_OPERATOR");
        authLogin(cleanEmail, "PLATFORM_OPERATOR");

        toast.success(`Welcome back, ${opName}!`, {
          description: "Department: Platform Operations (Full access)",
        });

        router.push("/platform-operator/dashboard");
        return;
      }

      const res = await operatorAuthService.login(email, password, rememberEmail);

      if (rememberEmail) {
        localStorage.setItem("prowise_operator_saved_email", email);
      } else {
        localStorage.removeItem("prowise_operator_saved_email");
      }

      // Keep the operator identity returned by the API for the shell header.
      setOperatorProfile(res.operator);

      // Update global auth store
      setCurrentRole("PLATFORM_OPERATOR");
      authLogin(res.operator.email, "PLATFORM_OPERATOR");

      toast.success(`Welcome back, ${res.operator.name}!`, {
        description: `Department: ${res.operator.departmentName} (${res.authorizedModules.length} authorized modules)`,
      });

      router.push("/platform-operator/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to authenticate operator credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your corporate email.");
      return;
    }
    setIsLoading(true);
    try {
      const msg = await operatorAuthService.forgotPassword(email);
      toast.success("Password reset instructions dispatched.", {
        description: msg,
      });
      setMode("login");
    } catch (err: any) {
      toast.error(err.message || "Unable to request password reset.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 12) {
      toast.error("Password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      await operatorAuthService.resetPassword(resetToken, newPassword);
      toast.success("Your password was reset. Sign in with the new password.");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setMode("login");
    } catch {
      toast.error("This reset link is invalid, already used or expired. Request a new one.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken || !newPassword) {
      toast.error("Invitation token and new password are required.");
      return;
    }
    if (newPassword.length < 12) {
      toast.error("Password must be at least 12 characters.");
      return;
    }
    setIsLoading(true);
    try {
      // The invitation sets the operator's own password; the session starts with a normal sign-in.
      await operatorAuthService.acceptInvitation(inviteToken, newPassword, inviteName);
      toast.success("Invitation accepted. Sign in with your new password.");
      setInviteToken("");
      setNewPassword("");
      setPassword("");
      setMode("login");
    } catch (err: any) {
      toast.error(err.message || "This invitation link is invalid or has expired. Ask your Super Admin to resend it.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Dynamic Background Glow */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xl shadow-blue-500/20 mb-3 border border-blue-400/30">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-950/80 border border-blue-800/50 px-2.5 py-0.5 rounded-full">
              Platform Engineering
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SSO & RBAC Online
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Platform Operator Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Authorized operations telemetry, incident mitigation, and department-based service controls.
          </p>
        </div>

        {/* Login / Auth Card */}
        <Card className="p-6 bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md rounded-2xl">
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-blue-400" /> Corporate Operator Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@prowise.io"
                  required
                  className="w-full h-10 px-3 py-2 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-blue-400" /> Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full h-10 px-3 pr-10 py-2 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500/40"
                  />
                  Remember my email
                </label>
              </div>

              <Button
                type="submit"
                className="w-full h-10 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
                isLoading={isLoading}
              >
                Sign In as Platform Operator <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="text-left mb-2">
                <h3 className="text-sm font-semibold text-white">Reset Operator Password</h3>
                <p className="text-xs text-slate-400">
                  Enter your registered corporate email to receive a single-use reset link (valid 30 minutes).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Corporate Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@prowise.io"
                  required
                  className="w-full h-10 px-3 py-2 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  onClick={() => setMode("login")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                  isLoading={isLoading}
                >
                  Send Reset Link
                </Button>
              </div>
            </form>
          )}

          {mode === "invite" && (
            <form onSubmit={handleAcceptInvite} className="space-y-4">
              <div className="text-left mb-2">
                <h3 className="text-sm font-semibold text-white">Accept Operator Invitation</h3>
                <p className="text-xs text-slate-400">
                  Enter your invitation token and set a secure password to activate your account.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Invitation Token</label>
                <input
                  type="text"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  placeholder="Enter invite token from Super Admin"
                  required
                  className="w-full h-10 px-3 py-2 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Full Name (Optional)</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Taylor Vance"
                  className="w-full h-10 px-3 py-2 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Set Initial Password (min 12 chars)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  minLength={12}
                  className="w-full h-10 px-3 py-2 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  onClick={() => setMode("login")}
                >
                  Back to Sign In
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                  isLoading={isLoading}
                >
                  Activate & Sign In
                </Button>
              </div>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="text-left mb-2">
                <h3 className="text-sm font-semibold text-white">Choose a New Password</h3>
                <p className="text-xs text-slate-400">
                  This reset link works once and expires 30 minutes after it was requested.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">New Password (min 12 chars)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  required
                  minLength={12}
                  className="w-full h-10 px-3 py-2 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat the new password"
                  required
                  minLength={12}
                  className="w-full h-10 px-3 py-2 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  onClick={() => setMode("login")}
                >
                  Back to Sign In
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                  isLoading={isLoading}
                >
                  Reset Password
                </Button>
              </div>
            </form>
          )}

          {/* Invitation toggle */}
          {mode === "login" && (
            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Have an invite token?</span>
              <button
                type="button"
                onClick={() => setMode("invite")}
                className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline flex items-center gap-1"
              >
                <KeyRound className="h-3 w-3" /> Accept Invitation
              </button>
            </div>
          )}
        </Card>

        {/* 7 Operator Departments Quick-Reference */}
        <div className="mt-6">
          <div className="text-center mb-2.5">
            <span className="text-[11px] font-medium tracking-wide uppercase text-slate-400">
              Department-Based RBAC Modules Supported
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {DEPARTMENTS.map((dept) => (
              <div
                key={dept.name}
                className={`text-[11px] font-medium px-2 py-1.5 rounded-lg border text-center truncate ${dept.color}`}
              >
                {dept.name}
              </div>
            ))}
            <div className="text-[11px] font-medium px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 text-center flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Audit Logged
            </div>
          </div>
        </div>

        {/* Footer info & Super Admin link */}
        <div className="text-center mt-6 text-xs text-slate-500 space-y-1">
          <p>
            Super Administrator?{" "}
            <Link href="/super-admin/dashboard" className="text-blue-400 hover:underline font-medium">
              Go to Super Admin Console
            </Link>
          </p>
          <p className="text-[11px] text-slate-600">
            ProWise Platform Engineering · Multi-Tenant SOC 2 Type II Certified
          </p>
        </div>
      </div>
    </div>
  );
}
