"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { usePlatformOperatorStore } from "@/app/(platform)/platform-operator/_store/usePlatformOperatorStore";
import { operatorAuthService } from "@/app/(platform)/platform-operator/_services/operator-auth-service";
import { applyLoginResponse } from "@/lib/auth-session";
import { attemptLogin, loginErrorMessage } from "@/lib/login-flow";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get("email") || localStorage.getItem("prowise_reset_email");
      if (urlEmail) setEmail(urlEmail);

      if (params.get("password") === "changed") {
        toast.success("Password reset successfully! Please sign in with your new password.");
      }
    }
  }, []);

  const executeLogin = async (targetEmail: string, targetPass: string) => {
    const cleanEmail = targetEmail.trim();
    if (!cleanEmail || !targetPass) {
      toast.error("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    setLoginError(null);
    try {
      const attempt = await attemptLogin(apiClient.login, cleanEmail, targetPass);

      if (!attempt.ok) {
        const backendError = attempt.error;

        // A platform operator signs in through the operator endpoint with the same form.
        if (backendError.status === 401 && backendError.code === "INVALID_CREDENTIALS") {
          const operatorDestination = await tryOperatorLogin(cleanEmail, targetPass);
          if (operatorDestination) {
            window.location.assign(operatorDestination);
            return;
          }
        }

        const message = loginErrorMessage(backendError);
        setLoginError(message);
        toast.error(message);
        setIsLoading(false);
        return;
      }

      const response = attempt.response;
      if (response.must_change_password) {
        applyLoginResponse(response);
        toast.info("Temporary password detected. Please set your new password.");
        window.location.assign("/change-password");
        return;
      }

      // The role and destination come only from the server's answer.
      const destination = applyLoginResponse(response);
      const roleText = (response.user.role ?? "member").replace(/_/g, " ").toLowerCase();
      toast.success(
        response.requires_organization_selection
          ? "Signed in. Choose the organization to open."
          : `Signed in as ${roleText}.`,
      );
      window.location.assign(destination);
    } catch (err) {
      const message = err instanceof ApiError ? loginErrorMessage(err) : err instanceof Error ? err.message : "Unable to complete sign in.";
      setLoginError(message);
      toast.error(message);
      setIsLoading(false);
    }
  };

  /** Platform Operator sign-in through the real operator endpoint; null when the account is not an operator. */
  const tryOperatorLogin = async (operatorEmail: string, operatorPassword: string): Promise<string | null> => {
    try {
      const res = await operatorAuthService.login(operatorEmail, operatorPassword, false);
      usePlatformOperatorStore.getState().setOperatorProfile(res.operator);
      useAuthStore.getState().setCurrentRole("PLATFORM_OPERATOR");
      useAuthStore.getState().login(res.operator.email, "PLATFORM_OPERATOR");
      toast.success(`Welcome back, ${res.operator.name}.`);
      return "/platform-operator/dashboard";
    } catch {
      return null;
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(email, password);
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 overflow-hidden">
      {/* Decorative ambient gradient orbs */}
      <div className="absolute top-[-10rem] left-1/2 -translate-x-1/2 w-[38rem] h-[38rem] bg-gradient-to-tr from-blue-500/20 via-indigo-500/20 to-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10rem] right-[-5rem] w-80 h-80 bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative w-full max-w-md transition-all">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 items-center justify-center text-white font-bold text-2xl shadow-xl shadow-blue-500/25 mb-3 ring-4 ring-blue-500/10 transition-transform hover:scale-105">
            P
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Welcome to ProWise
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Enterprise Project Delivery &amp; Operations Management
          </p>
        </div>

        {/* Main Login Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-black/50 p-6 sm:p-7 backdrop-blur-md">
          <form onSubmit={handleCustomLogin} className="space-y-4">
            {/* Work Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Work Email / Gmail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-9 pr-10 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 bg-white dark:bg-slate-800"
                />
                Remember me on this browser
              </label>
            </div>

            {loginError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"
              >
                {loginError}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md shadow-blue-500/20 transition-all hover:shadow-lg active:scale-[0.99] gap-2"
              isLoading={isLoading}
            >
              <span>Sign In to Dashboard</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          {/* Security Assurance */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Spring Security 6 • 256-bit JWT Encryption • Zero Trust</span>
          </div>
        </div>

        {/* Signup Link */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Need an organization workspace?{" "}
            <Link
              href="/signup"
              className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors ml-1"
            >
              Create an organization
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
