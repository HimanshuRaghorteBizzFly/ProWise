"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ShieldAlert,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Globe,
  ArrowRight,
  CheckCircle2,
  Sparkles
} from "lucide-react";

const TIMEZONES = [
  { value: "America/New_York", label: "America/New_York (EST / EDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST / PDT)" },
  { value: "America/Chicago", label: "America/Chicago (CST / CDT)" },
  { value: "Europe/London", label: "Europe/London (GMT / BST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET / CEST)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [isLoading, setIsLoading] = useState(false);

  const isPasswordLongEnough = password.length >= 12;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordLongEnough) {
      toast.error("Password must be at least 12 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await apiClient.signup({
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
      toast.success("Organization workspace registered successfully!");
      window.location.assign("/select-org");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the workspace.");
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
            Registering provisions you as an <strong>Organization Owner</strong>. Enterprise roles (<em>Super Admin</em> &amp; <em>Platform Operator</em>) are provisioned through centralized system administration.
          </div>
        </div>

        {/* Signup Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-black/50 p-6 sm:p-7 backdrop-blur-md">
          <form onSubmit={handleSignup} className="space-y-4">
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

            {/* Organization / Workspace Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Organization / Workspace Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Health Technologies"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Workspace Timezone */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Workspace Timezone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Globe className="w-4 h-4" />
                </div>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
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
