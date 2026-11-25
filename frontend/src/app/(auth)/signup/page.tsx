"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PASSWORD_RULES } from "@/lib/password-policy";
import { WORKSPACE_TIMEZONES, browserTimezone, validateSignup } from "@/lib/signup-validation";
import { toast } from "sonner";
import {
  ShieldAlert,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Building2,
  Globe,
  Check,
  Circle,
} from "lucide-react";

const INPUT =
  "w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition";

function inputClass(hasError: boolean, extra = "") {
  return `${INPUT} ${hasError ? "border-rose-400 dark:border-rose-500" : "border-slate-300 dark:border-slate-700"} ${extra}`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[11px] text-rose-600 dark:text-rose-400">
      {message}
    </p>
  );
}

/**
 * Organization signup. The account and the workspace it will own are registered together; nothing is active until
 * the emailed link is confirmed (decision D9). Confirming creates the organization with this account as its
 * Organization Owner, so the first sign-in lands on the owner dashboard.
 */
export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // The browser's zone is only known on the client; read it after mount to keep server and client markup equal.
  useEffect(() => {
    setTimezone(browserTimezone());
  }, []);

  const timezoneOptions = WORKSPACE_TIMEZONES.some((z) => z.value === timezone)
    ? WORKSPACE_TIMEZONES
    : [{ value: timezone, label: `${timezone} (your timezone)` }, ...WORKSPACE_TIMEZONES];

  const clearError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateSignup({ name, email, password, organizationName, timezone });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setIsLoading(true);
    try {
      // No session yet: the account activates from the emailed link. The same answer is shown whether or not the
      // address was already registered.
      await apiClient.signup({
        email: email.trim(),
        password,
        name: name.trim(),
        organization_name: organizationName.trim().replace(/\s+/g, " "),
        timezone,
      });
      setSubmitted(true);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors?.length) {
        const fromServer: Record<string, string> = {};
        for (const fe of error.fieldErrors) {
          if (fe?.field && !fromServer[fe.field]) fromServer[fe.field] = fe.message;
        }
        setErrors(fromServer);
      }
      toast.error(error instanceof Error ? error.message : "Unable to register right now.");
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
            Registering provisions you as an <strong>Organization Owner</strong> of your new workspace. Enterprise roles (
            <em>Super Admin</em> &amp; <em>Platform Operator</em>) are provisioned through centralized system administration.
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
                once and expires in 72 hours. Confirming it creates <strong>{organizationName.trim()}</strong> with you as
                its Organization Owner. Then sign in to go straight to your workspace.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Go to sign in <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4" noValidate aria-label="Organization signup">
              {/* User Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label htmlFor="signup-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="signup-name"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearError("name");
                      }}
                      placeholder="e.g. Dr. Sarah Chen"
                      autoComplete="name"
                      maxLength={200}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? "signup-name-error" : undefined}
                      className={inputClass(Boolean(errors.name))}
                    />
                  </div>
                  <FieldError id="signup-name-error" message={errors.name} />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="signup-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Work Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearError("email");
                      }}
                      placeholder="name@company.com"
                      autoComplete="email"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "signup-email-error" : undefined}
                      className={inputClass(Boolean(errors.email))}
                    />
                  </div>
                  <FieldError id="signup-email-error" message={errors.email} />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label htmlFor="signup-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError("password");
                    }}
                    placeholder="At least 12 characters"
                    autoComplete="new-password"
                    maxLength={200}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby="signup-password-rules"
                    className={inputClass(Boolean(errors.password), "pr-10")}
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
                <ul id="signup-password-rules" className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-0.5">
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(password);
                    return (
                      <li
                        key={rule.id}
                        className={`flex items-center gap-1 text-[11px] ${
                          met ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                        }`}
                      >
                        {met ? <Check className="w-3 h-3" /> : <Circle className="w-2.5 h-2.5" />}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
                <FieldError id="signup-password-error" message={errors.password} />
              </div>

              {/* Organization Name */}
              <div className="space-y-1.5">
                <label htmlFor="signup-org" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Organization / Workspace Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    id="signup-org"
                    type="text"
                    value={organizationName}
                    onChange={(e) => {
                      setOrganizationName(e.target.value);
                      clearError("organization_name");
                    }}
                    placeholder="e.g. Acme Health Technologies"
                    autoComplete="organization"
                    maxLength={120}
                    aria-invalid={Boolean(errors.organization_name)}
                    aria-describedby={errors.organization_name ? "signup-org-error" : undefined}
                    className={inputClass(Boolean(errors.organization_name))}
                  />
                </div>
                <FieldError id="signup-org-error" message={errors.organization_name} />
              </div>

              {/* Workspace Timezone */}
              <div className="space-y-1.5">
                <label htmlFor="signup-timezone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Workspace Timezone
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <select
                    id="signup-timezone"
                    value={timezone}
                    onChange={(e) => {
                      setTimezone(e.target.value);
                      clearError("timezone");
                    }}
                    aria-invalid={Boolean(errors.timezone)}
                    aria-describedby={errors.timezone ? "signup-timezone-error" : undefined}
                    className={inputClass(Boolean(errors.timezone))}
                  >
                    {timezoneOptions.map((z) => (
                      <option key={z.value} value={z.value}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                </div>
                <FieldError id="signup-timezone-error" message={errors.timezone} />
              </div>

              {/* Register Submit Button */}
              <Button
                type="submit"
                className="w-full h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md shadow-blue-500/20 transition-all hover:shadow-lg active:scale-[0.99] gap-2 pt-1"
                isLoading={isLoading}
              >
                <span>Register Workspace &amp; Proceed</span>
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
