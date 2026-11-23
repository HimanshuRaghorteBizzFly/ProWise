"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api";
import { isBackendUnreachable, mocksAllowed, readPermissionEnv } from "@/lib/permissions";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";
import { useSuperAdminStore } from "@/app/(platform)/super-admin/_store/useSuperAdminStore";
import { usePlatformOperatorStore } from "@/app/(platform)/platform-operator/_store/usePlatformOperatorStore";
import { operatorAuthService } from "@/app/(platform)/platform-operator/_services/operator-auth-service";
import { applyLoginResponse } from "@/lib/auth-session";
import { Button } from "@/components/ui/button";
import { SystemRole } from "@/types";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Cpu,
  Layers,
  Crown,
  Building2,
  FolderKanban,
  Users,
  CheckSquare,
  Zap,
} from "lucide-react";

interface QuickCredential {
  label: string;
  role: string;
  email: string;
  target: string;
  category: "Platform" | "Leadership" | "Delivery";
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

/** Sent only by the offline preview button; it is not the password of any account. */
const OFFLINE_PREVIEW_PLACEHOLDER = "offline-preview-only";

const QUICK_ACCOUNTS: QuickCredential[] = [
  // Platform Section
  {
    label: "Super Admin",
    role: "System Director",
    email: "superadmin@prowise.com",
    target: "/super-admin/dashboard",
    category: "Platform",
    icon: Crown,
    color: "from-amber-500 to-rose-500",
  },
  {
    label: "Platform Operator",
    role: "SRE & Operations",
    email: "operator@prowise.io",
    target: "/platform-operator/dashboard",
    category: "Platform",
    icon: Layers,
    color: "from-blue-500 to-cyan-500",
  },

  // Organization Leadership Section
  {
    label: "Org Owner",
    role: "Executive Owner",
    email: "dr.sarah.lin@acmehealth.com",
    target: "/org/org-acme/owner/dashboard",
    category: "Leadership",
    icon: Building2,
    color: "from-purple-500 to-indigo-600",
  },
  {
    label: "Org Admin",
    role: "Workspace Admin",
    email: "david.kim@acmehealth.com",
    target: "/org/org-acme/admin/dashboard",
    category: "Leadership",
    icon: ShieldCheck,
    color: "from-slate-600 to-indigo-500",
  },

  // Project Delivery Section
  {
    label: "Project Manager",
    role: "Portfolio Manager",
    email: "priya.raman@acmehealth.com",
    target: "/org/org-acme/manager/dashboard",
    category: "Delivery",
    icon: FolderKanban,
    color: "from-blue-600 to-indigo-600",
  },
  {
    label: "Team Lead",
    role: "Engineering Lead",
    email: "marcus.chen@acmehealth.com",
    target: "/org/org-acme/lead/dashboard",
    category: "Delivery",
    icon: Users,
    color: "from-violet-500 to-purple-600",
  },
  {
    label: "Developer",
    role: "Full-Stack Dev",
    email: "alex.rivera@acmehealth.com",
    target: "/org/org-acme/developer/dashboard",
    category: "Delivery",
    icon: Cpu,
    color: "from-emerald-500 to-teal-500",
  },
  {
    label: "QA / Reviewer",
    role: "Quality & Review",
    email: "elena.ruiz@acmehealth.com",
    target: "/org/org-acme/reviewer/dashboard",
    category: "Delivery",
    icon: CheckSquare,
    color: "from-pink-500 to-rose-500",
  },
  {
    label: "Viewer",
    role: "Read-Only Stakeholder",
    email: "jordan.lee@acmehealth.com",
    target: "/org/org-acme/viewer/dashboard",
    category: "Delivery",
    icon: Eye,
    color: "from-amber-500 to-orange-500",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "Platform" | "Leadership" | "Delivery">("ALL");
  const [isLoading, setIsLoading] = useState(false);

  // Development builds only (mocks allowed). No password is embedded anywhere: seeded logins with published
  // passwords were disabled (approved decision D4). A preset fills the email and selects the offline preview role.
  const showDemoPanel = mocksAllowed(readPermissionEnv());

  const fillCredentials = (account: QuickCredential) => {
    setEmail(account.email);
    setPassword("");
    setSelectedPreset(account.label);
    toast.info(`Selected ${account.label}. Enter the password, or use the offline preview when the API is down.`);
  };

  const executeLogin = async (targetEmail: string, targetPass: string, presetLabel?: string) => {
    const cleanEmail = targetEmail.trim();
    if (!cleanEmail || !targetPass) {
      toast.error("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      let destination = "";
      let userRole: SystemRole = "VIEWER";
      let userName = cleanEmail.split("@")[0];

      // 1. Attempt Spring Boot backend authentication
      try {
        const response = await apiClient.login({ email: cleanEmail, password: targetPass });

        if (response.must_change_password) {
          toast.info("Temporary password detected. Please set your new password.");
          window.location.assign("/change-password");
          return;
        }

        // Real session: the server's user, organization(s) and membership role. Never the demo organization.
        const realDestination = applyLoginResponse(response);
        const roleText = (response.user.role ?? "member").replace(/_/g, " ").toLowerCase();
        toast.success(
          response.requires_organization_selection
            ? "Signed in. Choose the organization to open."
            : `Signed in as ${roleText}.`,
        );
        window.location.assign(realDestination);
        return;
      } catch (backendError) {
        // One login page for all nine roles: Platform Operators have their own account store, so a wrong
        // password on the member login is tried once against the operator login before it is reported.
        if (backendError instanceof ApiError && backendError.status === 401 && backendError.code === "INVALID_CREDENTIALS") {
          const operatorDestination = await tryOperatorLogin(cleanEmail, targetPass);
          if (operatorDestination) {
            window.location.assign(operatorDestination);
            return;
          }
          throw backendError;
        }
        // A real answer from the server (wrong password, account pending activation, disabled, rate limited)
        // is always shown as-is. Only an unreachable backend in a development build may use the local
        // preview session below; production builds never do.
        const status = backendError instanceof ApiError ? backendError.status : 0;
        if (!mocksAllowed(readPermissionEnv()) || !isBackendUnreachable(status)) {
          throw backendError;
        }
        console.warn("Backend unreachable in development; using a local preview session.");
        const normalized = cleanEmail.toLowerCase();
        if (normalized.includes("superadmin") || presetLabel === "Super Admin") {
          userRole = "SUPER_ADMIN";
          userName = "Super Admin";
          destination = "/super-admin/dashboard";
        } else if (normalized.includes("operator") || presetLabel === "Platform Operator") {
          userRole = "PLATFORM_OPERATOR";
          userName = "Jordan Mercer";
          destination = "/platform-operator/dashboard";
        } else if (
          normalized.includes("alex.rivera") ||
          normalized.includes("developer") ||
          presetLabel === "Developer"
        ) {
          userRole = "DEVELOPER";
          userName = "Alex Rivera";
          destination = "/org/org-acme/developer/dashboard";
        } else if (normalized.includes("sarah.lin") || normalized.includes("owner") || presetLabel === "Org Owner") {
          userRole = "ORGANIZATION_OWNER";
          userName = "Dr. Sarah Lin";
          destination = "/org/org-acme/owner/dashboard";
        } else if (normalized.includes("david.kim") || normalized.includes("admin") || presetLabel === "Org Admin") {
          userRole = "ORGANIZATION_ADMIN";
          userName = "David Kim";
          destination = "/org/org-acme/admin/dashboard";
        } else if (normalized.includes("priya.raman") || normalized.includes("manager") || presetLabel === "Project Manager") {
          userRole = "PROJECT_MANAGER";
          userName = "Priya Raman";
          destination = "/org/org-acme/manager/dashboard";
        } else if (normalized.includes("marcus.chen") || normalized.includes("lead") || presetLabel === "Team Lead") {
          userRole = "TEAM_LEAD";
          userName = "Marcus Chen";
          destination = "/org/org-acme/lead/dashboard";
        } else if (normalized.includes("elena.ruiz") || normalized.includes("reviewer") || normalized.includes("qa") || presetLabel === "QA / Reviewer") {
          userRole = "QA_REVIEWER";
          userName = "Elena Ruiz";
          destination = "/org/org-acme/reviewer/dashboard";
        } else if (normalized.includes("jordan.lee") || normalized.includes("viewer") || presetLabel === "Viewer") {
          userRole = "VIEWER";
          userName = "Jordan Lee";
          destination = "/org/org-acme/viewer/dashboard";
        } else {
          // Never default an unknown address to an administrator preview.
          throw new Error("The server is unreachable. Start the backend and try again.");
        }
      }

      // 2. Resolve destination URL according to role
      if (!destination) {
        if (userRole === "SUPER_ADMIN") destination = "/super-admin/dashboard";
        else if (userRole === "PLATFORM_OPERATOR") destination = "/platform-operator/dashboard";
        else if (userRole === "DEVELOPER") destination = "/org/org-acme/developer/dashboard";
        else destination = getRoleDashboardPath(userRole, "org-acme");
      }

      // Normalize UUID orgs to mock fixture org if applicable
      if (destination.includes("0a000000-0000-4000-8000-00000000000a")) {
        const panelSegment = userRole === "PROJECT_MANAGER" ? "manager" : userRole === "TEAM_LEAD" ? "lead" : userRole === "QA_REVIEWER" ? "reviewer" : userRole === "ORGANIZATION_OWNER" ? "owner" : userRole === "ORGANIZATION_ADMIN" ? "admin" : userRole === "DEVELOPER" ? "developer" : "viewer";
        destination = `/org/org-acme/${panelSegment}/dashboard`;
      }

      // 3. Update global Auth store
      useAuthStore.getState().setCurrentUser({
        id: "usr-" + userRole.toLowerCase().replace(/_/g, "-"),
        email: cleanEmail,
        name: userName,
        timezone: "America/New_York",
        createdAt: new Date().toISOString(),
      });
      useAuthStore.getState().setCurrentRole(userRole);
      useAuthStore.getState().setCurrentOrg({
        id: "org-acme",
        slug: "acme-health",
        name: "Acme Health Technologies",
        ownerId: "usr-owner",
        timezone: "America/New_York",
        workCalendar: { workDays: [1, 2, 3, 4, 5], dailyHours: 8, holidays: [] },
        createdAt: "2026-02-15T09:00:00Z",
        plan: "ENTERPRISE",
        status: "ACTIVE",
      });
      useAuthStore.getState().login(cleanEmail, userRole);

      // 4. Update panel-specific stores
      if (userRole === "SUPER_ADMIN") {
        try {
          useSuperAdminStore.getState().setActiveRolePreview("role-sa");
        } catch {}
      } else if (userRole === "PLATFORM_OPERATOR") {
        try {
          usePlatformOperatorStore.getState().updateAccountSettings({
            name: userName,
            email: cleanEmail,
            department: "Site Reliability",
            shiftName: "EMEA Shift (08:00 - 16:30 UTC)",
            mfaEnabled: true,
            activeOperatorId: "op-jordan",
          });
        } catch {}
      }

      toast.success(`Signed in as ${userRole.replace(/_/g, " ")}. Redirecting to dashboard...`);
      setTimeout(() => {
        window.location.assign(destination);
      }, 200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to complete sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  /** Platform Operator sign-in on the common page. Returns the dashboard, or null when the credentials are not an operator's. */
  const tryOperatorLogin = async (operatorEmail: string, operatorPassword: string): Promise<string | null> => {
    try {
      const res = await operatorAuthService.login(operatorEmail, operatorPassword, false);
      usePlatformOperatorStore.getState().updateAccountSettings({
        name: res.operator.name,
        email: res.operator.email,
        department: res.operator.departmentName as never,
        shiftName: res.operator.shiftName,
        mfaEnabled: res.operator.mfaEnabled,
        activeOperatorId: res.operator.id,
      });
      useAuthStore.getState().setCurrentRole("PLATFORM_OPERATOR");
      useAuthStore.getState().login(res.operator.email, "PLATFORM_OPERATOR");
      toast.success(`Welcome back, ${res.operator.name}.`);
      return "/platform-operator/dashboard";
    } catch (operatorError) {
      // A real operator refusal (suspended, setup unfinished, locked) is shown as-is; anything else means the
      // address is not an operator, and the member login's "invalid credentials" answer stands.
      const message = operatorError instanceof Error ? operatorError.message : "";
      if (/suspend|disabled|locked|setup|invitation/i.test(message)) throw operatorError;
      return null;
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(email, password, selectedPreset || undefined);
  };

  const handleInstantSignIn = async (account: QuickCredential) => {
    fillCredentials(account);
    // Not a password for any account: a reachable API rejects it, and only an unreachable API in a development
    // build falls back to the local preview session for the selected role.
    await executeLogin(account.email, OFFLINE_PREVIEW_PLACEHOLDER, account.label);
  };

  const visibleAccounts =
    categoryFilter === "ALL"
      ? QUICK_ACCOUNTS
      : QUICK_ACCOUNTS.filter((a) => a.category === categoryFilter);

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 overflow-hidden">
      {/* Decorative ambient gradient orbs */}
      <div className="absolute top-[-10rem] left-1/2 -translate-x-1/2 w-[38rem] h-[38rem] bg-gradient-to-tr from-blue-500/20 via-indigo-500/20 to-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10rem] right-[-5rem] w-80 h-80 bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative w-full max-w-md sm:max-w-lg transition-all">
        {/* Header Branding */}
        <div className="text-center mb-5">
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

        {/* Quick-fill Account Selector for Seamless Development & Access across all sections */}
        {showDemoPanel && (
        <div className="mb-5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Development Preview Roles
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-900/40">
              All 9 Sections
            </span>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-0.5 scrollbar-none">
            {(["ALL", "Platform", "Leadership", "Delivery"] as const).map((cat) => {
              const count =
                cat === "ALL"
                  ? QUICK_ACCOUNTS.length
                  : QUICK_ACCOUNTS.filter((a) => a.category === cat).length;
              const isCatActive = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    isCatActive
                      ? "bg-blue-600 text-white shadow-xs font-semibold"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {cat === "ALL" ? "All" : cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Quick Account Cards Grid */}
          <div className="grid grid-cols-3 gap-2">
            {visibleAccounts.map((account) => {
              const Icon = account.icon;
              const isSelected = selectedPreset === account.label;
              return (
                <button
                  key={account.label}
                  type="button"
                  onClick={() => fillCredentials(account)}
                  onDoubleClick={() => handleInstantSignIn(account)}
                  title={`${account.label} (${account.role}) - double click for the offline preview`}
                  className={`group relative flex flex-col items-center justify-center text-center p-2 rounded-xl border transition-all text-left ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/90 dark:bg-blue-950/60 shadow-sm ring-1 ring-blue-600"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-tr ${account.color} text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-105 transition-transform`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate w-full">
                    {account.label}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate w-full">
                    {account.role}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Preset State Bar with Instant Login Action */}
          {selectedPreset && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[200px]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Ready as {selectedPreset}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPreset(null);
                    setEmail("");
                    setPassword("");
                  }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
                >
                  Clear
                </button>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => {
                    const matched = QUICK_ACCOUNTS.find((a) => a.label === selectedPreset);
                    if (matched) handleInstantSignIn(matched);
                  }}
                  disabled={isLoading}
                  className="h-7 px-2.5 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-1"
                >
                  <Zap className="w-3 h-3 text-amber-300" /> Offline Preview
                </Button>
              </div>
            </div>
          )}
        </div>
        )}

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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (selectedPreset) setSelectedPreset(null);
                  }}
                  placeholder="e.g. superadmin@prowise.com"
                  required
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
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (selectedPreset) setSelectedPreset(null);
                  }}
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
