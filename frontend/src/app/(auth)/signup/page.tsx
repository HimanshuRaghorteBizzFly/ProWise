"use client";

import React, { useState } from "react";
import Link from "next/link";
<<<<<<< HEAD
import { useRouter } from "next/navigation";
import { ApiError, apiClient } from "@/lib/api";
import { establishSession } from "@/lib/session";
=======
import { apiClient } from "@/lib/api";
>>>>>>> 425eba1c2e8cca7686bf3db85b1311460d0d56e4
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ShieldAlert,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Sparkles
} from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const isPasswordLongEnough = password.length >= 12;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordLongEnough) {
      toast.error("Password must be at least 12 characters long.");
      return;
    }

    setIsLoading(true);
    setSignupError(null);
    try {
<<<<<<< HEAD
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      // The body never carries a role or an organization id: the server makes this user the one Owner of the new
      // organization and binds the session to it.
      const created = await apiClient.signup({
        email: email.trim(),
        password,
        name: name.trim(),
        organization: {
          name: orgName.trim(),
          slug,
          timezone,
          calendar: { workDays: [1, 2, 3, 4, 5], dailyHours: 8, holidays: [] },
        },
      });
      const session = await establishSession();
      toast.success("Workspace created. Welcome to your Owner dashboard.");
      router.replace(created.target_dashboard_url || session.target);
    } catch (error) {
      const reference = error instanceof ApiError && error.requestId ? ` (Reference: ${error.requestId})` : "";
      setSignupError(error instanceof ApiError && error.code === "EMAIL_IN_USE"
        ? "An account already exists for this email. Sign in instead."
        : error instanceof ApiError && error.code === "DUPLICATE_SLUG"
          ? "That company name is already taken. Choose another name."
          : `${error instanceof Error ? error.message : "Unable to create the workspace."}${reference}`);
=======
      // No session yet: the account activates from the emailed link (approved decision D9). The same answer is
      // shown whether or not the address was already registered.
      await apiClient.signup({ email: email.trim(), password, name: name.trim() });
      setSubmitted(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to register right now.");
>>>>>>> 425eba1c2e8cca7686bf3db85b1311460d0d56e4
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 overflow-hidden">
      {/* Decorative ambient gradient orbs */}
      <div className="absolute top-[-10rem] left-1/2 -translate-x-1/2 w-[38rem] h-[38rem] bg-gradient-to-tr from-blue-500/20 via-indigo-500/20 to-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10rem] right-[-5rem] w-80 h-80 bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative w-full max-w-lg">
        {/* Branding Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 items-center justify-center text-white font-bold text-2xl shadow-xl shadow-blue-500/25 mb-3 ring-4 ring-blue-500/10 transition-transform hover:scale-105">
            P
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Create Your Workspace
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Start delivering projects with mathematical certainty
          </p>
        </div>

        {/* Notice Banner */}
        <div className="mb-5 p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5 shadow-sm">
          <ShieldAlert className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="leading-relaxed">
            Confirm your email from the link we send, then sign in to create your workspace as its <strong>Organization Owner</strong>. Enterprise roles (<em>Super Admin</em> &amp; <em>Platform Operator</em>) are provisioned through centralized system administration.
          </div>
        </div>

        {/* Signup Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-black/50 p-6 sm:p-7 backdrop-blur-md">
          {submitted ? (
            <div className="text-center py-4" role="status">
              <Mail className="w-10 h-10 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Check your email</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                If <strong>{email.trim()}</strong> can be registered, we have sent a link to activate the account. It works
                once and expires in 72 hours. After activating, sign in to create your workspace.
              </p>
            </div>
          ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            {signupError && (
              <p role="alert" data-testid="signup-error"
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                {signupError}
              </p>
            )}
            {/* User Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Sarah Chen"
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Work Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <span className={`text-[11px] font-medium flex items-center gap-1 ${
                  isPasswordLongEnough ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                }`}>
                  {isPasswordLongEnough ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Length verified
                    </>
                  ) : (
                    "Min. 12 characters"
                  )}
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  minLength={12}
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

            {/* Register Submit Button */}
            <Button
              type="submit"
              className="w-full h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md shadow-blue-500/20 transition-all hover:shadow-lg active:scale-[0.99] gap-2 pt-1"
              isLoading={isLoading}
            >
              <span>Create Account</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>
          )}
        </div>

        {/* Back to Login Link */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors ml-1"
            >
              Sign in to your account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
