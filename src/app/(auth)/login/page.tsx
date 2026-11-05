"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";
import { SEEDED_USERS } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { switchUserAndRole, currentOrg } = useAuthStore();
  const [email, setEmail] = useState("sarah.chen@acmehealth.com");
  const [password, setPassword] = useState("••••••••••••");
  const [isLoading, setIsLoading] = useState(false);

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const matched = SEEDED_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        switchUserAndRole(matched.id, router.push);
        toast.success(`Signed in as ${matched.name}`);
      } else {
        toast.error("Invalid credentials. Try selecting a seeded demo user below.");
      }
    }, 400);
  };

  const handleQuickLogin = (userId: string) => {
    switchUserAndRole(userId, router.push);
    const user = SEEDED_USERS.find((u) => u.id === userId);
    toast.success(`Signed in as ${user?.name}`);
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text-primary flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl bg-blue-600 items-center justify-center text-white font-bold text-xl shadow-md mb-3">
            P
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-app-text-primary">
            Sign in to ProWise
          </h1>
          <p className="text-sm text-app-text-secondary mt-1">
            Google Workspace-inspired Project Delivery SaaS
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-6 shadow-modal">
          <form onSubmit={handleCustomLogin} className="space-y-4">
            <Input
              label="Work Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-app-text-secondary">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Sign In
            </Button>
          </form>

          {/* Quick Demo Sign-ins */}
          <div className="mt-6 pt-5 border-t border-app-border">
            <p className="text-[11px] font-bold uppercase tracking-wider text-app-text-muted mb-2.5">
              1-Click Demo Profiles (All 9 Roles)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin("usr-owner")}
                className="justify-start text-left text-[11px]"
              >
                🏢 Org Owner
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin("usr-manager")}
                className="justify-start text-left text-[11px]"
              >
                📊 Project Manager
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin("usr-lead")}
                className="justify-start text-left text-[11px]"
              >
                👥 Team Lead
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin("usr-developer")}
                className="justify-start text-left text-[11px]"
              >
                💻 Developer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin("usr-reviewer")}
                className="justify-start text-left text-[11px]"
              >
                🔍 QA / Reviewer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin("usr-viewer")}
                className="justify-start text-left text-[11px]"
              >
                👀 Stakeholder Viewer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin("usr-superadmin")}
                className="justify-start text-left text-[11px]"
              >
                🛡️ Super Admin
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin("usr-operator")}
                className="justify-start text-left text-[11px]"
              >
                ⚙️ Platform Operator
              </Button>
            </div>
          </div>
        </Card>

        {/* Signup Link */}
        <p className="text-center text-xs text-app-text-secondary mt-6">
          Don&apos;t have an organization workspace?{" "}
          <Link href="/signup" className="text-blue-600 font-semibold hover:underline">
            Create an organization
          </Link>
        </p>
      </div>
    </div>
  );
}

