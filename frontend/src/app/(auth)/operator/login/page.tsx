"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { usePlatformOperatorStore } from "@/app/(platform)/platform-operator/_store/usePlatformOperatorStore";
import {
  OPERATOR_FIRST_LOGIN_KEY,
  operatorAuthService,
} from "@/app/(platform)/platform-operator/_services/operator-auth-service";
import { ShieldAlert, Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";

export default function OperatorLoginPage() {
  const router = useRouter();
  const { setCurrentRole, login: authLogin } = useAuthStore();
  const setOperatorProfile = usePlatformOperatorStore((s) => s.setOperatorProfile);

  // "first-login": the emailed temporary password was accepted and must be replaced before the first session.
  const [mode, setMode] = useState<"login" | "forgot" | "invite" | "reset" | "first-login">("login");
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
      // Handed over by the main /login page after it accepted the emailed temporary password (read once).
      const handoff = sessionStorage.getItem(OPERATOR_FIRST_LOGIN_KEY);
      sessionStorage.removeItem(OPERATOR_FIRST_LOGIN_KEY);
      if (handoff) {
        try {
          const { email: handoffEmail, temporaryPassword } = JSON.parse(handoff) as {
            email?: string;
            temporaryPassword?: string;
          };
          if (handoffEmail && temporaryPassword) {
            setEmail(handoffEmail);
            setPassword(temporaryPassword);
            setMode("first-login");
          }
        } catch {
          // Ignore a malformed hand-off: the normal sign-in form is shown.
        }
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
      await signInAndOpenConsole(email, password);
    } catch (err: any) {
      if (err?.code === "PASSWORD_CHANGE_REQUIRED") {
        // The temporary password from the welcome email is right; the server opens no session until it is replaced.
        setNewPassword("");
        setConfirmPassword("");
        setMode("first-login");
        return;
      }
      toast.error(err.message || "Failed to authenticate operator credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const signInAndOpenConsole = async (signInEmail: string, signInPassword: string) => {
    const res = await operatorAuthService.login(signInEmail, signInPassword, rememberEmail);

    if (rememberEmail) {
      localStorage.setItem("prowise_operator_saved_email", signInEmail);
    } else {
      localStorage.removeItem("prowise_operator_saved_email");
    }

    // Keep the operator identity returned by the API for the shell header.
    setOperatorProfile(res.operator);

    // Update global auth store
    setCurrentRole("PLATFORM_OPERATOR");
    authLogin(res.operator.email, "PLATFORM_OPERATOR");

    toast.success(`Welcome, ${res.operator.name}!`, {
      description: `Department: ${res.operator.departmentName} (${res.authorizedModules.length} authorized modules)`,
    });

    router.push("/platform-operator/dashboard");
  };

  /** Exchanges the single-use temporary password for the operator's own password, then signs in with it. */
  const handleFirstLoginPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 12) {
      toast.error("Password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (newPassword === password) {
      toast.error("Choose a password different from the temporary one.");
      return;
    }
    setIsLoading(true);
    try {
      await operatorAuthService.acceptInvitation(password, newPassword);
    } catch (err: any) {
      // Policy failures keep the temporary password usable; an expired or used one needs a new email.
      toast.error(err?.message || "Your temporary password has expired. Ask your Super Admin to send a new one.");
      setIsLoading(false);
      return;
    }
    try {
      await signInAndOpenConsole(email, newPassword);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Your password was set. Sign in with it.");
      setPassword("");
      setMode("login");
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-600 text-white mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Operator Sign In</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to the ProWise operations console.</p>
        </div>

        {/* Login / Auth Card */}
        <Card className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-blue-400" /> Email
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
                className="w-full h-10 font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                isLoading={isLoading}
              >
                Sign In <ArrowRight className="h-4 w-4" />
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

          {mode === "first-login" && (
            <form onSubmit={handleFirstLoginPassword} className="space-y-4">
              <div className="text-left mb-2">
                <h3 className="text-sm font-semibold text-white">Choose Your New Password</h3>
                <p className="text-xs text-slate-400">
                  You signed in with the temporary password from your welcome email. Choose your own password to
                  continue; the temporary one stops working. You can change it again later from Settings.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">New Password (min 12 chars)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  autoComplete="new-password"
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
                  autoComplete="new-password"
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
                  onClick={() => {
                    setPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setMode("login");
                  }}
                >
                  Back to Sign In
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                  isLoading={isLoading}
                >
                  Save & Sign In
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

        </Card>

        <p className="text-center mt-5 text-xs text-slate-500">
          New operator? Sign in with the email and temporary password from your welcome email.
        </p>
      </div>
    </div>
  );
}
